/**
 * typed-event-bus — Define Once, Use Everywhere
 *
 * Type-safe event bus with zero duplicate declarations.
 * Single source of truth: EventDefinition
 *
 * @packageDocumentation
 */

// Bus API
export {
  createEventBus,
  type EventBus,
} from './bus.js';

// Event definition API
export {
  defineEvent,
  defineEvents,
  type EventDefinitionBuilder,
  isEventDefinition,
  isEventNamespace,
} from './define.js';
// Error handling
export {
  defaultErrorHandler,
  executeAsyncListenerSafely,
  executeListenerSafely,
  MultiError,
} from './errors.js';
// Middleware
export {
  createLoggingMiddleware,
  createMetricsMiddleware,
  createTimingMiddleware,
  executeMiddleware,
} from './middleware.js';
// Subscription
export {
  createSubscription,
  EventSubscription,
} from './subscription.js';
// Core types
export type {
  AllEventNamesOf,
  AllEventsOf,
  AsyncListener,
  BusOptions,
  ErrorHandler,
  EventDefinition,
  EventDefinitionInput,
  EventName,
  EventNamespace,
  EventNamespaceInput,
  EventPayload,
  EventRegistry,
  EventsOf,
  Listener,
  Middleware,
  NameOf,
  PayloadOf,
  Subscription,
  SyncListener,
  WildcardHandler,
} from './types.js';
