import {HttpClient} from '@angular/common/http';
import {Injectable, computed, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {environment} from 'src/environments/environment';

import {ProcessingAvailability} from '../models/processing-availability.model';
import {NotificationHubService} from './notification-hub.service';

const DEFAULT_REASON = 'Processing is unavailable for now.';

/**
 * Whether photos and videos can be processed. Asked of the backend with `refresh`, then kept up to date by the
 * notification hub, which tells every change. Counted as available until the backend has said otherwise: the backend
 * rejects starting processing while it is not, whatever the page shows.
 */
@Injectable({providedIn: 'root'})
export class ProcessingAvailabilityService {
  private readonly httpClient = inject(HttpClient);

  private readonly state = signal<ProcessingAvailability>({available: true});

  readonly available = computed(() => this.state().available);
  readonly reason = computed(() => (this.state().available ? '' : this.state().reason || DEFAULT_REASON));

  constructor() {
    inject(NotificationHubService)
      .processingAvailability()
      .pipe(takeUntilDestroyed())
      .subscribe((availability) => this.state.set(availability));
  }

  refresh(): void {
    this.httpClient.get<ProcessingAvailability>(`${environment.photoMapApiUrl}/processing/availability`).subscribe({
      next: (availability) => this.state.set(availability),
      // the backend cannot be reached at all: the page tells that already, it is not about processing
      error: () => undefined,
    });
  }
}
