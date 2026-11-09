import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import {PhotoTag, PhotoTags} from 'src/app/core/models/photo-tag.model';
import {photoMonthKeyOf} from 'src/app/core/models/photo-month.model';
import {Photo} from 'src/app/core/models/photo.model';
import {PhotoViewerService, UNAVAILABLE_IMAGE} from 'src/app/core/services/photo-viewer.service';

import {ButtonDirective} from 'src/app/shared/ui/button/button.directive';
import {IconComponent} from 'src/app/shared/ui/icon/icon.component';
import {LazySrcDirective} from 'src/app/shared/ui/lazy-src/lazy-src.directive';

import {PhotosBulkTagEditorComponent} from '../photos-bulk-tag-editor/photos-bulk-tag-editor.component';
import {PhotoTagEditorComponent} from '../photo-tag-editor/photo-tag-editor.component';
import {ScrollControlComponent} from '../scroll-control/scroll-control.component';

/** The tags of a photo were saved. */
export interface PhotoTagsChange {
  photo: Photo;
  tags: string[];
}

/** Where the tag editor sits, from the top left corner of the grid. */
interface EditorPosition {
  top: number;
  left: number;
}

/** The width of the tag editor, to keep it from running off the right edge of the grid. */
const EDITOR_WIDTH = 320;
const EDITOR_GAP = 6;

@Component({
  selector: 'app-photos-thumb-view',
  templateUrl: './photos-thumb-view.component.html',
  styleUrls: ['./photos-thumb-view.component.scss'],
  imports: [
    ButtonDirective,
    IconComponent,
    LazySrcDirective,
    PhotoTagEditorComponent,
    PhotosBulkTagEditorComponent,
    ScrollControlComponent,
  ],
  host: {
    '[class.thumb-view--full]': 'fullWidth()',
    '[class.thumb-view--selecting]': 'selecting()',
    '(document:click)': 'onDocumentClick($event)',
    // the keyboard of a phone, brought up by the input of the editor, resizes the window too
    '(window:resize)': 'placeEditor()',
    '(document:keydown.escape)': 'onEscape($event)',
  },
})
export class PhotosThumbViewComponent implements OnChanges {
  @Input() photos: Photo[] = [];

  /** Lets the grid span the whole viewport instead of the page's reading measure. */
  readonly fullWidth = input(false, {transform: booleanAttribute});

  /** The photos being deleted or restored, whose button waits for that to finish. */
  readonly busy = input<ReadonlySet<string>>(new Set());

  /** The tags of the user to pick from, or null when the photos cannot be tagged here. */
  readonly tagOptions = input<readonly PhotoTag[] | null>(null);

  /** How many copies each photo that has any has, besides itself, by the ID of the photo. */
  readonly duplicates = input<ReadonlyMap<string, number>>(new Map());

  /** The user the photos belong to, whose tags they are given. */
  readonly userId = input(1);

  /** The user asked for the photo to be moved to the deleted photos. */
  readonly markAsDeleted = output<Photo>();

  /** The user asked for the photo to be taken back from the deleted photos. */
  readonly restore = output<Photo>();

  /** The tags of a photo were saved. */
  readonly tagsChange = output<PhotoTagsChange>();

  /** Tags were added to the selected photos, which have these tags now. */
  readonly photosTagsChange = output<PhotoTags[]>();

  /** Whether a click on a thumbnail selects the photo rather than opening it. */
  readonly selecting = model(false);

  /** The selected photos, by their ID; only ever photos of the grid. */
  readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedIds().size);

  /** Whether the tags to add to the selected photos are being picked. */
  readonly bulkTagging = signal(false);

  /** The photo whose tags are being edited, by its ID, so that it is still found once the photos are replaced. */
  readonly editingId = signal<string | null>(null);
  readonly editorPosition = signal<EditorPosition>({top: 0, left: 0});
  readonly taggable = computed(() => this.tagOptions() !== null);

  private readonly photoViewerService = inject(PhotoViewerService);
  private readonly element = inject(ElementRef<HTMLElement>);

  /** The tag button the editor was opened with, which it sits under. */
  private editorAnchor: HTMLElement | null = null;

  /** The photo selected or unselected last, from which a click with Shift selects a range, by its index. */
  private selectionAnchor: number | null = null;

  constructor() {
    effect(() => {
      if (this.selecting()) {
        this.closeTags();
      } else {
        this.clearSelection();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // another page, or other filters: the photos selected that are not in the grid any more are no longer selected
    if (changes['photos'] && this.selectedCount() > 0) {
      const ids = new Set(this.photos.map((photo) => photo.id));
      const kept = [...this.selectedIds()].filter((id) => ids.has(id));

      if (kept.length !== this.selectedCount()) {
        this.selectedIds.set(new Set(kept));
        this.selectionAnchor = null;
      }
    }
  }

  onThumbClick(index: number, event: MouseEvent): void {
    if (this.selecting()) {
      this.toggleSelected(index, event.shiftKey);
    } else {
      this.open(index);
    }
  }

  isSelected(photo: Photo): boolean {
    return this.selectedIds().has(photo.id);
  }

  /**
   * Selects the photo, or unselects it when it is selected. With `range`, every photo from the one selected or
   * unselected last to this one is made the same.
   */
  toggleSelected(index: number, range = false): void {
    const photo = this.photos[index];

    if (!photo) {
      return;
    }

    const select = !this.isSelected(photo);
    const anchor = range && this.selectionAnchor !== null ? this.selectionAnchor : index;
    const ids = new Set(this.selectedIds());

    for (let i = Math.min(anchor, index); i <= Math.max(anchor, index); i++) {
      const id = this.photos[i]?.id;

      if (id === undefined) {
        continue;
      }

      if (select) {
        ids.add(id);
      } else {
        ids.delete(id);
      }
    }

    this.selectionAnchor = index;
    this.selectedIds.set(ids);

    if (ids.size === 0) {
      this.bulkTagging.set(false);
    }
  }

  selectAll(): void {
    this.selectedIds.set(new Set(this.photos.map((photo) => photo.id)));
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
    this.selectionAnchor = null;
    this.bulkTagging.set(false);
  }

  /** The IDs of the selected photos, in the order of the grid. */
  selectedPhotoIds(): string[] {
    const ids = this.selectedIds();

    return this.photos.filter((photo) => ids.has(photo.id)).map((photo) => photo.id);
  }

  onBulkTagsSaved(photoTags: PhotoTags[]): void {
    this.photosTagsChange.emit(photoTags);
    this.selecting.set(false);
  }

  /** Escape leaves the selection, unless something nearer the focus, such as an editor, took it first. */
  onEscape(event: Event): void {
    if (this.selecting() && !event.defaultPrevented) {
      this.selecting.set(false);
    }
  }

  open(index: number): void {
    this.photoViewerService.open(this.photos, index);
  }

  /** The same test the backend marks a photo as having GPS by: both coordinates were read from its EXIF. */
  hasGps(photo: Photo): boolean {
    return photo.latitude != null && photo.longitude != null;
  }

  /** The month the photo was taken in, which the timeline of the gallery finds the photos of a month by. */
  monthKey(photo: Photo): string {
    return photoMonthKeyOf(photo.dateTimeTaken);
  }

  isDeleted(photo: Photo): boolean {
    return photo.deletedOn != null;
  }

  editingPhoto(): Photo | undefined {
    const id = this.editingId();

    return id === null ? undefined : this.photos.find((photo) => photo.id === id);
  }

  tagsLabel(photo: Photo): string {
    const tags = photo.tags ?? [];

    return tags.length === 0 ? `Add tags to ${photo.fileName}` : `Tags of ${photo.fileName}: ${tags.join(', ')}`;
  }

  /** Opens the tag editor under the thumbnail, or closes it when it is open for this photo already. */
  toggleTags(photo: Photo, button: HTMLElement): void {
    if (this.editingId() === photo.id) {
      this.closeTags();

      return;
    }

    this.editorAnchor = button;
    this.placeEditor();
    this.editingId.set(photo.id);
  }

  closeTags(): void {
    this.editingId.set(null);
    this.editorAnchor = null;
  }

  /** Puts the editor under the thumbnail of its photo, within the grid. */
  placeEditor(): void {
    if (!this.editorAnchor?.isConnected) {
      return;
    }

    const thumb = this.editorAnchor.closest('.thumb') ?? this.editorAnchor;
    const thumbRect = thumb.getBoundingClientRect();
    const hostRect = (this.element.nativeElement as HTMLElement).getBoundingClientRect();
    const maxLeft = Math.max(0, hostRect.width - EDITOR_WIDTH);

    this.editorPosition.set({
      top: thumbRect.bottom - hostRect.top + EDITOR_GAP,
      left: Math.min(Math.max(0, thumbRect.left - hostRect.left), maxLeft),
    });
  }

  onTagsSaved(photo: Photo, tags: string[]): void {
    this.tagsChange.emit({photo, tags});
  }

  /** A click anywhere but in the editor, or on the button that toggles it, closes it. */
  onDocumentClick(event: MouseEvent): void {
    if (this.editingId() === null) {
      return;
    }

    const target = event.target as Element | null;

    if (!target?.isConnected || target.closest('app-photo-tag-editor, .tag-button')) {
      return;
    }

    this.closeTags();
  }

  onThumbnailError(event: Event): void {
    const image = event.target as HTMLImageElement;

    // The placeholder failing too would otherwise loop.
    if (!image.src.endsWith(UNAVAILABLE_IMAGE)) {
      image.src = UNAVAILABLE_IMAGE;
    }
  }
}
