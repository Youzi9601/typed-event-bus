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
 * Called for each listener exception during emit, continues execution.
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

/**
 * Safely execute listener, catch exceptions and call error handler.
 *
 * @typeParam TPayload - Payload type
 * @param listener - Listener function (sync or async)
 * @param payload - Payload to pass to listener
 * @param onError - Error handler callback
 * @param event - EventDefinition for error context
 * @returns Promise resolving to `true` if execution succeeded, `false` if error caught
 */
export function executeListenerSafely<TPayload>(
  listener: (payload: TPayload) => void | Promise<void>,
  payload: TPayload,
  onError: ErrorHandler,
  event: EventDefinition<string, unknown>
): Promise<boolean> {
  try {
    const result = listener(payload);
    if (result instanceof Promise) {
      return result.then(
        () => true,
        error => {
          onError(error, event, payload);
          return false;
        }
      );
    }
    return Promise.resolve(true);
  } catch (error) {
    onError(error, event, payload);
    return Promise.resolve(false);
  }
}

/**
 * Safely execute async listener, returns Promise.
 * Used for emitAsync.
 *
 * @typeParam TPayload - Payload type
 * @param listener - Async listener function
 * @param payload - Payload to pass to listener
 * @param _event - EventDefinition for error context (unused in this impl)
 * @returns Promise resolving to `null` on success, or the caught error
 */
export async function executeAsyncListenerSafely<TPayload>(
  listener: (payload: TPayload) => Promise<void>,
  payload: TPayload,
  _event: EventDefinition<string, unknown>
): Promise<unknown | null> {
  try {
    await listener(payload);
    return null;
  } catch (error) {
    return error;
  }
}
