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

/**
 * A month as the filters ask for it, along with the years: the year times 100 plus the month of the year, 1 to 12, such
 * as 201903 for March 2019; the backend asks for a month as such too.
 */
export function monthValue(year: number, month: number): number {
  return year * 100 + month;
}

/** The years and the months among the values of a filter of both, see `monthValue`, to ask for them apart. */
export function splitDates(dates: readonly number[]): {years: number[]; months: number[]} {
  return {years: dates.filter((date) => !isMonthValue(date)), months: dates.filter(isMonthValue)};
}

/** Whether the value of a filter of the years and the months is a month, see `monthValue`, rather than a year. */
function isMonthValue(date: number): boolean {
  return date >= 10000;
}
