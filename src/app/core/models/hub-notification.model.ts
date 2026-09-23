/** Payload of the hub's `Progress` event (backend `HubProgressModel`). */
export interface HubProgress {
  sourceId: number;
  status: string;
  processed: number;
  failed: number;
  total: number;
}

/** Payload of the hub's `Error` event (backend `HubErrorModel`). */
export interface HubError {
  sourceId: number;
  error: string;
}
