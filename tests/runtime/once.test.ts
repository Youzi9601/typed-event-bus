/**
 * Runtime tests for once
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventBus, defineEvent } from '../../src/index';

describe('once', () => {
  let bus: ReturnType<typeof createEventBus>;
  const userCreated = defineEvent('user.created').payload<{ id: string; name: string }>();

  beforeEach(() => {
    bus = createEventBus(userCreated);
  });

  it('calls listener only once', () => {
    const listener = vi.fn();
    bus.once(userCreated, listener);

    bus.emit(userCreated, { id: '1', name: 'Alice' });
    bus.emit(userCreated, { id: '2', name: 'Bob' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ id: '1', name: 'Alice' });
  });

  it('returns Subscription that can unsubscribe before first emit', () => {
    const listener = vi.fn();
    const sub = bus.once(userCreated, listener);

    sub.unsubscribe();
    bus.emit(userCreated, { id: '1', name: 'Alice' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('works with async listener', async () => {
    const listener = vi.fn(async (_payload: { id: string; name: string }) => {
      await new Promise(r => setTimeout(r, 10));
    });

    bus.once(userCreated, listener);

    await bus.emitAsync(userCreated, { id: '1', name: 'Alice' });
    await bus.emitAsync(userCreated, { id: '2', name: 'Bob' });

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
