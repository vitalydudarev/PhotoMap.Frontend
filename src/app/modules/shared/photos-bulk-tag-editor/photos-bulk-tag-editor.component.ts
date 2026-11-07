import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {PhotoTag, PhotoTags, TAG_MAX_LENGTH, TAGS_PER_PHOTO, cleanTagName, sameTag} from 'src/app/core/models/photo-tag.model';
import {ToastService} from 'src/app/core/services/toast.service';
import {UserPhotosService} from 'src/app/core/services/user-photos.service';
import {ButtonDirective} from 'src/app/shared/ui/button/button.directive';
import {IconComponent} from 'src/app/shared/ui/icon/icon.component';

/** An option of the list under the input: an existing tag to add, or a new one to make of what was typed. */
interface TagOption {
  name: string;
  isNew: boolean;
  photoCount?: number;
}

let nextId = 0;

/**
 * Adds tags to several photos at once. Unlike the editor of the tags of one photo, the tags are gathered first and
 * saved together, as the photos keep the tags they have, and taking a tag off is not done here.
 */
@Component({
  selector: 'app-photos-bulk-tag-editor',
  templateUrl: './photos-bulk-tag-editor.component.html',
  styleUrls: ['../photo-tag-editor/photo-tag-editor.component.scss', './photos-bulk-tag-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective, IconComponent],
  host: {
    role: 'dialog',
    '[attr.aria-label]': 'title()',
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class PhotosBulkTagEditorComponent {
  /** The IDs of the photos to add the tags to. */
  readonly photoIds = input.required<readonly string[]>();
  readonly userId = input.required<number>();

  /** The tags of the user, to pick from. */
  readonly existingTags = input<readonly PhotoTag[]>([]);

  /** The tags were added, and the photos have these tags now. */
  readonly saved = output<PhotoTags[]>();

  /** The user is done, without adding the tags. */
  readonly closed = output<void>();

  /** The tags to add. */
  readonly names = signal<readonly string[]>([]);

  readonly query = signal('');
  readonly saving = signal(false);
  readonly activeIndex = signal(0);

  readonly maxLength = TAG_MAX_LENGTH;
  readonly maxTags = TAGS_PER_PHOTO;
  readonly full = computed(() => this.names().length >= TAGS_PER_PHOTO);

  readonly title = computed(() => {
    const count = this.photoIds().length;

    return `Add tags to ${count} ${count === 1 ? 'photo' : 'photos'}`;
  });

  readonly listId = `photos-bulk-tag-options-${nextId++}`;

  /** The tags not picked yet, matching what is typed: those starting with it first, then the most used. */
  readonly options = computed<TagOption[]>(() => {
    const query = cleanTagName(this.query()).toLocaleLowerCase();
    const names = this.names();

    const existing = this.existingTags()
      .filter((tag) => !names.some((name) => sameTag(name, tag.name)))
      .filter((tag) => tag.name.toLocaleLowerCase().includes(query))
      .sort(
        (a, b) =>
          Number(b.name.toLocaleLowerCase().startsWith(query)) - Number(a.name.toLocaleLowerCase().startsWith(query)) ||
          b.photoCount - a.photoCount ||
          a.name.localeCompare(b.name),
      )
      .map<TagOption>((tag) => ({name: tag.name, isNew: false, photoCount: tag.photoCount}));

    const typed = cleanTagName(this.query());
    const known = typed.length === 0 || [...names, ...this.existingTags().map((tag) => tag.name)].some((name) => sameTag(name, typed));

    return known ? existing : [...existing, {name: typed, isNew: true}];
  });

  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');
  private readonly destroyRef = inject(DestroyRef);
  private readonly userPhotosService = inject(UserPhotosService);
  private readonly toastService = inject(ToastService);

  constructor() {
    afterNextRender(() => this.input()?.nativeElement.focus());
  }

  add(name: string): void {
    const clean = cleanTagName(name);

    if (clean.length === 0 || this.full() || this.names().some((tag) => sameTag(tag, clean))) {
      return;
    }

    this.query.set('');
    this.activeIndex.set(0);
    this.names.update((names) => [...names, clean]);
    this.input()?.nativeElement.focus();
  }

  remove(name: string): void {
    this.names.update((names) => names.filter((tag) => tag !== name));
  }

  onInput(value: string): void {
    this.query.set(value);
    this.activeIndex.set(0);
  }

  onKeydown(event: KeyboardEvent): void {
    const options = this.options();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.set(options.length === 0 ? 0 : (this.activeIndex() + 1) % options.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.set(options.length === 0 ? 0 : (this.activeIndex() - 1 + options.length) % options.length);
        break;
      case 'Enter': {
        event.preventDefault();
        // only what matches what is typed is picked, so that Enter on an empty input adds nothing by surprise
        const option = this.query().trim().length > 0 ? options[this.activeIndex()] : undefined;

        if (option) {
          this.add(option.name);
        }
        break;
      }
      case 'Backspace':
        if (this.query().length === 0 && this.names().length > 0) {
          this.remove(this.names()[this.names().length - 1]);
        }
        break;
    }
  }

  /** Closes the editor, and keeps the page from taking Escape as leaving the selection too. */
  onEscape(event: Event): void {
    event.preventDefault();
    this.closed.emit();
  }

  optionId(index: number): string {
    return `${this.listId}-${index}`;
  }

  submit(): void {
    const names = this.names();

    if (names.length === 0 || this.saving()) {
      return;
    }

    this.saving.set(true);

    this.userPhotosService
      .addPhotoTags(this.userId(), this.photoIds(), names)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (photoTags) => {
          this.saving.set(false);
          this.saved.emit(photoTags);
        },
        error: (error) => {
          this.saving.set(false);
          this.toastService.error('Could not add the tags.', error);
        },
      });
  }
}
