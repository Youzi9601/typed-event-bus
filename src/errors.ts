import type { EventDefinition } from './types.js';

/**
 * MultiError aggregates multiple errors.
 * Collects all async listener exceptions during emitAsync.
 */
export class MultiError extends Error {
  override readonly name = 'MultiError';
  readonly errors: unknown[];

  /**
   * Create a new MultiError.
   * @param errors - Array of collected errors
   * @param message - Optional custom message (default: generated message with error count)
   */
  constructor(errors: unknown[], message?: string) {
    super(
      message ??
        `MultiError: ${errors.length} error${errors.length === 1 ? '' : 's'} occurred during async emission`
    );
    this.errors = errors;
    Object.setPrototypeOf(this, MultiError.prototype);
  }
}

/**
 * Error handler hook signature.
 * Called for each listener exception during emit / emitAsync, continues execution.
 */
export type ErrorHandler = (
  error: unknown,
  event: EventDefinition<string, unknown>,
  payload: unknown
) => void;

/**
 * Default error handler.
 * Logs error to console.error with event name.
 *
 * @param error - The caught error
 * @param event - EventDefinition that triggered the error
 * @param _payload - Payload that was passed to the listener (unused)
 */
export function defaultErrorHandler(
  error: unknown,
  event: EventDefinition<string, unknown>,
  _payload: unknown
): void {
  console.error(`[typed-event-bus] Error in listener for "${event.name}":`, error);
}
