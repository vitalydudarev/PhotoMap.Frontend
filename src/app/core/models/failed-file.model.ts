/**
 * Mirrors the backend's `FailedFileDto`: a photo of a source that could not be downloaded or processed, kept until a
 * later run saves it. The camera uploads and the other uploads keep theirs apart.
 */
export interface FailedFile {
  /** The ID the source assigned to the file (Dropbox file ID, Yandex.Disk resource_id). */
  externalId: string;
  path?: string;
  fileName: string;
  /** What the file failed at. */
  stage: 'Download' | 'Processing';
  /** Why the file failed, empty when the backend has not told. */
  error: string;
  /** How many times the file has failed, over all runs. */
  attempts: number;
  failedAt: string;
}
