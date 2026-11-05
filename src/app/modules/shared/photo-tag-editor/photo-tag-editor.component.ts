import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {PhotoTag, TAG_MAX_LENGTH, TAGS_PER_PHOTO, TagSuggestion, cleanTagName, sameTag} from 'src/app/core/models/photo-tag.model';
import {Photo} from 'src/app/core/models/photo.model';
import {ToastService} from 'src/app/core/services/toast.service';
import {UserPhotosService} from 'src/app/core/services/user-photos.service';
import {IconComponent} from 'src/app/shared/ui/icon/icon.component';

/** An option of the list under the input: an existing tag to add, or a new one to make of what was typed. */
interface TagOption {
  name: string;
  isNew: boolean;
  photoCount?: number;
}

let nextId = 0;

/**
 * Edits the tags of a photo: takes them off, adds existing ones or new ones, and suggests some by when and where it
 * was taken. Every change is saved at once; changes made while one is being saved are saved after it, the last one
 * winning, so the photo never ends up with the tags of a change made before another.
 */
@Component({
  selector: 'app-photo-tag-editor',
  templateUrl: './photo-tag-editor.component.html',
  styleUrl: './photo-tag-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  host: {
    role: 'dialog',
    '[attr.aria-label]': '"Tags of " + photo().fileName',
    '(keydown.escape)': 'closed.emit()',
  },
})
export class PhotoTagEditorComponent implements OnInit {
  readonly photo = input.required<Photo>();
  readonly userId = input.required<number>();

  /** The tags of the user, to pick from. */
  readonly existingTags = input<readonly PhotoTag[]>([]);

  /** The tags of the photo were saved, as the server took them. */
  readonly saved = output<string[]>();

  /** The user is done with the tags. */
  readonly closed = output<void>();

  /** The tags of the photo as the user sees them, ahead of the server while a change is being saved. */
  readonly tags = linkedSignal(() => this.photo().tags ?? []);

  readonly query = signal('');
  readonly suggestions = signal<readonly TagSuggestion[] | null>(null);
  readonly suggestionsFailed = signal(false);
  readonly saving = signal(false);
  readonly activeIndex = signal(0);

  readonly maxLength = TAG_MAX_LENGTH;
  readonly maxTags = TAGS_PER_PHOTO;
  readonly full = computed(() => this.tags().length >= TAGS_PER_PHOTO);

  readonly listId = `photo-tag-options-${nextId++}`;

  /** The tags the photo does not have, matching what is typed: those starting with it first, then the most used. */
  readonly options = computed<TagOption[]>(() => {
    const query = cleanTagName(this.query()).toLocaleLowerCase();
    const tags = this.tags();

    const existing = this.existingTags()
      .filter((tag) => !tags.some((name) => sameTag(name, tag.name)))
      .filter((tag) => tag.name.toLocaleLowerCase().includes(query))
      .sort(
        (a, b) =>
          Number(b.name.toLocaleLowerCase().startsWith(query)) - Number(a.name.toLocaleLowerCase().startsWith(query)) ||
          b.photoCount - a.photoCount ||
          a.name.localeCompare(b.name),
      )
      .map<TagOption>((tag) => ({name: tag.name, isNew: false, photoCount: tag.photoCount}));

    const typed = cleanTagName(this.query());
    const known = typed.length === 0 || [...tags, ...this.existingTags().map((tag) => tag.name)].some((name) => sameTag(name, typed));

    return known ? existing : [...existing, {name: typed, isNew: true}];
  });

  /** The suggestions but the tags the photo has, which it may have been given since they were loaded. */
  readonly shownSuggestions = computed(() =>
    (this.suggestions() ?? []).filter((suggestion) => !this.tags().some((name) => sameTag(name, suggestion.name))),
  );

  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');
  private readonly destroyRef = inject(DestroyRef);
  private readonly userPhotosService = inject(UserPhotosService);
  private readonly toastService = inject(ToastService);

  /** The tags to save once the change being saved is, the latest change made meanwhile. */
  private pending: string[] | null = null;

  /** The tags the server took last, while a change made since is being saved. */
  private confirmed: string[] | null = null;

  constructor() {
    afterNextRender(() => this.input()?.nativeElement.focus());
  }

  ngOnInit(): void {
    this.userPhotosService
      .getPhotoTagSuggestions(this.userId(), this.photo().id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (suggestions) => this.suggestions.set(suggestions),
        // the tags can still be picked and typed, so this is not worth a toast
        error: () => {
          this.suggestions.set([]);
          this.suggestionsFailed.set(true);
        },
      });
  }

  add(name: string): void {
    const clean = cleanTagName(name);

    if (clean.length === 0 || this.full() || this.tags().some((tag) => sameTag(tag, clean))) {
      return;
    }

    this.query.set('');
    this.activeIndex.set(0);
    this.commit([...this.tags(), clean]);
    this.input()?.nativeElement.focus();
  }

  remove(name: string): void {
    this.commit(this.tags().filter((tag) => tag !== name));
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
        if (this.query().length === 0 && this.tags().length > 0) {
          this.remove(this.tags()[this.tags().length - 1]);
        }
        break;
    }
  }

  optionId(index: number): string {
    return `${this.listId}-${index}`;
  }

  suggestionReason(suggestion: TagSuggestion): string {
    if (suggestion.byDate && suggestion.byLocation) {
      return 'Photos taken around the same time and place have it';
    }

    return suggestion.byLocation ? 'Photos taken nearby have it' : 'By the date the photo was taken';
  }

  private commit(tags: string[]): void {
    this.tags.set(tags);

    if (this.saving()) {
      this.pending = tags;

      return;
    }

    this.save(tags);
  }

  private save(tags: string[]): void {
    this.saving.set(true);

    this.userPhotosService
      .setPhotoTags(this.userId(), this.photo().id, tags)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          const pending = this.pending;
          this.pending = null;

          if (pending) {
            this.confirmed = saved;
            this.save(pending);

            return;
          }

          this.confirmed = null;
          this.saving.set(false);
          this.tags.set(saved);
          this.saved.emit(saved);
        },
        error: (error) => {
          const confirmed = this.confirmed;
          this.pending = null;
          this.confirmed = null;
          this.saving.set(false);
          this.toastService.error('Could not save the tags.', error);

          // back to the tags the server has: those of a change saved meanwhile, or those the photo had before
          if (confirmed) {
            this.tags.set(confirmed);
            this.saved.emit(confirmed);
          } else {
            this.tags.set(this.photo().tags ?? []);
          }
        },
      });
  }
}
