/** Mirrors the backend's `PhotoSourceProgressDto`, the processing status of a source as last saved by a run. */
export interface PhotoSourceProgress {
  /** A `UserPhotoSourceStatusDto` value. */
  status: number;
  totalCount: number;
  processedCount: number;
  failedCount: number;
  /** ISO 8601, absent when the source has never been processed. */
  lastUpdatedAt?: string;
}
