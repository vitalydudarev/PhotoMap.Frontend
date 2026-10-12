/** Payload of the hub's `Progress` event (backend `HubProgressModel`). */
export interface HubProgress {
  sourceId: number;
  status: string;
  processed: number;
  failed: number;
  total: number;
  /** How far a run retrying the failed files has got, apart from the counters of the source; absent for any other run. */
  retry?: HubRetry;
}

/** Backend `HubRetryModel`. */
export interface HubRetry {
  /** The failed files the run retries, 0 until it has got them. */
  total: number;
  /** The files retried so far, saved or failed again. */
  retried: number;
  /** The files retried that have been saved this time. */
  recovered: number;
}

/** Payload of the hub's `Error` event (backend `HubErrorModel`). */
export interface HubError {
  sourceId: number;
  error: string;
}
