import { parseDurationToMs } from './parse-duration';

describe('parseDurationToMs', () => {
  // ─── Number passthrough ────────────────────────────────────────────────────

  describe('given a number', () => {
    it('returns the value as-is', () => {
      expect(parseDurationToMs(5000)).toBe(5000);
    });

    it('returns 0 for input 0', () => {
      expect(parseDurationToMs(0)).toBe(0);
    });
  });

  // ─── Valid string formats ──────────────────────────────────────────────────

  describe('given a valid string', () => {
    it.each([
      ['500ms', 500],
      ['1s', 1_000],
      ['30s', 30_000],
      ['1m', 60_000],
      ['15m', 900_000],
      ['1h', 3_600_000],
      ['2h', 7_200_000],
      ['1d', 86_400_000],
      ['7d', 604_800_000],
    ])('converts "%s" → %i ms', (input, expected) => {
      expect(parseDurationToMs(input)).toBe(expected);
    });
  });

  // ─── Invalid input ─────────────────────────────────────────────────────────

  describe('given an invalid string', () => {
    it.each([
      ['', 'empty string'],
      ['invalid', 'plain text'],
      ['m', 'unit without a value'],
      ['1w', 'unsupported unit w'],
      ['1.5m', 'decimal value'],
      ['-5s', 'negative value'],
      ['1 m', 'space between value and unit'],
    ])('throws for "%s" (%s)', (input) => {
      expect(() => parseDurationToMs(input)).toThrow();
    });

    it('includes the bad input in the error message', () => {
      expect(() => parseDurationToMs('bogus')).toThrow(
        'Invalid duration format: bogus',
      );
    });
  });
});
