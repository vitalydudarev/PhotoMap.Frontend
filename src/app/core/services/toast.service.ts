import {Injectable, signal} from '@angular/core';

import {errorMessage} from '../helpers/error-message.helper';

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly tone: ToastTone;
}

const DISMISS_AFTER_MS = 2500;
// Errors carry the reason too, and are worth the time to read it.
const ERROR_DISMISS_AFTER_MS = 3000;

/**
 * Holds the transient messages shown by `<app-toast-host />`, which AppComponent renders once
 * for the whole app.
 */
@Injectable({providedIn: 'root'})
export class ToastService {
  readonly toasts = signal<readonly Toast[]>([]);

  private nextId = 0;

  information(message: string): void {
    this.show(message, 'info');
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  /** Shows `message`, followed by the reason `error` gives when it is an error response from the server. */
  error(message: string, error?: unknown): void {
    this.show(errorMessage(message, error), 'error');
  }

  dismiss(id: number): void {
    this.toasts.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  private show(message: string, tone: ToastTone): void {
    // Several requests failing for one reason, such as the server being down, would otherwise stack copies.
    if (this.toasts().some((toast) => toast.message === message && toast.tone === tone)) {
      return;
    }

    const id = this.nextId++;

    this.toasts.update((toasts) => [...toasts, {id, message, tone}]);

    setTimeout(() => this.dismiss(id), tone === 'error' ? ERROR_DISMISS_AFTER_MS : DISMISS_AFTER_MS);
  }
}
