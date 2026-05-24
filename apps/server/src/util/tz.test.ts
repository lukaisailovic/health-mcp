import { describe, expect, it } from 'vitest';
import { deriveMealType, toLocalDate } from './tz.js';

describe('tz helpers', () => {
  it('toLocalDate gives YYYY-MM-DD in target tz', () => {
    expect(toLocalDate('2026-05-24T23:30:00Z', 'UTC')).toBe('2026-05-24');
    // 23:30 UTC = 01:30 next day in Berlin (DST)
    expect(toLocalDate('2026-05-24T23:30:00Z', 'Europe/Berlin')).toBe('2026-05-25');
  });

  it('deriveMealType bins by local hour', () => {
    // 09:00 UTC = breakfast
    expect(deriveMealType('2026-05-24T09:00:00Z', 'UTC')).toBe('breakfast');
    expect(deriveMealType('2026-05-24T13:00:00Z', 'UTC')).toBe('lunch');
    expect(deriveMealType('2026-05-24T19:00:00Z', 'UTC')).toBe('dinner');
    expect(deriveMealType('2026-05-24T22:00:00Z', 'UTC')).toBe('snack');
  });
});
