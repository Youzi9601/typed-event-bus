import type { EventDefinition, EventNamespace } from './types.js';

const EVENT_DEFINITION_BRAND = Symbol('EventDefinition');
const EVENT_NAMESPACE_BRAND = Symbol('EventNamespace');

/**
 * Builder returned by defineEvent().
 * Extends EventDefinition<TName, unknown> so it can be used directly
 * as an EventDefinition when no payload is needed.
 * Call .payload<T>() to narrow the payload type.
 */
export interface EventDefinitionBuilder<TName extends string>
  extends EventDefinition<TName, unknown> {
  /** Attach a payload type to this event definition */
  payload<TPayload>(): EventDefinition<TName, TPayload>;
}

/**
 * Create an event definition.
 * @param name - Event name (e.g. "user.created")
 * @returns EventDefinitionBuilder — call .payload<T>() to attach payload type,
 *          or use directly as EventDefinition<TName, unknown> when no payload.
 *
 * @example
 * // With payload
 * const userCreated = defineEvent("user.created").payload<{ id: string; name: string }>()
 * // typeof userCreated === EventDefinition<"user.created", { id: string; name: string }>
 *
 * @example
 * // Without payload
 * const ping = defineEvent("system.ping")
 * // typeof ping === EventDefinition<"system.ping", unknown>
 */
export function defineEvent<const TName extends string>(
  name: TName
): EventDefinitionBuilder<TName> {
  const def = { name } as EventDefinition<TName, unknown>;
  Object.defineProperty(def, '__brand', {
    value: EVENT_DEFINITION_BRAND,
    writable: false,
    enumerable: false,
    configurable: false,
  });

  const builder = def as unknown as EventDefinitionBuilder<TName>;
  Object.defineProperty(builder, 'payload', {
    value: <TPayload>(): EventDefinition<TName, TPayload> => {
      const defWithPayload = { name } as EventDefinition<TName, TPayload>;
      Object.defineProperty(defWithPayload, '__brand', {
        value: EVENT_DEFINITION_BRAND,
        writable: false,
        enumerable: false,
        configurable: false,
      });
      return defWithPayload;
    },
    writable: false,
    enumerable: false,
    configurable: true,
  });

  return builder;
}

/**
 * Namespace definition input type.
 * Accepts EventDefinitionBuilder (from defineEvent), EventDefinition,
 * or nested DefineEventsOutput (for nested namespaces).
 * __prefix is added internally — not needed in input.
 */
export type DefineEventsInput<
  _TPrefix extends string,
  TDefs extends Record<
    string,
    | EventDefinition<string, unknown>
    | DefineEventsOutput<string, Record<string, EventDefinition<string, unknown>>>
  >,
> = {
  [K in keyof TDefs]: K extends '__prefix' ? never : TDefs[K];
};

/**
 * Namespace output type.
 * All event names are prefixed: `${TPrefix}.${K}`
 * Nested namespaces preserve their structure with updated prefixes.
 *
 * `__prefix` is runtime metadata (used by isEventNamespace and tests).
 * `__brand` is a phantom symbol (compile-time only, non-enumerable at runtime).
 */
export type DefineEventsOutput<
  TPrefix extends string,
  TDefs extends Record<
    string,
    | EventDefinition<string, unknown>
    | DefineEventsOutput<string, Record<string, EventDefinition<string, unknown>>>
  >,
> = {
  readonly __prefix: TPrefix;
} & {
  readonly [K in keyof TDefs as Exclude<K, '__prefix'>]: TDefs[K] extends EventDefinition<
    string,
    infer P
  >
    ? EventDefinition<`${TPrefix}.${K & string}`, P>
    : TDefs[K] extends DefineEventsOutput<string, infer TNested>
      ? DefineEventsOutput<`${TPrefix}.${K & string}`, TNested>
      : never;
};

/**
 * Create an event namespace.
 * Auto-composes prefix: defineEvents("user", { created: ... }) → "user.created"
 * Supports nested namespaces: defineEvents("user", { profile: defineEvents("profile", {...}) }) → "user.profile.*"
 *
 * @param prefix - Namespace prefix (e.g. "user", "order")
 * @param definitions - Event definition map, keys are relative names. Can include nested defineEvents calls.
 * @returns Namespace object with all event definitions
 *
 * @example
 * const userEvents = defineEvents("user", {
 *   created: defineEvent("created").payload<{ id: string; name: string }>(),
 *   deleted: defineEvent("deleted").payload<{ id: string }>(),
 *   updated: defineEvent("updated").payload<{ id: string; version: number }>(),
 * })
 * // userEvents.created.name === "user.created"
 * // userEvents.deleted.name === "user.deleted"
 *
 * @example
 * // Nested namespace
 * const userEvents = defineEvents("user", {
 *   profile: defineEvents("profile", {
 *     updated: defineEvent("updated").payload<{ version: number }>(),
 *   })
 * })
 * // userEvents.profile.updated.name === "user.profile.updated"
 * // userEvents.profile.__prefix === "user.profile"
 */
export function defineEvents<
  const TPrefix extends string,
  const TDefs extends Record<
    string,
    | EventDefinition<string, unknown>
    | DefineEventsOutput<string, Record<string, EventDefinition<string, unknown>>>
  >,
>(prefix: TPrefix, definitions: TDefs): DefineEventsOutput<TPrefix, TDefs> {
  const result = {} as DefineEventsOutput<TPrefix, TDefs>;

  Object.defineProperty(result, '__prefix', {
    value: prefix,
    writable: false,
    enumerable: false,
    configurable: false,
  });

  for (const key of Object.keys(definitions)) {
    if (key === '__prefix') continue;

    const value = (definitions as Record<string, unknown>)[key];

    // Check if it's a nested namespace (has __prefix and __brand)
    const isNestedNamespace =
      typeof value === 'object' && value !== null && '__prefix' in value && '__brand' in value;

    if (isNestedNamespace) {
      // It's a nested namespace, need to update its prefix
      const nestedNs = value as DefineEventsOutput<
        string,
        Record<string, EventDefinition<string, unknown>>
      >;
      const newPrefix = `${prefix}.${key}`;

      // Create a new namespace object with updated prefix
      const updatedNested = {} as DefineEventsOutput<
        string,
        Record<string, EventDefinition<string, unknown>>
      >;

      Object.defineProperty(updatedNested, '__prefix', {
        value: newPrefix,
        writable: false,
        enumerable: false,
        configurable: false,
      });

      // Copy all event definitions from nested namespace, updating their names
      for (const nestedKey of Object.keys(nestedNs)) {
        if (nestedKey === '__prefix' || nestedKey === '__brand') continue;

        const nestedValue = (nestedNs as Record<string, unknown>)[nestedKey];

        // Check if it's an EventDefinition
        if (
          typeof nestedValue === 'object' &&
          nestedValue !== null &&
          'name' in nestedValue &&
          '__brand' in nestedValue
        ) {
          const newName = `${newPrefix}.${nestedKey}`;
          const prefixedDef = { name: newName } as EventDefinition<string, unknown>;
          Object.defineProperty(prefixedDef, '__brand', {
            value: EVENT_DEFINITION_BRAND,
            writable: false,
            enumerable: false,
            configurable: false,
          });
          (updatedNested as Record<string, unknown>)[nestedKey] = prefixedDef;
        }
        // If it's another nested namespace, recurse (but we don't expect more than 2 levels in current type system)
      }

      Object.defineProperty(updatedNested, '__brand', {
        value: EVENT_NAMESPACE_BRAND,
        writable: false,
        enumerable: false,
        configurable: false,
      });

      (result as Record<string, unknown>)[key] = updatedNested;
    } else {
      // Regular EventDefinition
      const fullName = `${prefix}.${key}`;
      const prefixedDef = { name: fullName } as EventDefinition<string, unknown>;
      Object.defineProperty(prefixedDef, '__brand', {
        value: EVENT_DEFINITION_BRAND,
        writable: false,
        enumerable: false,
        configurable: false,
      });
      (result as Record<string, unknown>)[key] = prefixedDef;
    }
  }

  Object.defineProperty(result, '__brand', {
    value: EVENT_NAMESPACE_BRAND,
    writable: false,
    enumerable: false,
    configurable: false,
  });

  return result;
}

/**
 * Check if value is an EventDefinition.
 *
 * @param value - Value to check
 * @returns `true` if value is an EventDefinition (has name string and __brand symbol)
 */
export function isEventDefinition(value: unknown): value is EventDefinition<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof (value as Record<string, unknown>).name === 'string' &&
    '__brand' in value
  );
}

/**
 * Check if value is an EventNamespace.
 *
 * @param value - Value to check
 * @returns `true` if value is an EventNamespace (has __prefix string and __brand symbol)
 */
export function isEventNamespace(
  value: unknown
): value is EventNamespace<string, Record<string, EventDefinition<string, unknown>>> {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__prefix' in value &&
    typeof (value as Record<string, unknown>).__prefix === 'string' &&
    '__brand' in value
  );
}

/**
 * Extract payload type from EventDefinition (type-level only)
 */
export type PayloadOf<T> = T extends EventDefinition<string, infer P> ? P : never;

/**
 * Extract event name from EventDefinition (type-level only)
 */
export type NameOf<T> = T extends EventDefinition<infer N extends string, unknown> ? N : never;
