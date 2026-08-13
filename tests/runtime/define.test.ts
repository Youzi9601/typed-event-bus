/**
 * Runtime tests for defineEvent / defineEvents
 */

import { describe, expect, it } from 'vitest';
import { defineEvent, defineEvents, isEventDefinition, isEventNamespace } from '../../src/define';

describe('defineEvent', () => {
  it('creates EventDefinition with correct name', () => {
    const userCreated = defineEvent('user.created').payload<{ id: string }>();
    expect(userCreated.name).toBe('user.created');
  });

  it('has __brand property (non-enumerable)', () => {
    const userCreated = defineEvent('user.created').payload<{ id: string }>();
    expect(Object.hasOwn(userCreated, '__brand')).toBe(true);
    expect(Object.keys(userCreated)).not.toContain('__brand');
  });

  it('isEventDefinition returns true', () => {
    const userCreated = defineEvent('user.created').payload<{ id: string }>();
    expect(isEventDefinition(userCreated)).toBe(true);
  });

  it('isEventDefinition returns false for plain object', () => {
    expect(isEventDefinition({ name: 'test' })).toBe(false);
    expect(isEventDefinition(null)).toBe(false);
    expect(isEventDefinition('string')).toBe(false);
  });

  it('works without payload (unknown)', () => {
    const ping = defineEvent('system.ping');
    expect(ping.name).toBe('system.ping');
    expect(isEventDefinition(ping)).toBe(true);
  });
});

describe('defineEvents', () => {
  it('creates namespace with prefixed event names', () => {
    const userEvents = defineEvents('user', {
      created: defineEvent('created').payload<{ id: string; name: string }>(),
      deleted: defineEvent('deleted').payload<{ id: string }>(),
      updated: defineEvent('updated').payload<{ id: string; version: number }>(),
    });

    expect(userEvents.__prefix).toBe('user');
    expect(userEvents.created.name).toBe('user.created');
    expect(userEvents.deleted.name).toBe('user.deleted');
    expect(userEvents.updated.name).toBe('user.updated');
  });

  it('isEventNamespace returns true', () => {
    const userEvents = defineEvents('user', {
      created: defineEvent('created').payload<{ id: string }>(),
    });
    expect(isEventNamespace(userEvents)).toBe(true);
  });

  it('isEventNamespace returns false for plain object', () => {
    expect(isEventNamespace({ __prefix: 'user' })).toBe(false);
    expect(isEventNamespace(null)).toBe(false);
  });

  it('each event in namespace is EventDefinition', () => {
    const userEvents = defineEvents('user', {
      created: defineEvent('created').payload<{ id: string }>(),
    });
    expect(isEventDefinition(userEvents.created)).toBe(true);
  });
});

describe('PayloadOf / NameOf type utilities', () => {
  it('type utilities work at runtime (basic check)', () => {
    const userCreated = defineEvent('user.created').payload<{ id: string; name: string }>();
    // These are compile-time only, but we can verify the definition exists
    expect(userCreated).toBeDefined();
  });
});
