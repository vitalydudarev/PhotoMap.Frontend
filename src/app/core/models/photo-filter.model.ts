/** Which photos to take. An empty list does not narrow the photos down: they come from every source, or every year. */
export interface PhotoFilter {
  sourceIds: readonly number[];
  /** The years, in UTC, the photos were taken in. */
  years: readonly number[];
}
