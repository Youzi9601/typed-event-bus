import { PREFIX_KEY } from './constants.js';
import {
  createEventBus,
  defineEvent,
  type EventBus,
  type EventDefinition,
  type Listener,
} from './index.js';

/**
 * INTERNAL testing utilities — NOT part of the public API.
 *
 * These helpers exist so that typed-event-bus can test its own event-driven
 * behavior. Use them only from within the project's test suite (import from
 * `../../src/testing.js`); do not rely on them from application code.
 *
 * They are intentionally kept out of `src/index.ts` to avoid growing the
 * production bundle and to keep the public surface minimal.
 */

/**
 * Creates a new bus that reuses the given bus's registry but has fully
 * isolated state (no shared listeners, middlewares, or error handlers).
 *
 * @typeParam TRegistry - Registry type of both the source and returned bus
 * @param sourceBus - Bus whose registry will be reused
 * @returns A new bus with the same registry and fresh state
 */
export function createTestBus<TRegistry extends EventBus['registry']>(
  sourceBus: EventBus<TRegistry>
): EventBus<TRegistry> {
  return createEventBus(sourceBus.registry);
}

/**
 * Creates a bus from plain event-name strings, generating an ad-hoc registry
 * on the fly. Useful for quick, throwaway test setups.
 *
 * @param eventNames - Event name strings to define
 * @returns `{ bus, events }` where `events` maps each name to its definition
 */
export function createTestBusFromNames(eventNames: string[]): {
  bus: EventBus;
  events: Record<string, EventDefinition<string, unknown>>;
} {
  const events: Record<string, EventDefinition<string, unknown>> = {};
  for (const name of eventNames) {
    events[name] = defineEvent(name).payload<unknown>();
  }
  const bus = createEventBus({ default: { [PREFIX_KEY]: 'default', ...events } });
  return { bus, events };
}

/**
 * Return shape of {@link mockListener} and {@link mockAsyncListener}.
 *
 * @typeParam TPayload - Payload type carried by the mocked listener
 */
export type MockListenerResult<TPayload> = {
  /** The listener function to register via `bus.on()` */
  listener: Listener<TPayload>;
  /** Live array of recorded calls; each entry is `{ payload, ts }` */
  calls: Array<{ payload: TPayload; ts: number }>;
  /** Clears all recorded calls */
  reset: () => void;
  /** Number of calls recorded so far */
  callCount: () => number;
  /** Most recent call (or `undefined` if none) */
  lastCall: () => { payload: TPayload; ts: number } | undefined;
};

/**
 * Creates a mock (spy) listener that records every invocation with its payload
 * and a timestamp. Register the returned `listener` via `bus.on()`, then assert
 * on `calls`, `callCount()`, or `lastCall()`.
 *
 * @typeParam TPayload - Payload type inferred from the event when used with `bus.on()`
 * @returns A {@link MockListenerResult} spy object
 */
export function mockListener<TPayload = unknown>(): MockListenerResult<TPayload> {
  const calls: Array<{ payload: TPayload; ts: number }> = [];
  const listener = (payload: TPayload): void => {
    calls.push({ payload, ts: Date.now() });
  };
  return {
    listener: listener as Listener<TPayload>,
    calls,
    reset: () => {
      calls.length = 0;
    },
    callCount: () => calls.length,
    lastCall: () => calls[calls.length - 1],
  };
}

/**
 * Creates an async mock listener (same spy shape as {@link mockListener}) that
 * records calls then resolves after an optional delay. Exercise async listener
 * paths and `emitAsync` with these.
 *
 * @typeParam TPayload - Payload type carried by the mocked listener
 * @param delayMs - Optional delay in milliseconds before resolving (default `0`)
 * @returns A {@link MockListenerResult} spy whose `listener` is asynchronous
 */
export function mockAsyncListener<TPayload = unknown>(delayMs = 0): MockListenerResult<TPayload> {
  const base = mockListener<TPayload>();
  const asyncListener = (async (payload: TPayload): Promise<void> => {
    base.listener(payload);
    if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
  }) as Listener<TPayload>;
  return { ...base, listener: asyncListener };
}

/**
 * Waits for a single emission of the given event and resolves with its payload.
 * Rejects if the event does not fire within `timeoutMs`. The subscription is
 * cleaned up automatically on both resolution and timeout.
 *
 * @typeParam TPayload - Payload type of the event being awaited
 * @param bus - The bus to listen on
 * @param event - Event definition to wait for
 * @param timeoutMs - Timeout in milliseconds (default `5000`)
 * @returns A promise resolving with the event payload
 * @throws {Error} If the event is not emitted within `timeoutMs`
 */
export function waitForEvent<TPayload>(
  bus: EventBus,
  event: EventDefinition<string, TPayload>,
  timeoutMs = 5000
): Promise<TPayload> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      sub.unsubscribe();
      reject(new Error(`Timeout waiting for event "${event.name}" after ${timeoutMs}ms`));
    }, timeoutMs);
    const sub = bus.once(event, payload => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}
