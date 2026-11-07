import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {beforeEach, describe, expect, it} from 'vitest';
import {UserPhotosService} from 'src/app/core/services/user-photos.service';
import {PhotoTags} from 'src/app/core/models/photo-tag.model';
import {Photo} from 'src/app/core/models/photo.model';

import {PhotoTagsChange, PhotosThumbViewComponent} from './photos-thumb-view.component';

describe('PhotosThumbViewComponent', () => {
  let fixture: ComponentFixture<PhotosThumbViewComponent>;

  const photo = (id: string, latitude?: number, longitude?: number): Photo => ({
    id,
    photoUrl: `/photo-${id}.jpg`,
    thumbnailSmallUrl: `/thumb-${id}.jpg`,
    thumbnailLargeUrl: `/thumb-${id}.jpg`,
    dateTimeTaken: new Date(),
    fileName: `IMG_${id}.jpg`,
    latitude,
    longitude,
  });

  const badges = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.thumb .gps')];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhotosThumbViewComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), UserPhotosService],
    }).compileComponents();

    fixture = TestBed.createComponent(PhotosThumbViewComponent);
  });

  it('should mark each thumbnail with whether the photo has a GPS location', () => {
    // a coordinate of 0 is still a location, on the equator or the prime meridian
    fixture.componentInstance.photos = [photo('1', 53.9, 27.56), photo('2'), photo('3', 0, 0), photo('4', 53.9)];
    fixture.detectChanges();

    expect(badges().map((badge) => badge.getAttribute('aria-label'))).toEqual([
      'Has GPS location',
      'No GPS location',
      'Has GPS location',
      'No GPS location',
    ]);
    expect(badges().map((badge) => badge.classList.contains('gps--off'))).toEqual([false, true, false, true]);
  });

  it('should mark the thumbnails of the photos that have copies, with how many', () => {
    fixture.componentInstance.photos = [photo('1'), photo('2'), photo('3')];
    fixture.componentRef.setInput(
      'duplicates',
      new Map([
        ['1', 1],
        ['3', 2],
      ]),
    );
    fixture.detectChanges();

    const marks = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.thumb')].map(
      (thumb) => thumb.querySelector('.duplicate')?.getAttribute('aria-label') ?? null,
    );
    expect(marks).toEqual(['Has a duplicate', null, 'Has 2 duplicates']);
  });

  it('should offer to delete a photo, and to restore a deleted one', () => {
    const deleted = {...photo('2'), deletedOn: new Date()};
    fixture.componentInstance.photos = [photo('1'), deleted];
    fixture.detectChanges();
    const marked: Photo[] = [];
    const restored: Photo[] = [];
    fixture.componentInstance.markAsDeleted.subscribe((photo) => marked.push(photo));
    fixture.componentInstance.restore.subscribe((photo) => restored.push(photo));

    const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.thumb .action')];
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['Delete IMG_1.jpg', 'Restore IMG_2.jpg']);

    buttons[0].click();
    buttons[1].click();

    expect(marked.map((photo) => photo.id)).toEqual(['1']);
    expect(restored).toEqual([deleted]);
  });

  describe('tags', () => {
    const element = () => fixture.nativeElement as HTMLElement;
    const tagButtons = () => [...element().querySelectorAll<HTMLButtonElement>('.thumb .tag-button')];
    const editor = () => element().querySelector('app-photo-tag-editor');

    beforeEach(() => {
      fixture.componentInstance.photos = [{...photo('1'), tags: ['Family', 'Paris']}, photo('2')];
      fixture.componentRef.setInput('tagOptions', [{id: 1, name: 'Family', photoCount: 1}]);
      fixture.detectChanges();
    });

    it('should list the tags of a photo over its thumbnail', () => {
      const lists = [...element().querySelectorAll('.thumb')].map((thumb) =>
        [...thumb.querySelectorAll('.tags .tag')].map((tag) => tag.textContent?.trim()),
      );

      expect(lists).toEqual([['Family', 'Paris'], []]);
    });

    it('should tell the tags of a photo on its tag button, and how many there are', () => {
      expect(tagButtons().map((button) => button.getAttribute('aria-label'))).toEqual([
        'Tags of IMG_1.jpg: Family, Paris',
        'Add tags to IMG_2.jpg',
      ]);
      expect(tagButtons()[0].querySelector('.tag-count')?.textContent).toBe('2');
      expect(tagButtons()[1].querySelector('.tag-count')).toBeNull();
    });

    it('should offer no tag button where the photos cannot be tagged', () => {
      fixture.componentRef.setInput('tagOptions', null);
      fixture.detectChanges();

      expect(tagButtons()).toHaveLength(0);
    });

    it('should open the tag editor of the photo, and close it on a second click or a click elsewhere', () => {
      tagButtons()[1].click();
      fixture.detectChanges();

      expect(editor()?.getAttribute('aria-label')).toBe('Tags of IMG_2.jpg');
      expect(tagButtons()[1].getAttribute('aria-expanded')).toBe('true');

      tagButtons()[1].click();
      fixture.detectChanges();
      expect(editor()).toBeNull();

      tagButtons()[0].click();
      fixture.detectChanges();
      expect(editor()?.getAttribute('aria-label')).toBe('Tags of IMG_1.jpg');

      // a click within the editor keeps it open
      editor()!.querySelector<HTMLElement>('.title')!.click();
      fixture.detectChanges();
      expect(editor()).not.toBeNull();

      document.body.click();
      fixture.detectChanges();
      expect(editor()).toBeNull();
    });

    it('should tell the tags saved for the photo', () => {
      const changes: PhotoTagsChange[] = [];
      fixture.componentInstance.tagsChange.subscribe((change) => changes.push(change));

      tagButtons()[1].click();
      fixture.detectChanges();

      const http = TestBed.inject(HttpTestingController);
      http.expectOne((request) => request.url.endsWith('/photos/2/tags/suggestions')).flush([]);
      fixture.detectChanges();

      element().querySelector<HTMLElement>('.option')!.click();
      http.expectOne((request) => request.method === 'PUT' && request.url.endsWith('/photos/2/tags')).flush(['Family']);

      expect(changes.map((change) => [change.photo.id, change.tags])).toEqual([['2', ['Family']]]);
    });
  });

  describe('selection', () => {
    const element = () => fixture.nativeElement as HTMLElement;
    const thumbs = () => [...element().querySelectorAll<HTMLButtonElement>('.thumb .open')];
    const selected = () => thumbs().map((thumb) => thumb.getAttribute('aria-pressed') === 'true');
    const bar = () => element().querySelector<HTMLElement>('.selection-bar');
    const barButton = (text: string) =>
      [...bar()!.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes(text))!;
    const shiftClick = (thumb: HTMLElement) => thumb.dispatchEvent(new MouseEvent('click', {bubbles: true, shiftKey: true}));

    beforeEach(() => {
      fixture.componentInstance.photos = [photo('1'), photo('2'), photo('3'), photo('4')];
      fixture.componentRef.setInput('tagOptions', [{id: 1, name: 'Family', photoCount: 1}]);
      fixture.componentRef.setInput('selecting', true);
      fixture.detectChanges();
    });

    it('should select a photo on a click instead of opening it, and hide the buttons of the thumbnails', () => {
      thumbs()[1].click();
      fixture.detectChanges();

      expect(selected()).toEqual([false, true, false, false]);
      expect(element().querySelectorAll('.thumb .action')).toHaveLength(0);
      expect(bar()?.querySelector('.selection-count')?.textContent?.trim()).toBe('1 selected');

      thumbs()[1].click();
      fixture.detectChanges();
      expect(selected()).toEqual([false, false, false, false]);
    });

    it('should select a range of photos on a click with Shift', () => {
      thumbs()[0].click();
      shiftClick(thumbs()[2]);
      fixture.detectChanges();

      expect(selected()).toEqual([true, true, true, false]);
    });

    it('should select every photo, and clear the selection', () => {
      barButton('Select all').click();
      fixture.detectChanges();
      expect(selected()).toEqual([true, true, true, true]);

      barButton('Clear').click();
      fixture.detectChanges();
      expect(selected()).toEqual([false, false, false, false]);
    });

    it('should forget the selected photos that are no longer in the grid', () => {
      thumbs()[0].click();
      thumbs()[3].click();

      fixture.componentRef.setInput('photos', [photo('3'), photo('4'), photo('5')]);
      fixture.detectChanges();

      expect(selected()).toEqual([false, true, false]);
    });

    it('should leave the selection, and forget it, on Escape', () => {
      thumbs()[0].click();
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
      fixture.detectChanges();

      expect(fixture.componentInstance.selecting()).toBe(false);
      expect(bar()).toBeNull();

      fixture.componentRef.setInput('selecting', true);
      fixture.detectChanges();
      expect(selected()).toEqual([false, false, false, false]);
    });

    it('should add the tags to the selected photos, and tell the tags they have now', () => {
      const changes: PhotoTags[][] = [];
      fixture.componentInstance.photosTagsChange.subscribe((change) => changes.push(change));

      thumbs()[0].click();
      thumbs()[2].click();
      fixture.detectChanges();
      barButton('Add tags').click();
      fixture.detectChanges();

      const editor = element().querySelector<HTMLElement>('app-photos-bulk-tag-editor')!;
      expect(editor.getAttribute('aria-label')).toBe('Add tags to 2 photos');

      editor.querySelector<HTMLElement>('.option')!.click();
      fixture.detectChanges();
      editor.querySelector<HTMLButtonElement>('.submit')!.click();

      const request = TestBed.inject(HttpTestingController).expectOne(
        (request) => request.method === 'POST' && request.url.endsWith('/users/1/photos/tags'),
      );
      expect(request.request.body).toEqual({photoIds: ['1', '3'], tags: ['Family']});

      const photoTags = [
        {photoId: '1', tags: ['Family']},
        {photoId: '3', tags: ['Family', 'Paris']},
      ];
      request.flush(photoTags);
      fixture.detectChanges();

      expect(changes).toEqual([photoTags]);
      expect(fixture.componentInstance.selecting()).toBe(false);
    });
  });
});
