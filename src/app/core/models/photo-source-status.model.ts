/** Mirrors the backend's `UserPhotoSourceStatusDto`. */
export enum PhotoSourceStatus {
  NotStarted = 1,
  InProgress = 2,
  Done = 3,
  Stopped = 4,
  Failed = 5,
  /** The run was interrupted by the backend stopping. */
  Paused = 6,
}

const LABELS: Record<PhotoSourceStatus, string> = {
  [PhotoSourceStatus.NotStarted]: 'Not started',
  [PhotoSourceStatus.InProgress]: 'In progress',
  [PhotoSourceStatus.Done]: 'Done',
  [PhotoSourceStatus.Stopped]: 'Stopped',
  [PhotoSourceStatus.Failed]: 'Failed',
  [PhotoSourceStatus.Paused]: 'Paused',
};

/**
 * The REST API sends the status as a number, the notification hub as the enum's name, so both
 * forms have to be accepted.
 */
export function parsePhotoSourceStatus(value: string | number | undefined | null): PhotoSourceStatus | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'number') {
    return value in LABELS ? (value as PhotoSourceStatus) : undefined;
  }

  const byName = PhotoSourceStatus[value as keyof typeof PhotoSourceStatus];

  return typeof byName === 'number' ? byName : undefined;
}

export function photoSourceStatusLabel(status: PhotoSourceStatus | undefined): string {
  return status === undefined ? 'Unknown' : LABELS[status];
}

export function isPhotoSourceRunning(status: PhotoSourceStatus | undefined): boolean {
  return status === PhotoSourceStatus.InProgress;
}

/**
 * True when a run was interrupted partway. Starting again picks up where it left off rather than
 * beginning from scratch: the backend keeps the source's download cursor and carries the counters
 * over (`PhotoSourceProcessingService.CreateProgressAsync`).
 */
export function isPhotoSourceResumable(status: PhotoSourceStatus | undefined): boolean {
  return status === PhotoSourceStatus.Stopped || status === PhotoSourceStatus.Failed || status === PhotoSourceStatus.Paused;
}
