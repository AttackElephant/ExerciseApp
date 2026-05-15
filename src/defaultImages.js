// First-launch seeding of bundled demonstration images.
//
// Images live as PNG files at assets/exercises/<name>.png and are linked
// to exercises by exact name match (US19's keying rule). On first launch
// each one is fetched, stored in the IndexedDB `images` store as a Blob,
// and a meta flag is set so we don't re-seed on every launch. Per-name
// "skip if already exists" guards mean a user-pasted replacement is
// never clobbered, even if the flag is somehow cleared later.

import { getMeta, setMeta, getImage, putImage } from './db.js';

const SEED_FLAG = 'imagesSeeded';

/**
 * Names that ship with the app. Must match the regime's exercise.name AND
 * the filename under assets/exercises/. If you add a PNG, add the name
 * here so it's picked up on a fresh install.
 */
export const DEFAULT_IMAGE_NAMES = Object.freeze([
  'arm-circles',
  'bear-crawl',
  'bodyweight-squats',
  'dead-hang',
  'easy-run',
  'inverted-rows',
  'push-ups',
  'run-with-pickups',
  'scapular-pulls',
  'walking-lunges'
]);

/**
 * Seed any missing default images on first launch.
 *
 * @param {{
 *   fetcher?: (url: string) => Promise<Response>,
 *   basePath?: string
 * }} [opts] for tests; production callers pass nothing.
 */
export async function seedDefaultImagesIfNeeded(opts = {}) {
  const fetcher = opts.fetcher ?? globalThis.fetch?.bind(globalThis);
  const basePath = opts.basePath ?? './assets/exercises/';

  if (!fetcher) return; // jsdom test bench without fetch — nothing to do.

  const flag = await getMeta(SEED_FLAG);
  if (flag === true) return;

  for (const name of DEFAULT_IMAGE_NAMES) {
    // Don't overwrite a user-pasted image if the flag was somehow lost.
    const existing = await getImage(name);
    if (existing) continue;
    try {
      const res = await fetcher(`${basePath}${name}.png`);
      if (!res.ok) {
        console.warn(`seed: ${name}.png unavailable (${res.status})`);
        continue;
      }
      const blob = await res.blob();
      await putImage(name, blob, blob.type || 'image/png');
    } catch (err) {
      console.warn(`seed: failed to fetch ${name}.png`, err);
    }
  }

  await setMeta(SEED_FLAG, true);
}
