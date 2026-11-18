import {NgTemplateOutlet} from '@angular/common';
import {Component, TemplateRef, computed, contentChild, input, signal} from '@angular/core';
import {DuplicateSection, OTHER_FOLDERS_KEY} from 'src/app/core/helpers/duplicate-sections.helper';
import {IconComponent} from 'src/app/shared/ui/icon/icon.component';

import {ScrollControlComponent} from '../scroll-control/scroll-control.component';

/**
 * The sections of the groups of copies, by the folders the copies are in, each one opened and closed on its own. A
 * single section starts open, several start closed so that the page opens as a short list of them. The groups of an
 * open section are laid out as cards by the `card` template, under what the `actions` template puts at its top.
 */
@Component({
  selector: 'app-duplicate-sections',
  templateUrl: './duplicate-sections.component.html',
  styleUrls: ['./duplicate-sections.component.scss'],
  imports: [IconComponent, NgTemplateOutlet, ScrollControlComponent],
})
export class DuplicateSectionsComponent<G> {
  readonly sections = input.required<readonly DuplicateSection<G>[]>();

  /** Tells the groups apart, so that a card stays as it is while the others change. */
  readonly groupId = input.required<(group: G) => string>();

  /** What the copies are, such as `photos`. */
  readonly noun = input.required<string>();

  /** Lays out a group, given as `$implicit`. */
  readonly card = contentChild.required<TemplateRef<{$implicit: G}>>('card');

  /** Goes at the top of an open section, given as `$implicit`. */
  readonly actions = contentChild<TemplateRef<{$implicit: DuplicateSection<G>}>>('actions');

  /** The sections opened or closed by the user, by their key. */
  private readonly toggled = signal<ReadonlyMap<string, boolean>>(new Map());

  private readonly openByDefault = computed(() => this.sections().length === 1);

  readonly otherKey = OTHER_FOLDERS_KEY;

  isOpen(section: DuplicateSection<G>): boolean {
    return this.toggled().get(section.key) ?? this.openByDefault();
  }

  onToggle(section: DuplicateSection<G>, event: Event): void {
    const open = (event.target as HTMLDetailsElement).open;

    if (open !== this.isOpen(section)) {
      this.toggled.update((toggled) => new Map(toggled).set(section.key, open));
    }
  }

  setAll(open: boolean): void {
    this.toggled.set(new Map(this.sections().map((section) => [section.key, open])));
  }

  readonly allOpen = computed(() => this.sections().every((section) => this.isOpen(section)));
}
