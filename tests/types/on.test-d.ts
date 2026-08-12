/**
 * Type tests for on / once
 */

import { expectTypeOf } from 'vitest';
import { createEventBus, defineEvent, defineEvents } from '../../src/index.js';

// Setup
const userCreated = defineEvent('user.created').payload<{ id: string; name: string }>();
const userDeleted = defineEvent('user.deleted').payload<{ id: string }>();

const bus = createEventBus({
  user: defineEvents('user', {
    created: defineEvent('created').payload<{ id: string; name: string }>(),
    deleted: defineEvent('deleted').payload<{ id: string }>(),
  }),
});

// on - listener payload correctly inferred
bus.on(userCreated, _payload => {
  expectTypeOf(_payload).toEqualTypeOf<{ id: string; name: string }>();
  const _id: string = _payload.id;
  const _name: string = _payload.name;
});

bus.on(userDeleted, _payload => {
  expectTypeOf(_payload).toEqualTypeOf<{ id: string }>();
  const _id: string = _payload.id;
});

// once - same inference
bus.once(userCreated, _payload => {
  expectTypeOf(_payload).toEqualTypeOf<{ id: string; name: string }>();
});

// async listeners - same inference
bus.on(userCreated, async _payload => {
  expectTypeOf(_payload).toEqualTypeOf<{ id: string; name: string }>();
  await Promise.resolve();
});

bus.once(userCreated, async _payload => {
  expectTypeOf(_payload).toEqualTypeOf<{ id: string; name: string }>();
  await Promise.resolve();
});

// Test that listener parameter is correctly typed
const listener = (_payload: { id: string; name: string }) => {};
bus.on(userCreated, listener);

// incompatible listener (id: number vs id: string)
const badListener = (_payload: { id: number }) => {};
// @ts-expect-error - badListener has id: number, but userCreated expects { id: string; name: string }
bus.on(userCreated, badListener);
