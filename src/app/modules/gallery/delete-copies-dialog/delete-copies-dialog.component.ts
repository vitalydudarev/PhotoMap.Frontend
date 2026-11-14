import {Component, ElementRef, afterNextRender, computed, input, output, signal, viewChild} from '@angular/core';
import {photoFolder} from 'src/app/core/helpers/photo-folder.helper';
import {Photo} from 'src/app/core/models/photo.model';
import {UNAVAILABLE_IMAGE} from 'src/app/core/services/photo-viewer.service';
import {ButtonDirective} from 'src/app/shared/ui/button/button.directive';

/**
 * Asks which copies of a photo to delete, the copy the user asked to delete picked to begin with. It opens as a modal
 * once shown, and tells it was closed however it was: by its buttons, Escape or a click outside it.
 */
@Component({
  selector: 'app-delete-copies-dialog',
  templateUrl: './delete-copies-dialog.component.html',
  styleUrls: ['./delete-copies-dialog.component.scss'],
  imports: [ButtonDirective],
})
export class DeleteCopiesDialogComponent {
  /** The photo and its copies, two at least. */
  readonly copies = input.required<readonly Photo[]>();

  /** The copy the user asked to delete. */
  readonly photo = input.required<Photo>();

  /** The names of the photo sources, by their ID. */
  readonly sourceNames = input<ReadonlyMap<number, string>>(new Map());

  /** The user picked the copies to delete, one at least. */
  readonly confirmed = output<Photo[]>();

  readonly closed = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /** The IDs of the copies picked, the photo the user asked to delete until they pick otherwise. */
  private readonly picked = signal<ReadonlySet<string> | null>(null);

  readonly selectedIds = computed(() => this.picked() ?? new Set([this.photo().id]));
  readonly selectedCount = computed(() => this.copies().filter((copy) => this.selectedIds().has(copy.id)).length);
  readonly allSelected = computed(() => this.selectedCount() === this.copies().length);

  readonly folder = photoFolder;

  constructor() {
    afterNextRender(() => {
      const dialog = this.dialog().nativeElement;

      // a click outside closes it, as Escape does for the keyboard
      dialog.addEventListener('click', (event) => this.onDialogClick(event));
      dialog.showModal();
    });
  }

  isSelected(photo: Photo): boolean {
    return this.selectedIds().has(photo.id);
  }

  toggle(photo: Photo): void {
    const selected = new Set(this.selectedIds());

    if (!selected.delete(photo.id)) {
      selected.add(photo.id);
    }

    this.picked.set(selected);
  }

  toggleAll(): void {
    this.picked.set(this.allSelected() ? new Set() : new Set(this.copies().map((copy) => copy.id)));
  }

  sourceName(photo: Photo): string | null {
    return photo.photoSourceId === undefined ? null : (this.sourceNames().get(photo.photoSourceId) ?? null);
  }

  confirm(): void {
    const selected = this.copies().filter((copy) => this.isSelected(copy));

    if (selected.length === 0) {
      return;
    }

    this.confirmed.emit(selected);
    this.close();
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  /** A click on the backdrop lands on the dialog itself, outside of its box. */
  private onDialogClick(event: MouseEvent): void {
    const box = this.dialog().nativeElement.getBoundingClientRect();
    const outside = event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;

    if (event.target === this.dialog().nativeElement && outside) {
      this.close();
    }
  }

  onThumbnailError(event: Event): void {
    const image = event.target as HTMLImageElement;

    // The placeholder failing too would otherwise loop.
    if (!image.src.endsWith(UNAVAILABLE_IMAGE)) {
      image.src = UNAVAILABLE_IMAGE;
    }
  }
}
