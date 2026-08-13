import { BRAND_KEY, PREFIX_KEY } from './constants.js';
import type { EventDefinition } from './types.js';

const EVENT_DEFINITION_BRAND = Symbol('EventDefinition');
const EVENT_NAMESPACE_BRAND = Symbol('EventNamespace');

/** Define a non-enumerable, read-only property (metadata / phantom brand) */
function markNonEnumerable<T extends object>(obj: T, key: PropertyKey, value: unknown): T {
  Object.defineProperty(obj, key, {
    value,
    writable: false,
    enumerable: false,
    configurable: false,
  });
  return obj;
}

function markBrand<T extends object>(obj: T, brand: symbol): T {
  return markNonEnumerable(obj, BRAND_KEY, brand);
}

function markPrefix<T extends object>(obj: T, prefix: string): T {
  return markNonEnumerable(obj, PREFIX_KEY, prefix);
}

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
  const def = createEventDefinition(name) as EventDefinition<TName, unknown>;

  const builder = def as unknown as EventDefinitionBuilder<TName>;
  Object.defineProperty(builder, 'payload', {
    value: <TPayload>(): EventDefinition<TName, TPayload> => {
      return createEventDefinition(name) as EventDefinition<TName, TPayload>;
    },
    writable: false,
    enumerable: false,
    configurable: true,
  });

  return builder;
}

/**
 * Namespace output type.
 * All event names are prefixed: `${TPrefix}.${K}`
 * Nested namespaces recurse with an updated prefix, supporting arbitrary depth
 * and mixed nodes (events and namespaces at the same level).
 *
 * `__prefix` is runtime metadata (used by isEventNamespace and tests).
 * `__brand` is a phantom symbol (compile-time only, non-enumerable at runtime).
 */
export type DefineEventsOutput<TPrefix extends string, TDefs extends Record<string, unknown>> = {
  readonly [PREFIX_KEY]: TPrefix;
} & {
  readonly [K in keyof TDefs as K extends typeof PREFIX_KEY | typeof BRAND_KEY
    ? never
    : K]: TDefs[K] extends EventDefinition<string, infer P>
    ? EventDefinition<`${TPrefix}.${K & string}`, P>
    : TDefs[K] extends DefineEventsOutput<infer _N extends string, infer TN>
      ? DefineEventsOutput<`${TPrefix}.${K & string}`, TN>
      : TDefs[K];
};

function createEventDefinition(name: string): EventDefinition<string, unknown> {
  return markBrand({ name } as EventDefinition<string, unknown>, EVENT_DEFINITION_BRAND);
}

/**
 * Build a namespace: prefix every key's event name, recursing into nested
 * namespaces and re-prefixing already-defined events. Shared by defineEvents
 * (fresh definitions) and re-prefixing (embedding an existing namespace).
 */
function buildNamespace(prefix: string, source: Record<string, unknown>): Record<string, unknown> {
  const result = markPrefix({} as Record<string, unknown>, prefix);

  for (const key of Object.keys(source)) {
    if (key === PREFIX_KEY || key === BRAND_KEY) continue;

    const value = source[key];

    if (isEventNamespace(value)) {
      result[key] = buildNamespace(`${prefix}.${key}`, value as Record<string, unknown>);
    } else if (isEventDefinition(value)) {
      result[key] = createEventDefinition(`${prefix}.${key}`);
    } else {
      result[key] = value;
    }
  }

  return markBrand(result, EVENT_NAMESPACE_BRAND);
}

/**
 * Create an event namespace.
 * Auto-composes prefix: defineEvents("user", { created: ... }) → "user.created"
 * Supports nested namespaces at arbitrary depth:
 *   defineEvents("user", { profile: defineEvents("profile", {...}) }) → "user.profile.*"
 * Mixed nodes (events and namespaces at the same level) are supported.
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
  const TDefs extends Record<string, unknown>,
>(prefix: TPrefix, definitions: TDefs): DefineEventsOutput<TPrefix, TDefs> {
  return buildNamespace(prefix, definitions as Record<string, unknown>) as DefineEventsOutput<
    TPrefix,
    TDefs
  >;
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
    BRAND_KEY in value
  );
}

/**
 * Check if value is an EventNamespace.
 *
 * The runtime check only verifies the namespace brand (a string `__prefix` and
 * the namespace symbol), so the type predicate narrows to that shape rather
 * than claiming every property is an EventDefinition — properties may be
 * EventDefinitions, nested namespaces, or plain values, and must be checked
 * individually.
 *
 * @param value - Value to check
 * @returns `true` if value is an EventNamespace (has __prefix string and __brand symbol)
 */
export function isEventNamespace(
  value: unknown
): value is { readonly [PREFIX_KEY]: string } & Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    PREFIX_KEY in value &&
    typeof (value as Record<string, unknown>)[PREFIX_KEY] === 'string' &&
    BRAND_KEY in value
  );
}
