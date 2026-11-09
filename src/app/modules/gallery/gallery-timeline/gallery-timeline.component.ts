import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {PhotoMonth, photoMonthKey} from 'src/app/core/models/photo-month.model';

/** A year of the timeline, with its months, in the order the photos are shown in. */
interface TimelineYear {
  year: number;
  count: number;
  months: TimelineMonth[];
}

interface TimelineMonth extends PhotoMonth {
  key: string;
  /** Short, such as `Mar`. */
  name: string;
  /** For the title and the screen readers, such as `March 2019, 1,120 photos`. */
  label: string;
}

/** The heights of the rows, in pixels, as the styles set them, gaps included, to tell how many months fit. */
const YEAR_ROW_HEIGHT = 26;
const MONTH_ROW_HEIGHT = 18;
/** The gaps above and below the months of a year. */
const MONTHS_PADDING = 6;

const SHORT_MONTH = new Intl.DateTimeFormat(undefined, {month: 'short', timeZone: 'UTC'});
const LONG_MONTH = new Intl.DateTimeFormat(undefined, {month: 'long', year: 'numeric', timeZone: 'UTC'});
const COUNT = new Intl.NumberFormat();

/**
 * The years and the months the photos were taken in, down the right side of the gallery, to go to one. The months are
 * shown under every year that they fit under, the year in view first.
 */
@Component({
  selector: 'app-gallery-timeline',
  templateUrl: './gallery-timeline.component.html',
  styleUrls: ['./gallery-timeline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalleryTimelineComponent {
  /** The months, in the order the photos are shown in. */
  readonly months = input.required<readonly PhotoMonth[]>();

  /** The key of the month of the photos in view, see `photoMonthKey`. */
  readonly active = input<string | null>(null);

  /** The user picked a month, or a year, to go to its first month. */
  readonly monthSelect = output<PhotoMonth>();

  readonly years = computed(() => {
    const years: TimelineYear[] = [];

    for (const month of this.months()) {
      let year = years.at(-1);

      if (year?.year !== month.year) {
        year = {year: month.year, count: 0, months: []};
        years.push(year);
      }

      const date = new Date(Date.UTC(month.year, month.month - 1, 1));

      year.count += month.count;
      year.months.push({
        ...month,
        key: photoMonthKey(month.year, month.month),
        name: SHORT_MONTH.format(date),
        label: `${LONG_MONTH.format(date)}, ${this.countLabel(month.count)}`,
      });
    }

    return years;
  });

  readonly activeYear = computed(() => {
    const active = this.active();

    return active === null ? null : Number(active.split('-')[0]);
  });

  /** The height the years and the months can take, in pixels, without the timeline scrolling. */
  readonly availableHeight = signal(0);

  /**
   * The years whose months are shown: every one of them when they fit, otherwise as many as fit of the year in view
   * and the years nearest to it. The others show the year alone.
   */
  readonly expandedYears = computed(() => {
    const years = this.years();
    const expanded = new Set<number>();

    if (years.length === 0) {
      return expanded;
    }

    let left = this.availableHeight() - years.length * YEAR_ROW_HEIGHT;
    const activeYear = this.activeYear();
    const start = Math.max(
      0,
      years.findIndex((year) => year.year === activeYear),
    );

    // the year in view first, then the years after and before it, nearest first
    const order = years
      .map((year, index) => ({year, distance: Math.abs(index - start) * 2 + (index < start ? 1 : 0)}))
      .sort((a, b) => a.distance - b.distance)
      .map(({year}) => year);

    for (const year of order) {
      const height = year.months.length * MONTH_ROW_HEIGHT + MONTHS_PADDING;

      if (height > left) {
        break;
      }

      left -= height;
      expanded.add(year.year);
    }

    return expanded;
  });

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const host = this.element.nativeElement;
      const observer = new ResizeObserver(() => {
        const style = getComputedStyle(host);

        this.availableHeight.set(host.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom));
      });

      observer.observe(host);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });

    // the year in view is kept in view on the timeline too, which is taller than the window when even the years do not fit
    effect(() => {
      const year = this.activeYear();

      if (year === null) {
        return;
      }

      requestAnimationFrame(() => this.reveal(year));
    });
  }

  countLabel(count: number): string {
    return `${COUNT.format(count)} ${count === 1 ? 'photo' : 'photos'}`;
  }

  private reveal(year: number): void {
    const host = this.element.nativeElement;
    const item = host.querySelector<HTMLElement>(`[data-year="${year}"]`);

    if (!item) {
      return;
    }

    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;

    if (top < host.scrollTop) {
      host.scrollTo({top});
    } else if (bottom > host.scrollTop + host.clientHeight) {
      host.scrollTo({top: Math.max(top, bottom - host.clientHeight)});
    }
  }
}
