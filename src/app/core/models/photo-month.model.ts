/** A month, in UTC, photos were taken in, with how many of them were. */
export interface PhotoMonth {
  year: number;
  /** The month of the year, 1 to 12. */
  month: number;
  count: number;
}

/** Tells a month apart from the others, such as `2019-3`. */
export function photoMonthKey(year: number, month: number): string {
  return `${year}-${month}`;
}

/** The key of the month, in UTC, the photo was taken in; the backend groups the photos by the same. */
export function photoMonthKeyOf(dateTimeTaken: Date | string): string {
  const date = new Date(dateTimeTaken);

  return photoMonthKey(date.getUTCFullYear(), date.getUTCMonth() + 1);
}
