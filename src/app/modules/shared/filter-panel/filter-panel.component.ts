import {ChangeDetectionStrategy, Component, input, output} from '@angular/core';

import {ChecklistComponent} from 'src/app/shared/ui/checklist/checklist.component';

import {GalleryFilter} from './gallery-filter';

/** One filter the panel lists, as a checklist of its options. */
export interface FilterPanelItem {
  filter: GalleryFilter<number | string>;
  /** What the options are, such as "Sources"; it heads the checklist. */
  label: string;
  /** Whether the options start folded away under the label; true unless said otherwise. */
  collapsed?: boolean;
  /** Whether the options can be searched, for a list too long to scroll through. */
  searchable?: boolean;
  /** Whether the open list takes the rest of the height of the sidebar, such as the locations. */
  fill?: boolean;
}

export interface FilterPanelChange {
  filter: GalleryFilter<number | string>;
  values: readonly (number | string)[];
}

/**
 * The filters of a page with a sidebar, such as the gallery: the Filters heading, with a Reset button while any filter
 * is active, and a checklist for each filter given. What the panel holds besides, such as a note, goes above them.
 * The page owns the filters, so it sets what is picked as the panel tells, and loads what is picked.
 */
@Component({
  selector: 'app-filter-panel',
  templateUrl: './filter-panel.component.html',
  styleUrl: './filter-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChecklistComponent],
  host: {
    class: 'sidebar-section filters',
    role: 'group',
    '[attr.aria-labelledby]': 'headingId',
  },
})
export class FilterPanelComponent {
  /** The filters listed, in their order; those that do not apply at the moment are left out. */
  readonly items = input.required<readonly FilterPanelItem[]>();

  /** How many filters are active, the Reset button showing while there is any. */
  readonly activeCount = input(0);

  readonly filterChange = output<FilterPanelChange>();
  readonly resetFilters = output<void>();

  readonly headingId = `app-filter-panel-heading-${nextId++}`;
}

let nextId = 0;
