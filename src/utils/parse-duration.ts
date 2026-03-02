const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export function parseDurationToMs(duration: string | number): number {
  if (typeof duration === 'number') {
    // already a number
    return duration;
  }

  // capture value and unit
  const match = duration.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'ms':
      return value;
    case 's':
      return value * MS_PER_SECOND;
    case 'm':
      return value * MS_PER_MINUTE;
    case 'h':
      return value * MS_PER_HOUR;
    case 'd':
      return value * MS_PER_DAY;
    default:
      throw new Error(`Unsupported time unit: ${unit}`);
  }
}
