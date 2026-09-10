// Thrown when an optimistic-concurrency guard (an updatedAt-conditioned
// update) matches zero rows — the record was changed by someone else since
// it was loaded. Shared across admin endpoints that need this check.
export class ConflictError extends Error {}
