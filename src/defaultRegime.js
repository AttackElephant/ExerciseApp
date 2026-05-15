// Embedded default regime — ships with the app per US2.
// Replaced at runtime once the user pastes one (US17). Exercise names are
// kebab-case strings matching the filenames under assets/exercises/, so the
// per-exercise demonstration images keyed by name (US19/US21) link
// automatically.

export const defaultRegime = {
  name: 'Shane base — chin-up + cardio',
  days: {
    monday: {
      morning: [
        { name: 'easy-run', type: 'running',
          distance_km: 3, duration_min: 20, surface: 'outdoor' }
      ],
      afternoon: [
        { name: 'dead-hang', type: 'resistance', sets: 2, duration_s: 8 }
      ]
    },

    tuesday: {
      morning: [
        { name: 'easy-run', type: 'running',
          distance_km: 3, duration_min: 20, surface: 'outdoor' }
      ],
      afternoon: [
        { name: 'arm-circles', type: 'resistance', sets: 1, reps: 20 },
        { name: 'bodyweight-squats', type: 'resistance', sets: 1, reps: 15 },
        { name: 'dead-hang', type: 'resistance', sets: 3, duration_s: 8 },
        { name: 'scapular-pulls', type: 'resistance', sets: 3, reps: 5 },
        { name: 'inverted-rows', type: 'resistance', sets: 3, reps: 9 },
        { name: 'push-ups', type: 'resistance', sets: 3, reps: 9 }
      ]
    },

    wednesday: {
      morning: [
        { name: 'run-with-pickups', type: 'running',
          distance_km: 3, duration_min: 20, surface: 'outdoor' }
      ],
      afternoon: [
        { name: 'dead-hang', type: 'resistance', sets: 2, duration_s: 8 },
        { name: 'walking-lunges', type: 'resistance', sets: 2, reps: 12 }
      ]
    },

    thursday: {
      morning: [
        { name: 'easy-run', type: 'running',
          distance_km: 3, duration_min: 20, surface: 'outdoor' }
      ],
      afternoon: [
        { name: 'arm-circles', type: 'resistance', sets: 1, reps: 20 },
        { name: 'bodyweight-squats', type: 'resistance', sets: 1, reps: 15 },
        { name: 'dead-hang', type: 'resistance', sets: 3, duration_s: 8 },
        { name: 'scapular-pulls', type: 'resistance', sets: 3, reps: 5 },
        { name: 'inverted-rows', type: 'resistance', sets: 3, reps: 9 },
        { name: 'push-ups', type: 'resistance', sets: 3, reps: 9 }
      ]
    },

    friday: {
      morning: [
        { name: 'easy-run', type: 'running',
          distance_km: 3, duration_min: 20, surface: 'outdoor' }
      ],
      afternoon: [
        { name: 'dead-hang', type: 'resistance', sets: 2, duration_s: 8 },
        { name: 'bear-crawl', type: 'resistance', sets: 2, duration_s: 30 }
      ]
    }
    // saturday + sunday omitted = rest days
  }
};
