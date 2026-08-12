import { createEventBus, defineEvent, defineEvents } from '../../src/index.js';

// Setup
const userCreated = defineEvent('user.created').payload<{ id: string; name: string }>();
const userDeleted = defineEvent('user.deleted').payload<{ id: string }>();
const orderPaid = defineEvent('order.paid').payload<{ orderId: string; amount: number }>();

const bus = createEventBus({
  user: defineEvents('user', {
    created: defineEvent('created').payload<{ id: string; name: string }>(),
    deleted: defineEvent('deleted').payload<{ id: string }>(),
  }),
  order: defineEvents('order', {
    paid: defineEvent('paid').payload<{ orderId: string; amount: number }>(),
  }),
});

// emit - correct payload should pass
bus.emit(userCreated, { id: '1', name: 'Alice' });
bus.emit(userDeleted, { id: '2' });
bus.emit(orderPaid, { orderId: 'ORD-1', amount: 100 });

// emit - incorrect payload should fail (these lines should cause type errors if uncommented)
// @ts-expect-error
bus.emit(userCreated, { id: 1, name: 'Alice' }); // id should be string
// @ts-expect-error
bus.emit(userCreated, { id: '1' }); // missing name
// @ts-expect-error
bus.emit(userCreated, { id: '1', name: 'Alice', extra: true }); // extra property
// @ts-expect-error
bus.emit(userDeleted, { id: '1', name: 'Bob' }); // extra property
// @ts-expect-error
bus.emit(orderPaid, { orderId: 'ORD-1' }); // missing amount

// emitAsync - same type checking
await bus.emitAsync(userCreated, { id: '1', name: 'Alice' });
await bus.emitAsync(userDeleted, { id: '2' });
await bus.emitAsync(orderPaid, { orderId: 'ORD-1', amount: 100 });

// @ts-expect-error
await bus.emitAsync(userCreated, { id: 1, name: 'Alice' });
