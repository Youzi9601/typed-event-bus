import type { EventBus } from './bus.js';
import type { Listener, Subscription } from './types.js';

/**
 * Subscription implementation.
 * Provides unsubscribe() as primary API, AbortSignal as optional integration.
 */
export class EventSubscription implements Subscription {
  private _unsubscribed = false;
  private _listener: Listener<unknown>;
  private _eventName: string;
  private _bus: EventBus;
  private _signal?: AbortSignal;

  /**
   * Create a new subscription.
   * @param bus - EventBus instance
   * @param eventName - Event name string
   * @param listener - Listener function
   * @param signal - Optional AbortSignal for external cancellation
   */
  constructor(bus: EventBus, eventName: string, listener: Listener<unknown>, signal?: AbortSignal) {
    this._bus = bus;
    this._eventName = eventName;
    this._listener = listener;
    this._signal = signal;

    if (signal) {
      if (signal.aborted) {
        this.unsubscribe();
      } else {
        signal.addEventListener('abort', () => this.unsubscribe(), { once: true });
      }
    }
  }

  /** Unsubscribe — primary API */
  unsubscribe(): void {
    if (this._unsubscribed) return;
    this._unsubscribed = true;
    this._bus.off(this._eventName, this._listener);
  }

  /** Optional AbortSignal integration */
  get signal(): AbortSignal | undefined {
    return this._signal;
  }

  /** Check if subscription has been cancelled */
  get unsubscribed(): boolean {
    return this._unsubscribed;
  }
}

/**
 * Create subscription object.
 *
 * @param bus - EventBus instance
 * @param eventName - Event name string
 * @param listener - Listener function
 * @param signal - Optional AbortSignal for external cancellation
 * @returns EventSubscription instance
 */
export function createSubscription(
  bus: EventBus,
  eventName: string,
  listener: Listener<unknown>,
  signal?: AbortSignal
): EventSubscription {
  return new EventSubscription(bus, eventName, listener, signal);
}
