import {PhotoSourceProgress} from './photo-source-progress.model';

/** Mirrors the backend's `SourceDownloadContentDto`: the files a download of a source takes. */
export enum SourceDownloadContent {
  Photos = 1,
  Videos = 2,
  All = 3,
}

/**
 * Which folder of a source a download takes its files from: the one its photos are processed from, or one the user
 * chooses (Yandex.Disk only). The downloads of each kind run, and keep their failed files, apart from one another.
 */
export type SourceDownloadKind = 'processing-folder' | 'chosen-folder';

/** Mirrors the backend's `SourceDownloadStatusDto`, the status of the last download of a source. */
export interface SourceDownloadStatus extends PhotoSourceProgress {
  /** A `SourceDownloadContent` value, absent when the source has not been downloaded. */
  content?: number;
  /** The last download has taken only the files that failed before, rather than the folder. */
  retryingFailed: boolean;
  /** The folder the last chosen folder download has taken its files from, such as `disk:/Photos/2020`. */
  folder?: string;
  /** The files found downloaded whole when the last download started, which it has skipped. */
  alreadyDownloadedCount: number;
  /** The files that failed to download, over all downloads, and are not downloaded yet. */
  failedFileCount: number;
  /** The folder on the disk of the backend the files are downloaded to. */
  targetFolder: string;
}

/** Mirrors the backend's `FailedDownloadDto`, a file that failed to download and is not downloaded yet. */
export interface FailedDownload {
  /** The folder of the source the file is in, empty for the folder the photos are processed from. */
  folder: string;
  fileName: string;
  size: number;
  /** A `SourceDownloadContent` value. */
  content: number;
  error: string;
  /** How many times the file has failed, over all downloads. */
  attempts: number;
  /** ISO 8601. */
  failedAt: string;
}
