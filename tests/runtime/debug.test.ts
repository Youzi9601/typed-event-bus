/**
 * Runtime tests for debug / inspect methods
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createEventBus, defineEvent, defineEvents } from '../../src/index.js';

describe('debug / inspect', () => {
  const userEvents = defineEvents('user', {
    created: defineEvent('created').payload<{ id: string; name: string }>(),
    deleted: defineEvent('deleted').payload<{ id: string }>(),
  });

  const userCreated = userEvents.created;
  const userDeleted = userEvents.deleted;

  let bus: ReturnType<typeof createEventBus>;

  beforeEach(() => {
    bus = createEventBus(userEvents);
  });

  describe('debug()', () => {
    it('returns listener counts for each event', () => {
      bus.on(userCreated, () => {});
      bus.on(userCreated, () => {});
      bus.on(userDeleted, () => {});

      const info = bus.debug();

      expect(info.listenerCounts['user.created']).toBe(2);
      expect(info.listenerCounts['user.deleted']).toBe(1);
    });

    it('returns correct totals', () => {
      bus.on(userCreated, () => {});
      bus.on(userCreated, () => {});
      bus.on(userDeleted, () => {});

      const info = bus.debug();

      expect(info.totalListeners).toBe(3);
      expect(info.eventCount).toBe(2);
    });

    it('returns middleware count', () => {
      bus.use(() => {});
      bus.use(() => {});

      const info = bus.debug();

      expect(info.middlewareCount).toBe(2);
    });

    it('returns options snapshot', () => {
      const info = bus.debug();

      expect(info.options).toEqual({
        maxListeners: 10,
        debug: false,
      });
    });

    it('returns registry keys', () => {
      const info = bus.debug();

      expect(info.registryKeys).toContain('default');
    });

    it('is empty when no listeners', () => {
      const info = bus.debug();

      expect(info.totalListeners).toBe(0);
      expect(info.eventCount).toBe(0);
      expect(info.listenerCounts).toEqual({});
    });
  });

  describe('inspect()', () => {
    it('returns detailed listener info', () => {
      const listener1 = () => {};
      const listener2 = () => {};

      bus.on(userCreated, listener1);
      bus.on(userCreated, listener2);
      bus.on(userDeleted, () => {});

      const detail = bus.inspect();

      expect(detail.listeners).toHaveLength(2);

      const createdInfo = detail.listeners.find(l => l.event === 'user.created');
      expect(createdInfo).toBeDefined();
      expect(createdInfo?.listenerCount).toBe(2);
      expect(createdInfo?.onceCount).toBe(0);
      expect(createdInfo?.asyncCount).toBe(0);
      expect(createdInfo?.listeners).toContain(listener1);
      expect(createdInfo?.listeners).toContain(listener2);
    });

    it('counts once listeners separately', () => {
      bus.on(userCreated, () => {});
      bus.once(userCreated, () => {});

      const detail = bus.inspect();

      const createdInfo = detail.listeners.find(l => l.event === 'user.created');
      expect(createdInfo).toBeDefined();
      expect(createdInfo?.listenerCount).toBe(2);
      expect(createdInfo?.onceCount).toBe(1);
    });

    it('detects async listeners', () => {
      bus.on(userCreated, async () => {});
      bus.on(userCreated, () => {});

      const detail = bus.inspect();

      const createdInfo = detail.listeners.find(l => l.event === 'user.created');
      expect(createdInfo).toBeDefined();
      expect(createdInfo?.asyncCount).toBe(1);
    });

    it('includes middleware info', () => {
      const mw1 = (_event: unknown, _payload: unknown, next: () => void) => {
        next();
      };
      Object.defineProperty(mw1, 'name', { value: 'loggingMiddleware' });
      const mw2 = () => {};

      bus.use(mw1);
      bus.use(mw2);

      const detail = bus.inspect();

      expect(detail.middlewares).toHaveLength(2);
      expect(detail.middlewares[0]?.name).toBe('loggingMiddleware');
      // mw2 gets name from variable (function.name)
      expect(detail.middlewares[1]?.name).toBe('mw2');
    });

    it('includes options snapshot', () => {
      const detail = bus.inspect();

      expect(detail.options).toEqual({
        maxListeners: 10,
        debug: false,
        onError: expect.any(Function),
      });
    });

    it('includes registry', () => {
      const detail = bus.inspect();

      expect(detail.registry).toBeDefined();
      expect(detail.registry.default).toBeDefined();
    });

    it('is empty when no listeners', () => {
      const detail = bus.inspect();

      expect(detail.listeners).toHaveLength(0);
    });
  });
});
