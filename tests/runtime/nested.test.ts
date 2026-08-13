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

    // Test runtime emit
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

  it('supports three-level nested namespaces', () => {
    const deep = defineEvents('user', {
      profile: defineEvents('profile', {
        settings: defineEvents('settings', {
          theme: defineEvent('theme').payload<{ dark: boolean }>(),
          language: defineEvent('language').payload<{ code: string }>(),
        }),
      }),
    });

    expect(deep.__prefix).toBe('user');
    expect(deep.profile.__prefix).toBe('user.profile');
    expect(deep.profile.settings.__prefix).toBe('user.profile.settings');
    expect(deep.profile.settings.theme.name).toBe('user.profile.settings.theme');
    expect(deep.profile.settings.language.name).toBe('user.profile.settings.language');
  });

  it('supports mixed nodes (events and namespaces at the same level)', () => {
    const mixed = defineEvents('user', {
      created: defineEvent('created').payload<{ id: string; name: string }>(),
      profile: defineEvents('profile', {
        updated: defineEvent('updated').payload<{ version: number }>(),
        settings: defineEvents('settings', {
          theme: defineEvent('theme').payload<{ dark: boolean }>(),
        }),
      }),
      deleted: defineEvent('deleted').payload<{ id: string }>(),
    });

    expect(mixed.created.name).toBe('user.created');
    expect(mixed.deleted.name).toBe('user.deleted');
    expect(mixed.profile.__prefix).toBe('user.profile');
    expect(mixed.profile.updated.name).toBe('user.profile.updated');
    expect(mixed.profile.settings.__prefix).toBe('user.profile.settings');
    expect(mixed.profile.settings.theme.name).toBe('user.profile.settings.theme');

    const bus = createEventBus(mixed);
    const seen: string[] = [];
    bus.onAll(mixed, ({ event }) => seen.push(event));
    bus.emit(mixed.created, { id: '1', name: 'Alice' });
    bus.emit(mixed.profile.updated, { version: 2 });
    bus.emit(mixed.profile.settings.theme, { dark: true });
    bus.emit(mixed.deleted, { id: '2' });

    expect(seen).toEqual([
      'user.created',
      'user.profile.updated',
      'user.profile.settings.theme',
      'user.deleted',
    ]);
  });
});
