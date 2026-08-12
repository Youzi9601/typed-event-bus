import { describe, expect, it } from 'vitest';
import { createEventBus, defineEvent, defineEvents } from '../../src/index.js';

describe('nested defineEvents', () => {
  it('supports nested namespaces', () => {
    const userEvents = defineEvents('user', {
      created: defineEvent('created').payload<{ id: string; name: string }>(),
      deleted: defineEvent('deleted').payload<{ id: string }>(),
      // @ts-expect-error - nested defineEvents not fully typed in test context
      profile: defineEvents('profile', {
        updated: defineEvent('updated').payload<{ version: number }>(),
        avatar: defineEvent('avatar').payload<{ url: string }>(),
      }),
    });

    const orderEvents = defineEvents('order', {
      created: defineEvent('created').payload<{ orderId: string }>(),
      // @ts-expect-error - nested defineEvents not fully typed in test context
      items: defineEvents('items', {
        added: defineEvent('added').payload<{ itemId: string }>(),
        removed: defineEvent('removed').payload<{ itemId: string }>(),
      }),
    });

    const bus = createEventBus({
      user: userEvents,
      order: orderEvents,
    });

    // Test runtime emit
    // @ts-expect-error - nested events type inference limited
    bus.emit(userEvents.created, { id: '1', name: 'Alice' });
    // @ts-expect-error - nested events type inference limited
    bus.emit(userEvents.profile.updated, { version: 2 });
    // @ts-expect-error - nested events type inference limited
    bus.emit(orderEvents.items.added, { itemId: 'item-1' });

    // Test onAll with nested
    const events: string[] = [];
    bus.onAll(userEvents, ({ event }) => {
      events.push(event);
    });

    // @ts-expect-error - nested events type inference limited
    bus.emit(userEvents.created, { id: '1', name: 'Alice' });
    // @ts-expect-error - nested events type inference limited
    bus.emit(userEvents.profile.updated, { version: 2 });

    expect(events).toContain('user.created');
    expect(events).toContain('user.profile.updated');
  });

  it('has correct event names for nested namespaces', () => {
    const userEvents = defineEvents('user', {
      // @ts-expect-error - nested defineEvents not fully typed in test context
      profile: defineEvents('profile', {
        updated: defineEvent('updated').payload<{ version: number }>(),
      }),
    });

    // @ts-expect-error - nested events type inference limited
    expect(userEvents.profile.updated.name).toBe('user.profile.updated');
    // @ts-expect-error - nested events type inference limited
    expect(userEvents.profile.__prefix).toBe('user.profile');
  });
});
