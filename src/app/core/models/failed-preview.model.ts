/** Mirrors the backend's `FailedPreviewDto`: a file of a source that failed, with the preview downloaded of it. */
export interface FailedPreview {
  /** `files` for a file of the processing of the photos, `downloads` for one of a download. */
  table: 'files' | 'downloads';
  id: number;
  origin: 'Processing' | 'Download' | 'FolderDownload';
  fileName: string;
  /** The folder of a file of a chosen folder download. */
  folder?: string;
  error: string;
  attempts: number;
  /** ISO 8601. */
  failedAt: string;
  /** Absent until the preview has been downloaded. */
  previewUrl?: string;
  /** `Pending` while the preview is still tried, `Unavailable` once it has been given up on. */
  previewStatus: 'Ready' | 'Pending' | 'Unavailable';
  /** Why the last attempt to download the preview has failed. */
  previewError?: string;
}
