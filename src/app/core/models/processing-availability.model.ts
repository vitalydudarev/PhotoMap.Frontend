/**
 * Whether photos and videos can be processed (backend `ProcessingAvailabilityDto`, and the payload of the hub's
 * `ProcessingAvailability` event). With Kafka enabled, the backend processes them only while Kafka can be reached;
 * everything else works either way.
 */
export interface ProcessingAvailability {
  available: boolean;
  /** Why processing is unavailable, absent while it is available. */
  reason?: string | null;
}
