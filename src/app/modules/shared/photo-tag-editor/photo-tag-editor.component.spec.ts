import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {PhotoTag} from 'src/app/core/models/photo-tag.model';
import {Photo} from 'src/app/core/models/photo.model';
import {ToastService} from 'src/app/core/services/toast.service';
import {UserPhotosService} from 'src/app/core/services/user-photos.service';

import {PhotoTagEditorComponent} from './photo-tag-editor.component';

describe('PhotoTagEditorComponent', () => {
  let fixture: ComponentFixture<PhotoTagEditorComponent>;
  let saved: string[][];

  const photo: Photo = {
    id: '7',
    photoUrl: '/photo-7.jpg',
    thumbnailSmallUrl: '/thumb-7.jpg',
    thumbnailLargeUrl: '/thumb-7.jpg',
    dateTimeTaken: new Date(),
    fileName: 'IMG_7.jpg',
    tags: ['Family'],
  };

  const existingTags: PhotoTag[] = [
    {id: 1, name: 'Family', photoCount: 40},
    {id: 2, name: 'Paris', photoCount: 3},
    {id: 3, name: 'Party', photoCount: 12},
    {id: 4, name: 'Spain', photoCount: 8},
  ];

  const http = () => TestBed.inject(HttpTestingController);
  const element = () => fixture.nativeElement as HTMLElement;
  const input = () => element().querySelector<HTMLInputElement>('.input')!;
  const chips = () => [...element().querySelectorAll('.chip-name')].map((chip) => chip.textContent?.trim());
  const options = () => [...element().querySelectorAll('.option-name')].map((option) => option.textContent?.trim());
  const suggestions = () => [...element().querySelectorAll<HTMLButtonElement>('.suggestion')];
  const saveRequests = () => http().match((request) => request.method === 'PUT' && request.url.endsWith('/users/1/photos/7/tags'));

  const type = (value: string) => {
    input().value = value;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const press = (key: string) => {
    input().dispatchEvent(new KeyboardEvent('keydown', {key}));
    fixture.detectChanges();
  };

  const flushSuggestions = (
    body = [
      {name: 'Paris', byDate: false, byLocation: true},
      {name: '2019', byDate: true, byLocation: false},
    ],
  ) => {
    http()
      .expectOne((request) => request.url.endsWith('/users/1/photos/7/tags/suggestions'))
      .flush(body);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhotoTagEditorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), UserPhotosService],
    }).compileComponents();

    fixture = TestBed.createComponent(PhotoTagEditorComponent);
    fixture.componentRef.setInput('photo', photo);
    fixture.componentRef.setInput('userId', 1);
    fixture.componentRef.setInput('existingTags', existingTags);
    saved = [];
    fixture.componentInstance.saved.subscribe((tags) => saved.push(tags));
    fixture.detectChanges();
  });

  afterEach(() => http().verify());

  it('should show the tags of the photo, and offer the other tags of the user, the most used first', () => {
    flushSuggestions();

    expect(chips()).toEqual(['Family']);
    expect(options()).toEqual(['Party', 'Spain', 'Paris']);
  });

  it('should narrow the tags down to what is typed, those starting with it first, and offer to make a new one', () => {
    flushSuggestions();

    // starting with it, the most used first, then containing it
    type('pa');
    expect(options()).toEqual(['Party', 'Paris', 'Spain', 'Create “pa”']);

    // a tag of the same name in another case is no new tag
    type(' PARIS ');
    expect(options()).toEqual(['Paris']);
  });

  it('should add the tag picked with the keyboard, and save the tags of the photo', () => {
    flushSuggestions();

    type('pa');
    press('ArrowDown');
    press('Enter');

    expect(chips()).toEqual(['Family', 'Paris']);
    expect(input().value).toBe('');

    const [request] = saveRequests();
    expect(request.request.body).toEqual(['Family', 'Paris']);
    request.flush(['Family', 'Paris']);

    expect(saved).toEqual([['Family', 'Paris']]);
  });

  it('should make a new tag of what is typed, cleaned', () => {
    flushSuggestions();

    type('  Summer   trip ');
    press('Enter');

    const [request] = saveRequests();
    expect(request.request.body).toEqual(['Family', 'Summer trip']);
    request.flush(['Family', 'Summer trip']);
  });

  it('should add nothing on Enter while nothing is typed', () => {
    flushSuggestions();

    press('Enter');

    expect(saveRequests()).toHaveLength(0);
  });

  it('should suggest tags with why, but those the photo has, and add one when clicked', () => {
    flushSuggestions([
      {name: 'family', byDate: true, byLocation: true},
      {name: 'Paris', byDate: false, byLocation: true},
      {name: '2019', byDate: true, byLocation: false},
    ]);

    expect(suggestions().map((suggestion) => suggestion.textContent?.trim())).toEqual(['Paris', '2019']);
    expect(suggestions().map((suggestion) => suggestion.title)).toEqual(['Photos taken nearby have it', 'By the date the photo was taken']);

    suggestions()[0].click();
    fixture.detectChanges();

    const [request] = saveRequests();
    expect(request.request.body).toEqual(['Family', 'Paris']);
    request.flush(['Family', 'Paris']);
    fixture.detectChanges();

    // the suggestion is taken, so it is no longer offered
    expect(suggestions().map((suggestion) => suggestion.textContent?.trim())).toEqual(['2019']);
  });

  it('should take a tag off the photo', () => {
    flushSuggestions();

    element().querySelector<HTMLButtonElement>('.chip-remove')!.click();
    fixture.detectChanges();

    const [request] = saveRequests();
    expect(request.request.body).toEqual([]);
    request.flush([]);

    expect(saved).toEqual([[]]);
  });

  it('should save a change made while another is being saved after it, the latest one only', () => {
    flushSuggestions();

    fixture.componentInstance.add('Paris');
    fixture.componentInstance.add('Spain');
    fixture.componentInstance.add('Party');

    const [first] = saveRequests();
    expect(first.request.body).toEqual(['Family', 'Paris']);
    first.flush(['Family', 'Paris']);

    const [second] = saveRequests();
    expect(second.request.body).toEqual(['Family', 'Paris', 'Spain', 'Party']);
    second.flush(['Family', 'Paris', 'Party', 'Spain']);

    expect(saved).toEqual([['Family', 'Paris', 'Party', 'Spain']]);
  });

  it('should go back to the tags the server has, and say so, when they could not be saved', () => {
    flushSuggestions();
    const errors: string[] = [];
    const toastService = TestBed.inject(ToastService);
    toastService.error = (message: string) => errors.push(message);

    fixture.componentInstance.add('Paris');
    fixture.detectChanges();
    expect(chips()).toEqual(['Family', 'Paris']);

    saveRequests()[0].flush(null, {status: 500, statusText: 'Server Error'});
    fixture.detectChanges();

    expect(chips()).toEqual(['Family']);
    expect(errors).toEqual(['Could not save the tags.']);
    expect(saved).toEqual([]);
  });

  it('should still let tags be picked when the suggestions could not be loaded', () => {
    http()
      .expectOne((request) => request.url.endsWith('/tags/suggestions'))
      .flush(null, {status: 500, statusText: 'Server Error'});
    fixture.detectChanges();

    expect(element().querySelector('.suggestions')?.textContent).toContain('Could not load the suggestions.');
    expect(options()).toEqual(['Party', 'Spain', 'Paris']);
  });

  it('should be closed with Escape', () => {
    flushSuggestions();
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);

    element().dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));

    expect(closed).toBe(1);
  });
});
