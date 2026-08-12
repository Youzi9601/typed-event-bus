import type { EventBus } from '../bus.js';
import type { EventDefinition, EventsOf, Subscription, WildcardHandler } from '../types.js';
import type { BusContext } from './context.js';
import { on } from './on.js';

/**
 * Recursively collect all EventDefinitions from a namespace (including nested namespaces)
 */
function collectEventDefinitions(
  namespace: Record<string, unknown>,
  prefix = ''
): EventDefinition<string, unknown>[] {
  const events: EventDefinition<string, unknown>[] = [];

  for (const key of Object.keys(namespace)) {
    if (key === '__prefix' || key === '__brand') continue;

    const value = namespace[key];

    // Check if it's a nested namespace
    const isNestedNamespace =
      typeof value === 'object' && value !== null && '__prefix' in value && '__brand' in value;

    if (isNestedNamespace) {
      // Recurse into nested namespace with updated prefix
      const nestedPrefix = prefix ? `${prefix}.${key}` : key;
      events.push(...collectEventDefinitions(value as Record<string, unknown>, nestedPrefix));
    } else if (
      typeof value === 'object' &&
      value !== null &&
      'name' in value &&
      '__brand' in value
    ) {
      // It's an EventDefinition
      events.push(value as EventDefinition<string, unknown>);
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
export function onAll<TNamespace extends { readonly __prefix: string }>(
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

  let _unsubscribed = false;
  return {
    unsubscribe: () => {
      if (_unsubscribed) return;
      _unsubscribed = true;
      for (const sub of subscriptions) {
        sub.unsubscribe();
      }
    },
    get signal() {
      return subscriptions[0]?.signal;
    },
    get unsubscribed() {
      return _unsubscribed;
    },
  };
}
