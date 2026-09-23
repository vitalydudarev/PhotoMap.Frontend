import {ChangeDetectionStrategy, Component, computed, input, output} from '@angular/core';

import {ButtonDirective} from '../button/button.directive';
import {IconComponent} from '../icon/icon.component';

export interface PageEvent {
  pageIndex: number;
  pageSize: number;
}

@Component({
  selector: 'app-paginator',
  templateUrl: './paginator.component.html',
  styleUrl: './paginator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective, IconComponent],
})
export class PaginatorComponent {
  readonly length = input(0);
  readonly pageIndex = input(0);
  readonly pageSize = input(50);
  readonly pageSizeOptions = input<readonly number[]>([]);

  readonly page = output<PageEvent>();

  readonly lastPageIndex = computed(() => Math.max(0, Math.ceil(this.length() / this.pageSize()) - 1));
  readonly isFirstPage = computed(() => this.pageIndex() <= 0);
  readonly isLastPage = computed(() => this.pageIndex() >= this.lastPageIndex());

  readonly rangeLabel = computed(() => {
    const length = this.length();

    if (length === 0) {
      return 'No items';
    }

    const start = this.pageIndex() * this.pageSize();
    const end = Math.min(start + this.pageSize(), length);

    return `${(start + 1).toLocaleString()}–${end.toLocaleString()} of ${length.toLocaleString()}`;
  });

  goToPage(pageIndex: number): void {
    const target = Math.min(Math.max(pageIndex, 0), this.lastPageIndex());

    if (target !== this.pageIndex()) {
      this.page.emit({pageIndex: target, pageSize: this.pageSize()});
    }
  }

  changePageSize(rawValue: string): void {
    const pageSize = Number(rawValue);

    if (!Number.isFinite(pageSize) || pageSize === this.pageSize()) {
      return;
    }

    // Keep the first visible item on screen rather than jumping back to page one.
    const firstVisibleItem = this.pageIndex() * this.pageSize();

    this.page.emit({pageIndex: Math.floor(firstVisibleItem / pageSize), pageSize});
  }
}
