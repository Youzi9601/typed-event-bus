import { describe, expect, it } from 'vitest';
import { createEventBus, defineEvent, defineEvents } from '../../src/index.js';

describe('nested defineEvents', () => {
  it('supports nested namespaces', () => {
    const userEvents = defineEvents('user', {
      created: defineEvent('created').payload<{ id: string; name: string }>(),
      deleted: defineEvent('deleted').payload<{ id: string }>(),
      profile: defineEvents('profile', {
        updated: defineEvent('updated').payload<{ version: number }>(),
        avatar: defineEvent('avatar').payload<{ url: string }>(),
      }),
    });

    const orderEvents = defineEvents('order', {
      created: defineEvent('created').payload<{ orderId: string }>(),
      items: defineEvents('items', {
        added: defineEvent('added').payload<{ itemId: string }>(),
        removed: defineEvent('removed').payload<{ itemId: string }>(),
      }),
    });

    const bus = createEventBus({
      user: userEvents,
      order: orderEvents,
    });

    // Test type inference at runtime
    bus.emit(userEvents.created, { id: '1', name: 'Alice' });
    bus.emit(userEvents.profile.updated, { version: 2 });
    bus.emit(orderEvents.items.added, { itemId: 'item-1' });

    // Test onAll with nested
    const events: string[] = [];
    bus.onAll(userEvents, ({ event }) => {
      events.push(event);
    });

    bus.emit(userEvents.created, { id: '1', name: 'Alice' });
    bus.emit(userEvents.profile.updated, { version: 2 });

    expect(events).toContain('user.created');
    expect(events).toContain('user.profile.updated');
  });

  it('has correct event names for nested namespaces', () => {
    const userEvents = defineEvents('user', {
      profile: defineEvents('profile', {
        updated: defineEvent('updated').payload<{ version: number }>(),
      }),
    });

    expect(userEvents.profile.updated.name).toBe('user.profile.updated');
    expect(userEvents.profile.__prefix).toBe('user.profile');
  });
});
