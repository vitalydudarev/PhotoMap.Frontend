import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {PhotoTags} from 'src/app/core/models/photo-tag.model';
import {UserPhotosService} from 'src/app/core/services/user-photos.service';

import {PhotosBulkTagEditorComponent} from './photos-bulk-tag-editor.component';

describe('PhotosBulkTagEditorComponent', () => {
  let fixture: ComponentFixture<PhotosBulkTagEditorComponent>;
  let saved: PhotoTags[][];

  const http = () => TestBed.inject(HttpTestingController);
  const element = () => fixture.nativeElement as HTMLElement;

  const build = (kind: 'photo' | 'video') => {
    fixture = TestBed.createComponent(PhotosBulkTagEditorComponent);
    fixture.componentRef.setInput('photoIds', ['5', '7']);
    fixture.componentRef.setInput('userId', 1);
    fixture.componentRef.setInput('kind', kind);
    saved = [];
    fixture.componentInstance.saved.subscribe((tags) => saved.push(tags));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhotosBulkTagEditorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), UserPhotosService],
    }).compileComponents();
  });

  afterEach(() => http().verify());

  it('should add the tags to the photos as such', () => {
    build('photo');

    fixture.componentInstance.add('Paris');
    fixture.componentInstance.submit();

    const request = http().expectOne((candidate) => candidate.method === 'POST' && candidate.url.endsWith('/users/1/photos/tags'));
    expect(request.request.body).toEqual({photoIds: ['5', '7'], tags: ['Paris']});
    request.flush([{photoId: '5', tags: ['Paris']}]);

    expect(saved).toEqual([[{photoId: '5', tags: ['Paris']}]]);
  });

  describe('of videos', () => {
    beforeEach(() => build('video'));

    it('should say what it tags', () => {
      expect(element().getAttribute('aria-label')).toBe('Add tags to 2 videos');
      expect(element().querySelector('.hint')?.textContent).toContain('The videos keep the tags they have.');
    });

    it('should add the tags to the videos as such, telling the tags of each by its ID', () => {
      fixture.componentInstance.add('Paris');
      fixture.componentInstance.submit();

      const request = http().expectOne((candidate) => candidate.method === 'POST' && candidate.url.endsWith('/users/1/videos/tags'));
      expect(request.request.body).toEqual({videoIds: ['5', '7'], tags: ['Paris']});
      request.flush([
        {videoId: '5', tags: ['Paris']},
        {videoId: '7', tags: ['Family', 'Paris']},
      ]);

      expect(saved).toEqual([
        [
          {photoId: '5', tags: ['Paris']},
          {photoId: '7', tags: ['Family', 'Paris']},
        ],
      ]);
    });
  });
});
