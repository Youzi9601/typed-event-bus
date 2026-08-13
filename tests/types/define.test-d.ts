/**
 * Type tests for defineEvent / defineEvents
 * These verify compile-time type inference
 */

import { expectTypeOf } from 'vitest';
import { defineEvent, defineEvents, type NameOf, type PayloadOf } from '../../src/index.js';

// Test defineEvent with payload
const userCreated = defineEvent('user.created').payload<{ id: string; name: string }>();
const userDeleted = defineEvent('user.deleted').payload<{ id: string }>();

// PayloadOf extracts payload type
type UserCreatedPayload = PayloadOf<typeof userCreated>;
type UserDeletedPayload = PayloadOf<typeof userDeleted>;

// NameOf extracts event name
type UserCreatedName = NameOf<typeof userCreated>;

expectTypeOf<UserCreatedPayload>().toEqualTypeOf<{ id: string; name: string }>();
expectTypeOf<UserDeletedPayload>().toEqualTypeOf<{ id: string }>();
expectTypeOf<UserCreatedName>().toEqualTypeOf<'user.created'>();

// Test defineEvent without payload
const ping = defineEvent('system.ping');
expectTypeOf<NameOf<typeof ping>>().toEqualTypeOf<'system.ping'>();
expectTypeOf<PayloadOf<typeof ping>>().toEqualTypeOf<unknown>();

// Test defineEvents with namespace prefix
const userEvents = defineEvents('user', {
  created: defineEvent('created').payload<{ id: string; name: string }>(),
  deleted: defineEvent('deleted').payload<{ id: string }>(),
  updated: defineEvent('updated').payload<{ id: string; version: number }>(),
});

// Verify prefixed names
expectTypeOf<NameOf<typeof userEvents.created>>().toEqualTypeOf<'user.created'>();
expectTypeOf<NameOf<typeof userEvents.deleted>>().toEqualTypeOf<'user.deleted'>();
expectTypeOf<NameOf<typeof userEvents.updated>>().toEqualTypeOf<'user.updated'>();

// Verify payload types preserved
expectTypeOf<PayloadOf<typeof userEvents.created>>().toEqualTypeOf<{ id: string; name: string }>();
expectTypeOf<PayloadOf<typeof userEvents.deleted>>().toEqualTypeOf<{ id: string }>();
expectTypeOf<PayloadOf<typeof userEvents.updated>>().toEqualTypeOf<{
  id: string;
  version: number;
}>();

// Test namespace structure
expectTypeOf(userEvents.__prefix).toEqualTypeOf<'user'>();
