import {Component, DestroyRef, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, NavigationEnd, Router, RouterOutlet} from '@angular/router';
import {filter} from 'rxjs';
import {SegmentedComponent, SegmentedOption} from 'src/app/shared/ui/segmented/segmented.component';

/** The path of the child route that shows each source, see `app.routes.ts`. */
export type DataSourcePath = 'yandex-disk' | 'dropbox';

export const DEFAULT_DATA_SOURCE: DataSourcePath = 'yandex-disk';

/** The page of the photo sources: the user picks one, and the page of that source shows under the picker. */
@Component({
  selector: 'app-data-sources',
  templateUrl: './data-sources.component.html',
  styleUrl: './data-sources.component.scss',
  imports: [RouterOutlet, SegmentedComponent],
})
export class DataSourcesComponent {
  readonly options: readonly SegmentedOption<DataSourcePath>[] = [
    {value: 'yandex-disk', label: 'Yandex.Disk', icon: 'cloud'},
    {value: 'dropbox', label: 'Dropbox', icon: 'box'},
  ];

  readonly selected = signal<DataSourcePath>(DEFAULT_DATA_SOURCE);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  constructor() {
    this.syncSelected();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.syncSelected());
  }

  select(path: DataSourcePath): void {
    this.selected.set(path);
    this.router.navigate([path], {relativeTo: this.route});
  }

  private syncSelected(): void {
    const path = this.route.firstChild?.snapshot?.routeConfig?.path;

    if (path === 'yandex-disk' || path === 'dropbox') {
      this.selected.set(path);
    }
  }
}
