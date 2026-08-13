/**
 * Type tests for Node EventEmitter parity APIs:
 * prependListener / prependOnceListener / rawListeners / meta events.
 */

import { expectTypeOf } from 'vitest';
import {
  createEventBus,
  defineEvent,
  type Listener,
  newListenerEvent,
  removeListenerEvent,
  type Subscription,
} from '../../src/index.js';

const userCreated = defineEvent('user.created').payload<{ id: string; name: string }>();
const bus = createEventBus(userCreated);

// prependListener infers payload and returns Subscription
const prependSub = bus.prependListener(userCreated, payload => {
  expectTypeOf(payload).toEqualTypeOf<{ id: string; name: string }>();
});
expectTypeOf(prependSub).toEqualTypeOf<Subscription>();

// prependOnceListener infers payload and returns Subscription
const prependOnceSub = bus.prependOnceListener(userCreated, payload => {
  expectTypeOf(payload).toEqualTypeOf<{ id: string; name: string }>();
});
expectTypeOf(prependOnceSub).toEqualTypeOf<Subscription>();

// rawListeners returns plain listener functions in order
expectTypeOf(bus.rawListeners(userCreated)).toEqualTypeOf<Listener<unknown>[]>();

// meta event definitions carry literal names and Listener payloads
expectTypeOf(newListenerEvent.name).toEqualTypeOf<'newListener'>();
expectTypeOf(removeListenerEvent.name).toEqualTypeOf<'removeListener'>();

// meta events can be subscribed with typed payload
bus.on(newListenerEvent, listener => {
  expectTypeOf(listener).toEqualTypeOf<Listener<unknown>>();
});
bus.on(removeListenerEvent, listener => {
  expectTypeOf(listener).toEqualTypeOf<Listener<unknown>>();
});
