import { bench, describe } from 'vitest';
import { createEventBus, defineEvent, defineEvents } from '../src/index.js';

const userCreated = defineEvent('user.created').payload<{ id: string; name: string }>();
const userEvents = defineEvents('user', {
  created: defineEvent('created').payload<{ id: string; name: string }>(),
  updated: defineEvent('updated').payload<{ id: string; version: number }>(),
  deleted: defineEvent('deleted').payload<{ id: string }>(),
});

describe('emit — sync', () => {
  bench('emit with one sync listener', () => {
    const bus = createEventBus(userCreated);
    bus.on(userCreated, () => {});
    bus.emit(userCreated, { id: '1', name: 'Alice' });
  });

  bench('emit with 5 sync listeners', () => {
    const bus = createEventBus(userCreated);
    for (let i = 0; i < 5; i++) {
      bus.on(userCreated, () => {});
    }
    bus.emit(userCreated, { id: '1', name: 'Alice' });
  });

  bench('emit with 10 sync listeners', () => {
    const bus = createEventBus(userCreated);
    for (let i = 0; i < 10; i++) {
      bus.on(userCreated, () => {});
    }
    bus.emit(userCreated, { id: '1', name: 'Alice' });
  });
});

describe('emit — async listeners', () => {
  bench('emit with one async listener', () => {
    const bus = createEventBus(userCreated);
    bus.on(userCreated, async () => {
      await Promise.resolve();
    });
    bus.emit(userCreated, { id: '1', name: 'Alice' });
  });

  bench('emit with 5 async listeners', () => {
    const bus = createEventBus(userCreated);
    for (let i = 0; i < 5; i++) {
      bus.on(userCreated, async () => {
        await Promise.resolve();
      });
    }
    bus.emit(userCreated, { id: '1', name: 'Alice' });
  });

  bench('emit with mixed 5 sync + 5 async', () => {
    const bus = createEventBus(userCreated);
    for (let i = 0; i < 5; i++) {
      bus.on(userCreated, () => {});
    }
    for (let i = 0; i < 5; i++) {
      bus.on(userCreated, async () => {
        await Promise.resolve();
      });
    }
    bus.emit(userCreated, { id: '1', name: 'Alice' });
  });
});

describe('emit — with middleware', () => {
  bench('emit with logging middleware (1 listener)', () => {
    const bus = createEventBus(userCreated);
    bus.use((_event, _payload, next) => {
      next();
    });
    bus.on(userCreated, () => {});
    bus.emit(userCreated, { id: '1', name: 'Alice' });
  });
});

describe('emitAsync', () => {
  bench('emitAsync with one async listener', async () => {
    const bus = createEventBus(userCreated);
    bus.on(userCreated, async () => {
      await Promise.resolve();
    });
    await bus.emitAsync(userCreated, { id: '1', name: 'Alice' });
  });

  bench('emitAsync with 5 async listeners', async () => {
    const bus = createEventBus(userCreated);
    for (let i = 0; i < 5; i++) {
      bus.on(userCreated, async () => {
        await Promise.resolve();
      });
    }
    await bus.emitAsync(userCreated, { id: '1', name: 'Alice' });
  });

  bench('emitAsync with 5 async listeners (sequential)', async () => {
    const bus = createEventBus(userCreated);
    for (let i = 0; i < 5; i++) {
      bus.on(userCreated, async () => {
        await Promise.resolve();
      });
    }
    await bus.emitAsync(userCreated, { id: '1', name: 'Alice' }, { sequential: true });
  });
});

describe('onAll (wildcard)', () => {
  bench('onAll with 3 events, emit one', () => {
    const bus = createEventBus(userEvents);
    bus.onAll(userEvents, () => {});
    bus.emit(userEvents.created, { id: '1', name: 'Alice' });
  });
});
