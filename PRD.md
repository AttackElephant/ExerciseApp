# PRD: Personal Exercise Tracking PWA

## Problem Statement

A single user needs to log daily morning and afternoon exercise sessions against a personal regime that will change over time. Logged data must be exportable in a format that remains coherent across regime changes, for analysis in a spreadsheet. The app must work fully offline on iPhone with no ongoing data usage, and require no Apple Developer account.

---

## Phase 1: PWA Shell and Regime Data Model (Sessions 1–2)

### Requirements

- **US1:** As the user, when I open the app on iPhone Safari and add it to my home screen, it loads and runs fully offline — Acceptance criteria: Airplane mode enabled, app opens from home screen, renders without error, no network requests made after initial load.

- **US2:** As the user, the app ships with a default regime embedded at build time — Acceptance criteria: On first launch with no user-supplied regime, the default regime loads and displays correctly; default regime contains at least one morning and one afternoon session across multiple weekdays.

- **US3:** As the user, the regime data model supports morning and afternoon sessions per weekday, each containing an ordered list of exercises — Acceptance criteria: A regime JSON can express different exercises on different days and different sessions; model validates on load and rejects malformed input with a plain-text error message.

- **US4:** As the user, the regime data model supports two exercise types — running (fields: distance_km, duration_min, surface[treadmill|outdoor]) and resistance (fields: sets, reps, duration_s for timed holds) — Acceptance criteria: Both types parse correctly from JSON; a resistance exercise may omit reps if duration_s is present, and vice versa.

- **US5:** As the user, the app displays today's sessions — morning and afternoon — based on the current weekday, showing exercises in defined order — Acceptance criteria: Correct session shown for each weekday; if today is not a training day the app says so explicitly but allows exercises to be registered.

### Boundaries

- Do NOT implement session logging or data entry in this phase — display only.
- Do NOT implement regime paste/update mechanism — default regime only.
- Do NOT implement image upload or display.
- Do NOT implement clipboard copy or export.
- Do NOT implement any backend, API calls, or remote storage of any kind.
- Do NOT implement authentication.
- Do NOT implement navigation beyond today's view.

### Done when

- App installs to iPhone home screen via Safari, opens in airplane mode, and renders today's sessions from the default regime without error.

---

## Phase 2: Session Logging (Sessions 3–4)

### Requirements

- **US6:** As the user, I can log each exercise in today's sessions by entering the relevant fields — running: distance_km, duration_min, surface; resistance: sets and reps, or sets and duration_s — Acceptance criteria: Each exercise renders the correct input fields for its type; partial entry is saved and resumable; completed entry is visually distinct from incomplete. distance_km is able to register distance to 1 decimal place.

- **US7:** As the user, logged data persists across app restarts — Acceptance criteria: Close and reopen the app; all entered values for today are present and unchanged. Storage uses IndexedDB.

- **US8:** As the user, each session (morning/afternoon) has a distinct logged state — Acceptance criteria: Morning and afternoon entries are stored and displayed independently; completing one does not affect the other.

- **US9:** As the user, I can mark a session as complete — Acceptance criteria: A "complete" action is available per session; once marked complete the session is visually distinguished; completed sessions remain editable.

### Boundaries

- Do NOT implement historic date logging — today only in this phase.
- Do NOT implement clipboard copy or export.
- Do NOT implement regime updates.
- Do NOT implement image display.
- Do NOT implement input validation beyond field type constraints (numeric fields reject non-numeric input).
- Do NOT implement sets/reps progression tracking or suggestions.

### Done when

- User can open the app, enter all fields for a full day's morning and afternoon sessions, restart the app, and find all values intact.

---

## Phase 3: Historic Logging and Date Navigation (Sessions 5–6)

### Requirements

- **US10:** As the user, I can navigate to any past date and view what the regime was for that day and what I logged — Acceptance criteria: Date picker or back-navigation available; past dates display the logged values if any exist; dates with no log show the regime template unfilled.

- **US11:** As the user, I can log or edit entries for past dates — Acceptance criteria: All input fields are editable for past dates; saves persist to IndexedDB keyed by date.

- **US12:** As the user, past dates reflect the regime that was active at the time, not the current regime — Acceptance criteria: If regime is updated in Phase 5, historic dates continue to display the regime snapshot that was in effect when those sessions were logged. Each log entry stores a snapshot of the exercise definition at time of logging.

### Boundaries

- Do NOT implement future date logging.
- Do NOT implement clipboard export — that is Phase 4.
- Do NOT implement regime updates — that is Phase 5.
- Do NOT implement image display — that is Phase 5.
- Do NOT implement any aggregation or summary views.

### Done when

- User can navigate to a date one week prior, enter session data, restart the app, navigate back to that date, and find all values intact and correctly attributed to that date's regime.

---

## Phase 4: Clipboard Export (Sessions 7–8)

### Requirements

- **US13:** As the user, I can select a date range and copy all session data within that range to the clipboard — Acceptance criteria: Date range picker accepts from/to dates; copy action places TSV on the clipboard; user receives confirmation that copy succeeded. 

- **US14:** The copied TSV includes a header row and one data row per exercise entry per session per day — Acceptance criteria: Header row contains: date, session, exercise_name, type, sets, reps, duration_s, distance_km, duration_min, surface. Empty cells for fields not applicable to that exercise type. Header is always present regardless of range size.

- **US15:** The export is self-describing across regime changes — Acceptance criteria: A row exported today and a row exported after a regime change in three months can be concatenated in a spreadsheet and remain coherent; exercise_name and type are always populated so rows are identifiable without positional assumptions.

- **US16:** As the user, I can copy a single day by setting from and to dates to the same date — Acceptance criteria: Single-day copy produces the same format as a range; no special case UI required.

- **US16.5:** As the user, I can copy all existing data with a single button press - Acceptance criteria: Date range picker has an option for all which copies all session data; user receives confirmation that copy succeeded.

### Boundaries

- Do NOT implement file download — clipboard only in this phase.
- Do NOT implement filtering by exercise type or session within the export.
- Do NOT implement any summary, aggregation, or calculated fields in the export.
- Do NOT implement scheduled or automatic export.

### Done when

- User selects a date range spanning at least three days with mixed exercise types, copies to clipboard, pastes into Numbers or Excel, and all rows are correctly labelled with no data in wrong columns.

---

## Phase 5: Regime Updates and Exercise Images (Sessions 9–11)

*Note: This phase is larger than others and may need splitting once image upload complexity is assessed. Flag before starting.*

### Requirements

- **US17:** As the user, I can paste a JSON regime file into the app to replace the active regime — Acceptance criteria: A designated text area accepts pasted JSON; on confirm, the new regime is validated; if valid it becomes active immediately; if invalid a plain-text error identifies the problem and the existing regime is unchanged.

- **US18:** Regime updates do not alter historic logged data — Acceptance criteria: After pasting a new regime, all previously logged session data remains accessible and displays with the regime snapshot stored at log time (per US12).

- **US19:** As the user, I can upload a demonstration image for any resistance exercise by pasting from clipboard into a designated upload area — Acceptance criteria: Image paste accepted in a per-exercise upload interface; image stored in IndexedDB against the exercise name; an info button appears next to any exercise that has an associated image.

- **US20:** As the user, I can view a demonstration image by tapping the info button next to an exercise name — Acceptance criteria: Tapping info button displays the image full-screen or in a modal; dismissible by tap; works offline.

- **US21:** Images persist across app restarts and regime updates — Acceptance criteria: Images are keyed by exercise name in IndexedDB; a regime update does not delete existing images; if a new regime contains an exercise with the same name, its image is retained.

### Boundaries

- Do NOT implement image upload via file picker — clipboard paste only.
- Do NOT implement image editing, cropping, or resizing.
- Do NOT implement bulk image import.
- Do NOT implement regime version history or rollback.
- Do NOT implement regime editing within the app — paste only.

### Done when

- User pastes a new regime JSON, confirms, sees updated today's session, navigates to a historic date and sees the old regime snapshot, taps info on a resistance exercise and sees the correct image, all in airplane mode.

---

## Open Assumptions

1. The app is a PWA hosted on GitHub Pages. First load requires internet; all subsequent use is offline via service worker cache.
2. All storage is IndexedDB on-device. No data leaves the device at any point after install.
3. Regime JSON schema will be defined collaboratively in Phase 1. The default regime will be specified by the user before Phase 1 begins.
4. Image storage size is not formally bounded. This is acceptable for a single-user personal tool.
5. "Today" is determined by the device clock. No timezone handling is required.
6. The app is English-only, single-user, no authentication, no admin views at any phase.
