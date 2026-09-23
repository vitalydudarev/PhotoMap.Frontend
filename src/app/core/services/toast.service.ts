import {Injectable, signal} from '@angular/core';

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly tone: ToastTone;
}

const DISMISS_AFTER_MS = 4000;

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

  error(message: string): void {
    this.show(message, 'error');
  }

  dismiss(id: number): void {
    this.toasts.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  private show(message: string, tone: ToastTone): void {
    const id = this.nextId++;

    this.toasts.update((toasts) => [...toasts, {id, message, tone}]);

    setTimeout(() => this.dismiss(id), DISMISS_AFTER_MS);
  }
}
