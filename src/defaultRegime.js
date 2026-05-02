// Embedded default regime — ships with the app per US2.
// Replaced at runtime once US17 (paste regime) is implemented.

export const defaultRegime = {
  name: 'Default',
  days: {
    monday: {
      morning: [
        { name: '5k Run', type: 'running', distance_km: 5, duration_min: 30, surface: 'outdoor' }
      ],
      afternoon: [
        { name: 'Push-up', type: 'resistance', sets: 3, reps: 15 },
        { name: 'Plank', type: 'resistance', sets: 3, duration_s: 60 }
      ]
    },
    tuesday: {
      morning: [
        { name: 'Treadmill Intervals', type: 'running', distance_km: 3, duration_min: 20, surface: 'treadmill' }
      ]
    },
    wednesday: {
      afternoon: [
        { name: 'Squat', type: 'resistance', sets: 4, reps: 12 },
        { name: 'Glute Bridge', type: 'resistance', sets: 3, duration_s: 45 }
      ]
    },
    thursday: {
      morning: [
        { name: '5k Run', type: 'running', distance_km: 5, duration_min: 30, surface: 'outdoor' }
      ],
      afternoon: [
        { name: 'Push-up', type: 'resistance', sets: 3, reps: 15 }
      ]
    },
    friday: {
      morning: [
        { name: 'Treadmill Easy', type: 'running', distance_km: 4, duration_min: 28, surface: 'treadmill' }
      ]
    },
    saturday: {
      morning: [
        { name: 'Long Run', type: 'running', distance_km: 10, duration_min: 60, surface: 'outdoor' }
      ],
      afternoon: [
        { name: 'Plank', type: 'resistance', sets: 3, duration_s: 60 }
      ]
    }
    // sunday omitted = rest day
  }
};
