/**
 * typed-event-bus — Define Once, Use Everywhere
 *
 * Type-safe event bus with zero duplicate declarations.
 * Single source of truth: EventDefinition
 *
 * @packageDocumentation
 */

// Core types
export type {
  EventDefinition,
  EventNamespace,
  EventRegistry,
  AllEventsOf,
  AllEventNamesOf,
  EventsOf,
  EventName,
  EventPayload,
  Listener,
  WildcardHandler,
  Subscription,
  ErrorHandler,
  Middleware,
  BusOptions,
  EventDefinitionInput,
  EventNamespaceInput,
  SyncListener,
  AsyncListener,
  PayloadOf,
  NameOf,
} from './types.js';

// Event definition API
export {
  defineEvent,
  defineEvents,
  isEventDefinition,
  isEventNamespace,
  type EventDefinitionBuilder,
} from './define.js';

// Bus API
export {
  createEventBus,
  type EventBus,
} from './bus.js';

// Subscription
export {
  EventSubscription,
  createSubscription,
} from './subscription.js';

// Error handling
export {
  MultiError,
  defaultErrorHandler,
  executeListenerSafely,
  executeAsyncListenerSafely,
} from './errors.js';

// Middleware
export {
  executeMiddleware,
  createLoggingMiddleware,
  createTimingMiddleware,
  createMetricsMiddleware,
} from './middleware.js';
