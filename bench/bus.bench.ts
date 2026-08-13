import { bench, describe } from 'vitest';
import { createEventBus, defineEvent } from '../src/index.js';

const userCreated = defineEvent('user.created').payload<{ id: string; name: string }>();
const bus = createEventBus(userCreated);
bus.on(userCreated, () => {});

describe('emit', () => {
  bench('emit with one listener', () => {
    bus.emit(userCreated, { id: '1', name: 'Alice' });
  });
});
