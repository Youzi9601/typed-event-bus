import type { EventBus } from '../bus.js';
import { BRAND_KEY, PREFIX_KEY } from '../constants.js';
import { isEventDefinition, isEventNamespace } from '../define.js';
import type { EventDefinition, EventsOf, Subscription, WildcardHandler } from '../types.js';
import type { BusContext } from './context.js';
import { on } from './on.js';

/**
 * Recursively collect all EventDefinitions from a namespace (including nested namespaces)
 */
function collectEventDefinitions(
  namespace: Record<string, unknown>
): EventDefinition<string, unknown>[] {
  const events: EventDefinition<string, unknown>[] = [];

  for (const key of Object.keys(namespace)) {
    if (key === PREFIX_KEY || key === BRAND_KEY) continue;

    const value = namespace[key];

    if (isEventNamespace(value)) {
      events.push(...collectEventDefinitions(value as Record<string, unknown>));
    } else if (isEventDefinition(value)) {
      events.push(value);
    }
  }

  return events;
}

/**
 * Subscribe to all events in a namespace.
 * Handler receives discriminated object { event, payload }.
 * Enables TypeScript correlation narrowing.
 * Supports nested namespaces.
 *
 * @param ctx BusContext
 * @param bus EventBus instance (for subscription)
 * @param namespace EventNamespace or DefineEventsOutput
 * @param handler handler function
 * @param options options
 * @returns Subscription
 */
export function onAll<TNamespace extends { readonly [PREFIX_KEY]: string }>(
  ctx: BusContext,
  bus: EventBus,
  namespace: TNamespace,
  handler: WildcardHandler<EventsOf<TNamespace>>,
  options?: { signal?: AbortSignal }
): Subscription {
  // Collect all EventDefinitions recursively from the namespace (including nested)
  const eventDefs = collectEventDefinitions(namespace as Record<string, unknown>);

  const subscriptions: Subscription[] = [];

  for (const eventDef of eventDefs) {
    const sub = on(
      ctx,
      bus,
      eventDef,
      payload => {
        handler({ event: eventDef.name, payload } as EventsOf<TNamespace>);
      },
      options
    );
    subscriptions.push(sub);
  }

  const signal = options?.signal;
  let _unsubscribed = false;
  const unsubscribe = () => {
    if (_unsubscribed) return;
    _unsubscribed = true;
    if (signal) {
      signal.removeEventListener('abort', abortHandler);
    }
    for (const sub of subscriptions) {
      sub.unsubscribe();
    }
  };
  const abortHandler = () => unsubscribe();

  if (signal) {
    if (signal.aborted) {
      unsubscribe();
    } else {
      signal.addEventListener('abort', abortHandler, { once: true });
    }
  }

  return {
    unsubscribe,
    get signal() {
      return signal ?? subscriptions[0]?.signal;
    },
    get unsubscribed() {
      return _unsubscribed;
    },
  };
}
