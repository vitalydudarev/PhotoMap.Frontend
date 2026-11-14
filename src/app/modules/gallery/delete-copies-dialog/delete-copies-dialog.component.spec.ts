import {ComponentFixture, TestBed} from '@angular/core/testing';
import {beforeEach, describe, expect, it} from 'vitest';
import {Photo} from 'src/app/core/models/photo.model';

import {DeleteCopiesDialogComponent} from './delete-copies-dialog.component';

describe('DeleteCopiesDialogComponent', () => {
  let fixture: ComponentFixture<DeleteCopiesDialogComponent>;

  const photo = (id: string, photoSourceId: number, path: string): Photo => ({
    id,
    photoUrl: `/photo-${id}.jpg`,
    thumbnailSmallUrl: `/thumb-${id}.jpg`,
    thumbnailLargeUrl: `/thumb-${id}.jpg`,
    dateTimeTaken: new Date(),
    fileName: 'IMG_1.jpg',
    photoSourceId,
    path,
  });

  const copies = [
    photo('1', 1, '/Camera Uploads/IMG_1.jpg'),
    photo('2', 2, 'disk:/Photos/IMG_1.jpg'),
    photo('3', 2, 'disk:/Backup/IMG_1.jpg'),
  ];

  const element = () => fixture.nativeElement as HTMLElement;
  const checkboxes = () => [...element().querySelectorAll<HTMLInputElement>('.copy input')];
  const selectAll = () => element().querySelector<HTMLInputElement>('.select-all input')!;
  const deleteButton = () => element().querySelectorAll<HTMLButtonElement>('.actions button')[1];

  beforeEach(async () => {
    // jsdom has no modal dialogs
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    };

    await TestBed.configureTestingModule({imports: [DeleteCopiesDialogComponent]}).compileComponents();

    fixture = TestBed.createComponent(DeleteCopiesDialogComponent);
    fixture.componentRef.setInput('copies', copies);
    fixture.componentRef.setInput('photo', copies[1]);
    fixture.componentRef.setInput(
      'sourceNames',
      new Map([
        [1, 'Dropbox'],
        [2, 'Yandex.Disk'],
      ]),
    );
    fixture.detectChanges();
  });

  it('should list where each copy is kept, the one asked to delete picked', () => {
    const rows = [...element().querySelectorAll<HTMLElement>('.copy-text')].map((row) =>
      [...row.children].map((part) => part.textContent?.trim()).join(' '),
    );

    expect(rows).toEqual(['Dropbox /Camera Uploads', 'Yandex.Disk /Photos', 'Yandex.Disk /Backup']);
    expect(checkboxes().map((checkbox) => checkbox.checked)).toEqual([false, true, false]);
    expect(deleteButton().textContent?.trim()).toBe('Delete 1 copy');
  });

  it('should pick every copy, and none again', () => {
    selectAll().click();
    fixture.detectChanges();

    expect(checkboxes().every((checkbox) => checkbox.checked)).toBe(true);
    expect(deleteButton().textContent?.trim()).toBe('Delete all');

    selectAll().click();
    fixture.detectChanges();

    expect(checkboxes().some((checkbox) => checkbox.checked)).toBe(false);
    expect(deleteButton().disabled).toBe(true);
  });

  it('should tell the copies picked, and close', () => {
    const confirmed: Photo[][] = [];
    let closed = false;
    fixture.componentInstance.confirmed.subscribe((picked) => confirmed.push(picked));
    fixture.componentInstance.closed.subscribe(() => (closed = true));

    checkboxes()[2].click();
    fixture.detectChanges();
    deleteButton().click();

    expect(confirmed).toEqual([[copies[1], copies[2]]]);
    expect(closed).toBe(true);
  });
});
