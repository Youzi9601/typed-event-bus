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

// Internal metadata constants
export { newListenerEvent, removeListenerEvent } from './constants.js';

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
  EventName,
  EventNamesOf,
  EventNamespace,
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
