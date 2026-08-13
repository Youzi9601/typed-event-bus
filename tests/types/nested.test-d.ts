/**
 * Type tests for nested namespaces and registry-level type utilities
 */

import { expectTypeOf } from 'vitest';
import {
  type AllEventNamesOf,
  type AllEventsOf,
  createEventBus,
  defineEvent,
  defineEvents,
  type EventNamesOf,
  type EventsOf,
  type NameOf,
  type PayloadOf,
} from '../../src/index.js';

// Two-level nesting
const userEvents = defineEvents('user', {
  created: defineEvent('created').payload<{ id: string; name: string }>(),
  profile: defineEvents('profile', {
    updated: defineEvent('updated').payload<{ version: number }>(),
  }),
});

// Three-level nesting
const deepEvents = defineEvents('app', {
  user: defineEvents('user', {
    profile: defineEvents('profile', {
      settings: defineEvents('settings', {
        theme: defineEvent('theme').payload<{ dark: boolean }>(),
      }),
    }),
  }),
});

// Mixed node: events and namespaces at the same level
const mixedEvents = defineEvents('user', {
  created: defineEvent('created').payload<{ id: string }>(),
  profile: defineEvents('profile', {
    updated: defineEvent('updated').payload<{ version: number }>(),
    settings: defineEvents('settings', {
      theme: defineEvent('theme').payload<{ dark: boolean }>(),
    }),
  }),
  deleted: defineEvent('deleted').payload<{ id: string }>(),
});

// Nested event names are full paths
expectTypeOf<NameOf<typeof userEvents.profile.updated>>().toEqualTypeOf<'user.profile.updated'>();
expectTypeOf<
  NameOf<typeof deepEvents.user.profile.settings.theme>
>().toEqualTypeOf<'app.user.profile.settings.theme'>();
expectTypeOf<
  NameOf<typeof mixedEvents.profile.settings.theme>
>().toEqualTypeOf<'user.profile.settings.theme'>();
expectTypeOf<NameOf<typeof mixedEvents.created>>().toEqualTypeOf<'user.created'>();

// Nested payload types are preserved
expectTypeOf<PayloadOf<typeof deepEvents.user.profile.settings.theme>>().toEqualTypeOf<{
  dark: boolean;
}>();

// __prefix carries the full path
expectTypeOf(userEvents.profile.__prefix).toEqualTypeOf<'user.profile'>();
expectTypeOf(
  deepEvents.user.profile.settings.__prefix
).toEqualTypeOf<'app.user.profile.settings'>();

// EventsOf includes nested events
expectTypeOf<EventsOf<typeof userEvents>['event']>().toEqualTypeOf<
  'user.created' | 'user.profile.updated'
>();
expectTypeOf<EventsOf<typeof mixedEvents>['event']>().toEqualTypeOf<
  'user.created' | 'user.profile.updated' | 'user.profile.settings.theme' | 'user.deleted'
>();
expectTypeOf<EventsOf<typeof mixedEvents>['payload']>().toEqualTypeOf<
  { id: string } | { version: number } | { dark: boolean } | { id: string }
>();

// EventNamesOf includes nested event names
expectTypeOf<EventNamesOf<typeof userEvents>>().toEqualTypeOf<
  'user.created' | 'user.profile.updated'
>();

// AllEventsOf / AllEventNamesOf work on namespace outputs (incl. nested)
expectTypeOf<AllEventNamesOf<typeof userEvents>>().toEqualTypeOf<
  'user.created' | 'user.profile.updated'
>();
expectTypeOf<AllEventsOf<typeof userEvents>['payload']>().toEqualTypeOf<
  { id: string; name: string } | { version: number }
>();
expectTypeOf<
  AllEventNamesOf<typeof deepEvents>
>().toEqualTypeOf<'app.user.profile.settings.theme'>();
expectTypeOf<AllEventsOf<typeof mixedEvents>['event']>().toEqualTypeOf<
  'user.created' | 'user.profile.updated' | 'user.profile.settings.theme' | 'user.deleted'
>();

// emit / on accept nested events with full type checking
const bus = createEventBus(mixedEvents);
bus.emit(mixedEvents.profile.settings.theme, { dark: true });
bus.on(mixedEvents.profile.updated, payload => {
  expectTypeOf(payload).toEqualTypeOf<{ version: number }>();
});
// @ts-expect-error - payload type mismatch on nested event
bus.emit(mixedEvents.profile.settings.theme, { dark: 'yes' });

// onAll narrows across nested events
bus.onAll(mixedEvents, ({ event, payload }) => {
  if (event === 'user.profile.settings.theme') {
    expectTypeOf(payload).toEqualTypeOf<{ dark: boolean }>();
  }
});

// AllEventsOf works on multi-namespace merges
const mergedRegistry = {
  user: userEvents,
  order: defineEvents('order', {
    placed: defineEvent('placed').payload<{ orderId: string }>(),
  }),
} as const;
expectTypeOf<AllEventNamesOf<typeof mergedRegistry>>().toEqualTypeOf<
  'user.created' | 'user.profile.updated' | 'order.placed'
>();
expectTypeOf<AllEventsOf<typeof mergedRegistry>['event']>().toEqualTypeOf<
  'user.created' | 'user.profile.updated' | 'order.placed'
>();
