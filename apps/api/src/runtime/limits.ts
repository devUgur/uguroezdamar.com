/** Limits of an agent run. One place, read by the runtime and by the configuration view. */

/** Steps per task across all stages; the loop stops there and asks Ugur. */
export const MAX_STEPS = 24;
/** Messages of the conversation sent to the model with each step. */
export const HISTORY_LIMIT = 60;
/** A run without progress for this long is treated as dead (e.g. after a deploy). */
export const STALE_RUN_MS = 15 * 60_000;
/** Live answer text is sent to browsers in batches, not per token. */
export const DELTA_FLUSH_MS = 1_000;
