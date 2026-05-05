// Seeding the default demonstration images. fake-indexeddb-backed; the
// fetch is supplied via the opts param so we don't need a real network.

import 'fake-indexeddb/auto';
import { test } from 'uvu';
import * as assert from 'uvu/assert';
import Dexie from 'dexie';

import {
  getImage,
  getMeta,
  putImage,
  _setDbForTest,
  _internals
} from '../../src/db.js';
import {
  DEFAULT_IMAGE_NAMES,
  seedDefaultImagesIfNeeded
} from '../../src/defaultImages.js';

function freshDb() {
  const name = `${_internals.DB_NAME}-${Math.random().toString(36).slice(2)}`;
  const db = new Dexie(name);
  db.version(1).stores({
    [_internals.SESSION_TABLE]: '[date+session], date, session, complete',
    [_internals.META_TABLE]: 'key',
    [_internals.IMAGES_TABLE]: 'name'
  });
  _setDbForTest(db);
  return db;
}

function fakeFetcher() {
  // Minimal Response stub — only blob() and ok are read by the seeder.
  return async (url) => ({
    ok: true,
    blob: async () => new Blob([`fake-${url}`], { type: 'image/png' })
  });
}

test('seeds every default image on first run', async () => {
  freshDb();
  await seedDefaultImagesIfNeeded({ fetcher: fakeFetcher() });

  for (const name of DEFAULT_IMAGE_NAMES) {
    const got = await getImage(name);
    assert.ok(got, `image for ${name} should be stored`);
    assert.is(got.name, name);
    assert.is(got.mime, 'image/png');
  }
  assert.is(await getMeta('imagesSeeded'), true);
});

test('is a no-op once the seed flag is set', async () => {
  freshDb();
  await seedDefaultImagesIfNeeded({ fetcher: fakeFetcher() });

  let calls = 0;
  const counting = async (url) => {
    calls += 1;
    return { ok: true, blob: async () => new Blob(['x'], { type: 'image/png' }) };
  };
  await seedDefaultImagesIfNeeded({ fetcher: counting });
  assert.is(calls, 0, 'second run should not fetch anything');
});

test('does not overwrite a user-pasted image even on first seed', async () => {
  freshDb();
  // User has somehow stored an image before seed runs (e.g., a stale flag
  // was wiped by Wipe-all-data while the user kept a paste).
  const userBlob = new Blob(['user-bytes'], { type: 'image/png' });
  await putImage('dead-hang', userBlob, 'image/png');

  await seedDefaultImagesIfNeeded({ fetcher: fakeFetcher() });

  const got = await getImage('dead-hang');
  // Same Blob bytes the user wrote, not the fake-fetched one.
  const text = await got.blob.text();
  assert.is(text, 'user-bytes');
});

test('continues seeding when one image 404s', async () => {
  freshDb();
  const fetcher = async (url) => {
    if (url.endsWith('/dead-hang.png')) return { ok: false, status: 404 };
    return { ok: true, blob: async () => new Blob(['x'], { type: 'image/png' }) };
  };
  await seedDefaultImagesIfNeeded({ fetcher });

  assert.is(await getImage('dead-hang'), null);
  // Other images are still present.
  assert.ok(await getImage('push-ups'));
});

test('every default image name has a corresponding regime exercise', async () => {
  // Guards against drift: if someone removes an exercise from the regime,
  // the image file becomes orphaned and we'd waste cache space.
  const { defaultRegime } = await import('../../src/defaultRegime.js');
  const regimeNames = new Set();
  for (const day of Object.values(defaultRegime.days)) {
    for (const session of Object.values(day)) {
      for (const ex of session) regimeNames.add(ex.name);
    }
  }
  for (const name of DEFAULT_IMAGE_NAMES) {
    assert.ok(regimeNames.has(name), `no regime exercise for image ${name}`);
  }
});

test('default regime passes validateRegime', async () => {
  const { defaultRegime } = await import('../../src/defaultRegime.js');
  const { validateRegime } = await import('../../src/schema.js');
  const r = validateRegime(defaultRegime);
  assert.is(r.valid, true, r.error);
});

test.run();
