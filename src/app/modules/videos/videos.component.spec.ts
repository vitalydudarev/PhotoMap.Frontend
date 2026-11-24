import {Component, input, output} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, provideRouter} from '@angular/router';
import {Subject, of} from 'rxjs';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {VideoLocation} from '../../core/models/photo-location.model';
import {Video, VideoDuplicateGroup} from '../../core/models/video.model';
import {Photo} from '../../core/models/photo.model';
import {UserPhotosService} from '../../core/services/user-photos.service';
import {VideosService} from '../../core/services/videos.service';
import {PhotoSelection} from '../shared/photos-map-view/photo-map.model';
import {PhotosMapViewComponent} from '../shared/photos-map-view/photos-map-view.component';
import {VideosComponent} from './videos.component';

/** Stands in for the map, which draws nothing in a test: tells the photos it is given, and what is clicked on it. */
@Component({selector: 'app-photos-map-view', template: ''})
class MapViewStubComponent {
  readonly photos = input<readonly Photo[]>([]);
  readonly noun = input('photo');
  readonly openInViewer = input(true);
  readonly opened = output<PhotoSelection>();
}

describe('VideosComponent', () => {
  let fixture: ComponentFixture<VideosComponent>;
  let component: VideosComponent;
  let getUserVideos: ReturnType<typeof vi.fn>;
  let getUserVideoDuplicates: ReturnType<typeof vi.fn>;
  let queryParams: Record<string, string | string[]>;
  let folders: string[];
  let getUserVideoFacets: ReturnType<typeof vi.fn>;
  let getUserGeotaggedVideos: ReturnType<typeof vi.fn>;
  let getUserPhotoTags: ReturnType<typeof vi.fn>;
  let setVideoTags: ReturnType<typeof vi.fn>;
  let addVideoTags: ReturnType<typeof vi.fn>;
  let locations: VideoLocation[];

  const video: Video = {
    id: '1',
    photoSourceId: 2,
    previewUrl: 'https://localhost/api/videos/1/preview',
    videoUrl: 'https://localhost/api/videos/1',
    fileName: 'trip.mp4',
    folderPath: 'disk:/Videos',
    size: 1024,
    dateTimeTaken: new Date('2019-05-01T10:00:00Z'),
  };

  const copy: Video = {...video, id: '7', folderPath: 'disk:/Camera Uploads'};
  const group: VideoDuplicateGroup = {id: '1', fileName: 'trip.mp4', size: 1536, videos: [video, copy]};

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const lastFolders = () => getUserVideos.mock.lastCall![4];

  const build = () => {
    fixture = TestBed.createComponent(VideosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const element = () => fixture.nativeElement as HTMLElement;
  const toggle = () => element().querySelector<HTMLButtonElement>('.sidebar-toggle')!;

  afterEach(() => localStorage.clear());

  beforeEach(() => {
    localStorage.clear();
    getUserVideos = vi.fn(() => of({values: [video], total: 1, limit: 100, offset: 0}));
    getUserVideoDuplicates = vi.fn(() => of([group]));
    queryParams = {};
    folders = ['disk:/Camera Uploads', 'disk:/Videos'];
    // every option takes some video, unless a test says otherwise
    getUserGeotaggedVideos = vi.fn(() => of([]));
    // the user has no tag yet, unless a test says otherwise
    getUserPhotoTags = vi.fn(() => of([]));
    setVideoTags = vi.fn((_userId: number, _videoId: string, names: string[]) => of(names));
    addVideoTags = vi.fn((_userId: number, videoIds: string[], names: string[]) => of(videoIds.map((videoId) => ({videoId, tags: names}))));
    getUserVideoFacets = vi.fn(() =>
      of({
        folders: folders.map((value) => ({value, count: 1})),
        years: [2016, 2019].map((value) => ({value, count: 1})),
        months: [],
        locations: locations.map((location) => ({value: location.id, count: 1})),
        unknownLocationCount: 1,
        tags: [],
        untaggedCount: 1,
      }),
    );
    // no video is geocoded, unless a test says otherwise
    locations = [];

    TestBed.configureTestingModule({
      imports: [VideosComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            get snapshot() {
              return {queryParamMap: convertToParamMap(queryParams)};
            },
          },
        },
        {provide: UserPhotosService, useValue: {getUserPhotoTags}},
        {
          provide: VideosService,
          useValue: {
            getUserVideos,
            getUserVideoDuplicates,
            getUserVideoFolders: vi.fn(() => of(folders)),
            getUserVideoYears: () => of([2016, 2019]),
            getUserVideoFacets,
            getUserGeotaggedVideos,
            getUserVideoLocations: () => of(locations),
            setVideoTags,
            addVideoTags,
            getVideoTagSuggestions: () => of([]),
          },
        },
      ],
    });
  });

  const viewLinks = () => [...element().querySelectorAll<HTMLButtonElement>('.view-link')];
  const currentView = () => element().querySelector('.view-link[aria-current="page"]')?.textContent;

  describe('camera uploads', () => {
    beforeEach(() => {
      folders = [
        'disk:/Videos',
        'disk:/Фотокамера',
        'disk:/Фотокамера/2020',
        'disk:/Camera Uploads',
        '/Camera Uploads',
        '/Camera Uploads 2',
      ];
    });

    it('should be shown by default, asking for the videos of the folders the phones upload to and theirs', () => {
      build();

      expect(viewLinks().map((link) => link.textContent?.trim())).toEqual(['Camera Uploads', 'All videos', 'Duplicates']);
      expect(currentView()).toContain('Camera Uploads');
      expect(getUserVideos).toHaveBeenCalledTimes(1);
      expect(lastFolders()).toEqual(['disk:/Фотокамера', 'disk:/Фотокамера/2020', 'disk:/Camera Uploads', '/Camera Uploads']);
      expect(component.folderFilter.options().map((option) => option.value)).toEqual([
        'disk:/Фотокамера',
        'disk:/Фотокамера/2020',
        'disk:/Camera Uploads',
        '/Camera Uploads',
      ]);
    });

    it('should narrow the camera uploads down to the folders picked', () => {
      build();

      component.filterUpdated(component.folderFilter, ['disk:/Фотокамера']);

      expect(lastFolders()).toEqual(['disk:/Фотокамера']);
    });

    it('should switch to all the videos and back from the sidebar, from the first page', () => {
      build();
      vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
      component.pageIndex = 2;

      viewLinks()[1].click();
      fixture.detectChanges();

      expect(lastFolders()).toEqual([]);
      expect(component.pageIndex).toBe(0);
      expect(currentView()).toContain('All videos');
      expect(component.folderFilter.options()).toHaveLength(6);

      viewLinks()[0].click();
      fixture.detectChanges();

      expect(lastFolders()).toEqual(['disk:/Фотокамера', 'disk:/Фотокамера/2020', 'disk:/Camera Uploads', '/Camera Uploads']);
      expect(currentView()).toContain('Camera Uploads');
      vi.restoreAllMocks();
    });

    it('should open on all the videos when the address asks for all folders', () => {
      queryParams = {allFolders: 'true'};
      build();

      expect(currentView()).toContain('All videos');
      expect(lastFolders()).toEqual([]);
    });

    it('should ask for no video and say so when there is no camera folder', () => {
      folders = ['disk:/Videos'];
      build();

      expect(getUserVideos).not.toHaveBeenCalled();
      expect(text()).toContain('No videos in the camera uploads');
    });
  });

  it('should list the videos of every folder by their previews', () => {
    queryParams = {allFolders: 'true'};
    build();

    expect(lastFolders()).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).querySelector('img')?.getAttribute('src')).toBe(video.previewUrl);
  });

  it('should offer the folders without the name of the disk', () => {
    queryParams = {allFolders: 'true'};
    build();

    expect(component.folderFilter.options().map((option) => option.label)).toEqual(['/Camera Uploads', '/Videos']);
  });

  it('should narrow the videos down to the folders picked', () => {
    queryParams = {allFolders: 'true'};
    build();

    component.filterUpdated(component.folderFilter, ['disk:/Videos']);

    expect(lastFolders()).toEqual(['disk:/Videos']);
    expect(component.pageIndex).toBe(0);
  });

  it('should take the folders the address asks for', () => {
    queryParams = {folder: 'disk:/Camera Uploads', allFolders: 'true'};
    build();

    expect(lastFolders()).toEqual(['disk:/Camera Uploads']);
    expect(component.folderFilter.selected()).toEqual(['disk:/Camera Uploads']);
  });

  describe('narrowed down by one another', () => {
    it('should list only the options of each filter that take some video along with the others', () => {
      queryParams = {allFolders: 'true'};
      build();
      getUserVideoFacets.mockReturnValue(
        of({
          folders: [{value: 'disk:/Videos', count: 2}],
          years: [{value: 2019, count: 2}],
          months: [],
          locations: [],
          unknownLocationCount: 2,
          tags: [],
          untaggedCount: 2,
        }),
      );

      component.filterUpdated(component.yearFilter, [2019]);

      expect(getUserVideoFacets.mock.lastCall!.slice(1)).toEqual([[], [2019], [], false, false, [], false]);
      expect(component.folderFilter.options()).toEqual([{value: 'disk:/Videos', label: '/Videos', count: 2}]);
      expect(component.yearFilter.options().map((option) => option.value)).toEqual([2019]);
    });

    it('should keep the folders no longer listed picked, and ask for the videos by them', () => {
      queryParams = {allFolders: 'true'};
      folders = ['disk:/Camera Uploads', 'disk:/Trips', 'disk:/Videos'];
      build();
      component.filterUpdated(component.folderFilter, ['disk:/Trips', 'disk:/Videos']);
      getUserVideoFacets.mockReturnValue(
        of({
          folders: [
            {value: 'disk:/Camera Uploads', count: 1},
            {value: 'disk:/Videos', count: 1},
          ],
          years: [{value: 2019, count: 2}],
          months: [],
          locations: [],
          unknownLocationCount: 2,
          tags: [],
          untaggedCount: 2,
        }),
      );

      component.filterUpdated(component.yearFilter, [2019]);
      component.filterUpdated(component.folderFilter, ['disk:/Videos']);

      expect(component.folderFilter.selected()).toEqual(['disk:/Trips', 'disk:/Videos']);
      expect(lastFolders()).toEqual(['disk:/Trips', 'disk:/Videos']);
    });

    it('should ask for the camera uploads by every camera folder, those not listed too', () => {
      folders = ['disk:/Camera Uploads', '/Camera Uploads', 'disk:/Videos'];
      build();
      getUserVideoFacets.mockReturnValue(
        of({
          folders: [{value: '/Camera Uploads', count: 1}],
          years: [{value: 2019, count: 1}],
          months: [],
          locations: [],
          unknownLocationCount: 1,
          tags: [],
          untaggedCount: 1,
        }),
      );

      component.filterUpdated(component.yearFilter, [2019]);
      component.filterUpdated(component.yearFilter, [2016, 2019]);

      expect(component.folderFilter.options().map((option) => option.value)).toEqual(['/Camera Uploads']);
      expect(lastFolders()).toEqual(['disk:/Camera Uploads', '/Camera Uploads']);
    });

    it('should count only the videos with a GPS location on the map, which shows only those, and all of them again in the grid', () => {
      queryParams = {allFolders: 'true'};
      build();
      getUserVideoFacets.mockClear();
      getUserVideoFacets.mockReturnValue(
        of({
          folders: [{value: 'disk:/Videos', count: 7}],
          years: [{value: 2019, count: 7}],
          months: [],
          locations: [],
          unknownLocationCount: 7,
          tags: [],
          untaggedCount: 7,
        }),
      );

      component.viewModeUpdated('map');
      fixture.detectChanges();
      element().querySelector<HTMLButtonElement>('.sidebar app-checklist .heading')!.click();
      fixture.detectChanges();

      expect(getUserVideoFacets.mock.lastCall![5]).toBe(true);
      expect(component.folderFilter.options().map((option) => option.value)).toEqual(['disk:/Videos']);
      expect([...element().querySelectorAll('.sidebar app-checklist .option-count')].map((count) => count.textContent?.trim())).toContain(
        '7',
      );

      component.viewModeUpdated('grid');

      expect(getUserVideoFacets).toHaveBeenCalledTimes(2);
      expect(getUserVideoFacets.mock.lastCall![5]).toBe(false);
    });

    it('should not ask for the options again for another page of the same videos', () => {
      build();
      getUserVideoFacets.mockClear();

      component.pageUpdated({pageIndex: 1, pageSize: 100});

      expect(getUserVideoFacets).not.toHaveBeenCalled();
    });
  });

  describe('by year', () => {
    const lastYears = () => getUserVideos.mock.lastCall![5];

    it('should offer the years in the sidebar, above the folders, all picked, and ask for every year', () => {
      build();

      expect([...element().querySelectorAll('.sidebar app-checklist')].map((checklist) => checklist.textContent)).toEqual([
        expect.stringContaining('Years'),
        expect.stringContaining('Folders'),
      ]);
      expect(component.yearFilter.picked()).toEqual([2016, 2019]);
      expect(lastYears()).toEqual([]);
    });

    it('should narrow the videos down to the years picked, from the first page, and count it', () => {
      queryParams = {allFolders: 'true'};
      build();
      component.pageIndex = 2;

      component.filterUpdated(component.yearFilter, [2019]);
      fixture.detectChanges();

      expect(lastYears()).toEqual([2019]);
      expect(component.pageIndex).toBe(0);
      expect(toggle().querySelector('.filters-count')?.textContent).toContain('1');
    });

    it('should take the years the address asks for', () => {
      queryParams = {year: '2016', allFolders: 'true'};
      build();

      expect(lastYears()).toEqual([2016]);
      expect(component.yearFilter.picked()).toEqual([2016]);
    });

    it('should show no videos while no year is picked', () => {
      queryParams = {allFolders: 'true'};
      build();
      getUserVideos.mockClear();

      component.filterUpdated(component.yearFilter, []);
      fixture.detectChanges();

      expect(getUserVideos).not.toHaveBeenCalled();
      expect(text()).toContain('No years are selected');
    });

    it('should show every year again once the filters are reset', () => {
      queryParams = {allFolders: 'true'};
      build();
      component.filterUpdated(component.yearFilter, [2019]);
      fixture.detectChanges();

      element().querySelector<HTMLButtonElement>('.filters-reset')!.click();

      expect(lastYears()).toEqual([]);
      expect(component.yearFilter.picked()).toEqual([2016, 2019]);
    });
  });

  describe('by tag', () => {
    const tags = [
      {id: 4, name: 'Family', photoCount: 3, videoCount: 1},
      {id: 9, name: 'Paris', photoCount: 1, videoCount: 0},
    ];
    const lastTags = () => getUserVideos.mock.lastCall!.slice(8, 10);
    const facets = (tagCounts: [number, number][], untaggedCount: number) =>
      of({
        folders: folders.map((value) => ({value, count: 1})),
        years: [2016, 2019].map((value) => ({value, count: 1})),
        months: [],
        locations: [],
        unknownLocationCount: 1,
        tags: tagCounts.map(([value, count]) => ({value, count})),
        untaggedCount,
      });

    beforeEach(() => {
      queryParams = {allFolders: 'true'};
      getUserPhotoTags.mockReturnValue(of(tags));
      getUserVideoFacets.mockReturnValue(
        facets(
          [
            [4, 1],
            [9, 1],
          ],
          1,
        ),
      );
    });

    it('should offer the tags shared with the photos, then the untagged videos, all picked, with their counts', () => {
      build();

      expect(component.tagFilter.options()).toEqual([
        {value: 4, label: 'Family', count: 1},
        {value: 9, label: 'Paris', count: 1},
        {value: 0, label: 'Untagged', count: 1},
      ]);
      expect(component.tagFilter.selected()).toEqual([4, 9, 0]);
      expect(lastTags()).toEqual([[], false]);
    });

    it('should list only the tags some video has, along with the other filters', () => {
      getUserVideoFacets.mockReturnValue(facets([[4, 2]], 0));
      build();

      expect(component.tagFilter.options().map((option) => option.label)).toEqual(['Family']);
    });

    it('should narrow the videos down to the tags picked, the untagged ones apart, from the first page, and count it', () => {
      build();
      component.pageIndex = 2;

      component.filterUpdated(component.tagFilter, [9, 0]);
      fixture.detectChanges();

      expect(lastTags()).toEqual([[9], true]);
      expect(getUserVideoFacets.mock.lastCall!.slice(6)).toEqual([[9], true]);
      expect(component.pageIndex).toBe(0);
      expect(toggle().querySelector('.filters-count')?.textContent).toContain('1');
    });

    it('should take the tags the address asks for', () => {
      queryParams = {allFolders: 'true', tag: '4'};
      build();

      expect(lastTags()).toEqual([[4], false]);
      expect(component.tagFilter.selected()).toEqual([4]);
    });

    it('should show no videos while no tag is picked', () => {
      build();
      getUserVideos.mockClear();

      component.filterUpdated(component.tagFilter, []);
      fixture.detectChanges();

      expect(getUserVideos).not.toHaveBeenCalled();
      expect(text()).toContain('No tags are selected');
    });
  });

  describe('tagging', () => {
    const tagButton = () => element().querySelector<HTMLButtonElement>('.video-card .tag-button')!;
    const editor = () => element().querySelector('app-photo-tag-editor');

    beforeEach(() => {
      queryParams = {allFolders: 'true'};
      getUserVideos.mockReturnValue(of({values: [{...video, tags: ['Family']}], total: 1, limit: 100, offset: 0}));
      getUserPhotoTags.mockReturnValue(of([{id: 4, name: 'Family', photoCount: 3, videoCount: 1}]));
    });

    it('should show the tags of a video over its preview, and count them on its tag button', () => {
      build();

      expect([...element().querySelectorAll('.video-card .tag')].map((tag) => tag.textContent?.trim())).toEqual(['Family']);
      expect(tagButton().getAttribute('aria-label')).toBe('Tags of trip.mp4: Family');
      expect(tagButton().textContent?.trim()).toBe('1');
    });

    it('should open the editor of the video under it, which the button closes again', () => {
      build();

      tagButton().click();
      fixture.detectChanges();

      expect(editor()).not.toBeNull();
      expect(tagButton().getAttribute('aria-expanded')).toBe('true');
      expect(element().querySelector('app-photo-tag-editor .chips')?.getAttribute('aria-label')).toBe('Tags of the video');

      tagButton().click();
      fixture.detectChanges();

      expect(editor()).toBeNull();
    });

    it('should keep the tags saved for the video, and load the tags and their counts again', () => {
      build();
      getUserPhotoTags.mockClear();
      getUserVideoFacets.mockClear();

      component.onTagsSaved(component.videos()[0], ['Family', 'Paris']);
      fixture.detectChanges();

      expect(component.videos()[0].tags).toEqual(['Family', 'Paris']);
      expect(getUserPhotoTags).toHaveBeenCalledTimes(1);
      expect(getUserVideoFacets).toHaveBeenCalledTimes(1);
    });

    it('should not offer to tag the videos until the tags are loaded', () => {
      getUserPhotoTags.mockReturnValue(new Subject());
      build();

      expect(element().querySelector('.video-card .tag-button')).toBeNull();
    });
  });

  describe('selecting', () => {
    const second: Video = {...video, id: '2', fileName: 'beach.mp4'};
    const third: Video = {...video, id: '3', fileName: 'hike.mp4'};
    const selectToggle = () => element().querySelector<HTMLButtonElement>('.select-toggle')!;
    const cards = () => [...element().querySelectorAll<HTMLButtonElement>('.video-card .thumb')];
    const clickCard = (index: number, shiftKey = false) => {
      cards()[index].dispatchEvent(new MouseEvent('click', {bubbles: true, shiftKey}));
      fixture.detectChanges();
    };

    beforeEach(() => {
      queryParams = {allFolders: 'true'};
      getUserVideos.mockReturnValue(of({values: [video, second, third], total: 3, limit: 100, offset: 0}));
      getUserPhotoTags.mockReturnValue(of([{id: 4, name: 'Family', photoCount: 3, videoCount: 1}]));
    });

    const startSelecting = () => {
      build();
      selectToggle().click();
      fixture.detectChanges();
    };

    it('should select the videos clicked, rather than play them, with Shift selecting the ones between', () => {
      startSelecting();

      clickCard(0);
      clickCard(2, true);

      expect(component.selectedVideoIds()).toEqual(['1', '2', '3']);
      expect(component.playingIndex()).toBeNull();
      expect(element().querySelectorAll('.video-card--selected')).toHaveLength(3);
      expect(text()).toContain('3 selected');
      // the tags of a video alone are edited outside the selection
      expect(element().querySelector('.video-card .tag-button')).toBeNull();
    });

    it('should add the tags picked to the videos selected, keeping them in place, and stop selecting', () => {
      startSelecting();
      clickCard(0);
      clickCard(1);
      getUserPhotoTags.mockClear();

      component.bulkTagging.set(true);
      fixture.detectChanges();
      const editor = element().querySelector('app-photos-bulk-tag-editor');
      expect(editor?.getAttribute('aria-label')).toBe('Add tags to 2 videos');

      component.onBulkTagsSaved([
        {photoId: '1', tags: ['Family', 'Paris']},
        {photoId: '2', tags: ['Paris']},
      ]);
      fixture.detectChanges();

      expect(component.videos().map((shown) => shown.tags)).toEqual([['Family', 'Paris'], ['Paris'], undefined]);
      expect(component.selecting()).toBe(false);
      expect(getUserPhotoTags).toHaveBeenCalledTimes(1);
    });

    it('should leave the selection on Escape, and when the map is shown', () => {
      startSelecting();
      clickCard(0);

      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
      fixture.detectChanges();

      expect(component.selecting()).toBe(false);
      expect(component.selectedCount()).toBe(0);

      selectToggle().click();
      component.viewModeUpdated('map');

      expect(component.selecting()).toBe(false);
    });

    it('should keep selected only the videos still shown once others are loaded', () => {
      startSelecting();
      clickCard(0);
      clickCard(2);
      getUserVideos.mockReturnValue(of({values: [third], total: 1, limit: 100, offset: 0}));

      component.filterUpdated(component.yearFilter, [2019]);

      expect(component.selectedVideoIds()).toEqual(['3']);
    });
  });

  describe('by location', () => {
    const lastLocations = () => getUserVideos.mock.lastCall!.slice(6, 8);
    const checklists = () => [...element().querySelectorAll('.sidebar app-checklist')].map((checklist) => checklist.textContent);

    beforeEach(() => {
      locations = [
        {id: 8, level: 'City', name: 'Minsk', description: 'Belarus', videoCount: 2, parentIds: [3]},
        {id: 3, level: 'Country', name: 'Belarus', description: null, videoCount: 4, parentIds: []},
      ];
    });

    it('should offer the locations under their levels, from the countries down, below the folders, all picked', () => {
      build();

      expect(component.locationFilter.options()).toEqual([
        {value: 0, label: 'Unknown location', count: 1},
        {value: 3, label: 'Belarus', group: 'Countries', hint: undefined, within: [], count: 1},
        {value: 8, label: 'Minsk', group: 'Cities', hint: 'Belarus', within: [3], count: 1},
      ]);
      expect(component.locationFilter.selected()).toEqual([0, 3, 8]);
      expect(checklists()).toEqual([
        expect.stringContaining('Years'),
        expect.stringContaining('Folders'),
        expect.stringContaining('Location'),
      ]);
      expect(lastLocations()).toEqual([[], false]);
    });

    it('should offer no location filter while no video is geocoded', () => {
      locations = [];
      build();

      expect(checklists()).not.toContainEqual(expect.stringContaining('Location'));
    });

    it('should narrow the videos down to the locations picked, the unknown one apart, from the first page', () => {
      queryParams = {allFolders: 'true'};
      build();
      component.pageIndex = 2;

      component.filterUpdated(component.locationFilter, [0, 8]);
      fixture.detectChanges();

      expect(lastLocations()).toEqual([[8], true]);
      expect(component.pageIndex).toBe(0);
      expect(toggle().querySelector('.filters-count')?.textContent).toContain('1');
    });

    it('should take the locations the address asks for', () => {
      queryParams = {location: ['3', '8'], allFolders: 'true'};
      build();

      expect(lastLocations()).toEqual([[3, 8], false]);
      expect(component.locationFilter.selected()).toEqual([3, 8]);
    });

    it('should show no videos while no location is picked', () => {
      queryParams = {allFolders: 'true'};
      build();
      getUserVideos.mockClear();

      component.filterUpdated(component.locationFilter, []);
      fixture.detectChanges();

      expect(getUserVideos).not.toHaveBeenCalled();
      expect(text()).toContain('No locations are selected');
    });

    it('should hide the locations while the duplicates are listed', () => {
      queryParams = {duplicates: 'true'};
      build();

      expect(checklists()).not.toContainEqual(expect.stringContaining('Location'));
    });
  });

  describe('on the map', () => {
    const brest: Video = {...video, id: '5', fileName: 'brest.mp4', latitude: 52.1, longitude: 23.7};
    const minsk: Video = {...video, id: '3', fileName: 'minsk.mp4', latitude: 53.9, longitude: 27.56};
    const mapView = () =>
      fixture.debugElement.query((debug) => debug.componentInstance instanceof MapViewStubComponent)?.componentInstance as
        MapViewStubComponent | undefined;
    const showMap = () => {
      component.viewModeUpdated('map');
      fixture.detectChanges();
    };

    beforeEach(() => {
      TestBed.overrideComponent(VideosComponent, {remove: {imports: [PhotosMapViewComponent]}, add: {imports: [MapViewStubComponent]}});
      getUserVideos.mockReturnValue(of({values: [video, minsk], total: 250, limit: 100, offset: 0}));
      // every video with a location, of every page, as the filters count them on the map
      getUserGeotaggedVideos.mockReturnValue(of([brest, minsk]));
      queryParams = {allFolders: 'true'};
    });

    it('should show every video with a location the filters take, not the page of the grid only, with no pages', () => {
      build();
      getUserVideos.mockClear();

      showMap();

      expect(getUserVideos).not.toHaveBeenCalled();
      expect(getUserGeotaggedVideos.mock.lastCall!.slice(1)).toEqual([[], [], [], false, [], false]);
      expect(
        mapView()
          ?.photos()
          .map((photo) => photo.id),
      ).toEqual(['5', '3']);
      expect(element().querySelector('app-paginator')).toBeNull();
      expect(element().querySelector('[aria-label="Sort order"]')).toBeNull();
      expect(text()).toContain('2 videos with a location');
    });

    it('should show the page of the grid again once back from the map', () => {
      build();
      showMap();
      getUserVideos.mockClear();

      component.viewModeUpdated('grid');
      fixture.detectChanges();

      expect(getUserVideos).toHaveBeenCalledTimes(1);
      expect(element().querySelector('app-paginator')).not.toBeNull();
    });

    it('should say so when no video the filters take has a location', () => {
      getUserGeotaggedVideos.mockReturnValue(of([]));
      build();
      showMap();

      expect(mapView()).toBeUndefined();
      expect(text()).toContain('No videos with a GPS location to show on the map');
    });

    it('should show the videos on the map by their previews, named as videos, and play them itself', () => {
      build();
      showMap();

      expect(element().querySelector('.grid')).toBeNull();
      expect(mapView()?.noun()).toBe('video');
      expect(mapView()?.openInViewer()).toBe(false);
      expect(mapView()?.photos()[1]).toEqual(
        expect.objectContaining({id: '3', thumbnailSmallUrl: minsk.previewUrl, latitude: 53.9, longitude: 27.56}),
      );
    });

    it('should hide the width switcher on the map, where it does nothing', () => {
      build();
      showMap();

      expect(element().querySelector('.width-modes')).toBeNull();
    });

    it('should play the video clicked on the map, stepping through the others of its spot', () => {
      build();
      showMap();

      mapView()!.opened.emit({photos: mapView()!.photos().slice().reverse(), index: 0});
      fixture.detectChanges();

      expect(component.playerVideos()).toEqual([minsk, brest]);
      expect(component.playingIndex()).toBe(0);

      // played otherwise, the player steps through the videos shown again
      component.play(brest);

      expect(component.playerVideos()).toEqual([brest, minsk]);
    });

    it('should narrow the videos of the map down by the filters of the sidebar, as the grid', () => {
      locations = [{id: 8, level: 'City', name: 'Minsk', description: 'Belarus', videoCount: 1, parentIds: [3]}];
      build();
      showMap();

      component.filterUpdated(component.locationFilter, [8]);
      fixture.detectChanges();

      expect(getUserGeotaggedVideos.mock.lastCall!.slice(3, 5)).toEqual([[8], false]);
      expect(mapView()).toBeDefined();
    });
  });

  it('should show no videos while no folder is picked', () => {
    queryParams = {allFolders: 'true'};
    build();
    getUserVideos.mockClear();

    component.filterUpdated(component.folderFilter, []);
    fixture.detectChanges();

    expect(getUserVideos).not.toHaveBeenCalled();
    expect(text()).toContain('No folders are selected');
  });

  it('should offer the folders in the sidebar, folded away, which a button hides and shows again', () => {
    queryParams = {allFolders: 'true'};
    build();

    const checklist = () => element().querySelectorAll('.sidebar app-checklist')[1];
    expect(checklist()?.textContent).toContain('Folders');
    expect(checklist()?.querySelector('.options')).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');

    toggle().click();
    fixture.detectChanges();

    expect(element().querySelector('.sidebar')).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');

    build();

    expect(component.sidebarOpen()).toBe(false);
  });

  it('should count the folder filter on the sidebar button, and show every folder again once it is reset', () => {
    queryParams = {allFolders: 'true'};
    build();
    component.pageIndex = 2;

    component.filterUpdated(component.folderFilter, ['disk:/Videos']);
    fixture.detectChanges();

    expect(toggle().querySelector('.filters-count')?.textContent).toContain('1');

    element().querySelector<HTMLButtonElement>('.filters-reset')!.click();
    fixture.detectChanges();

    expect(lastFolders()).toEqual([]);
    expect(component.pageIndex).toBe(0);
    expect(component.folderFilter.selected()).toEqual(['disk:/Camera Uploads', 'disk:/Videos']);
    expect(toggle().querySelector('.filters-count')).toBeNull();
    expect(element().querySelector('.filters-reset')).toBeNull();
  });

  it('should widen the grid when full width is picked, and remember it', () => {
    queryParams = {allFolders: 'true'};
    build();

    component.selectedWidth.set('full');
    fixture.detectChanges();

    expect(element().querySelector('.grid')?.classList.contains('grid--full')).toBe(true);

    build();

    expect(component.selectedWidth()).toBe('full');
  });

  it('should switch to the duplicates and back from the sidebar', () => {
    queryParams = {allFolders: 'true'};
    build();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    viewLinks()[2].click();
    fixture.detectChanges();

    expect(getUserVideoDuplicates).toHaveBeenCalledWith(1);
    expect(viewLinks()[2].getAttribute('aria-current')).toBe('page');
    expect(element().querySelector('.toolbar-title')?.textContent).toContain('Duplicates');
    // only the years apply to the copies
    expect([...element().querySelectorAll('.sidebar app-checklist')].map((checklist) => checklist.textContent)).toEqual([
      expect.stringContaining('Years'),
    ]);

    viewLinks()[1].click();
    fixture.detectChanges();

    expect(component.showDuplicates()).toBe(false);
    expect(currentView()).toContain('All videos');
    expect(element().querySelectorAll('.sidebar app-checklist')).toHaveLength(2);
    vi.restoreAllMocks();
  });

  it('should play a video when its preview is clicked', () => {
    queryParams = {allFolders: 'true'};
    build();

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.thumb')!.click();
    fixture.detectChanges();

    expect(component.playingIndex()).toBe(0);
    expect((fixture.nativeElement as HTMLElement).querySelector('app-video-player video')?.getAttribute('src')).toBe(video.videoUrl);
  });

  it('should list the duplicates by their groups when asked to', () => {
    build();

    component.toggleDuplicates();
    fixture.detectChanges();

    expect(getUserVideoDuplicates).toHaveBeenCalledWith(1);
    expect(text()).toContain('1.5 KB · 2 copies');
    expect(text()).toContain('/Camera Uploads');
    // a group shows once, beside the folder of each of its copies
    expect(element().querySelectorAll('app-video-duplicates .card').length).toBe(1);
    expect(element().querySelectorAll('app-video-duplicates .copy').length).toBe(2);
    expect(element().querySelector('.toolbar-title')?.textContent).toContain('Duplicates');
  });

  it('should narrow the duplicates down to the groups with a copy taken in the years picked, without loading them again', () => {
    const old: Video = {...video, id: '9', fileName: 'old.mp4', dateTimeTaken: new Date('2016-03-01T10:00:00Z')};
    getUserVideoDuplicates.mockReturnValue(of([group, {id: '9', fileName: 'old.mp4', size: 10, videos: [old, {...old, id: '10'}]}]));
    queryParams = {duplicates: 'true'};
    build();

    component.filterUpdated(component.yearFilter, [2016]);
    fixture.detectChanges();

    expect(getUserVideoDuplicates).toHaveBeenCalledTimes(1);
    expect(getUserVideos).not.toHaveBeenCalled();
    expect(text()).toContain('2 videos in 1 groups of copies');
    expect(text()).not.toContain('1.5 KB');
    expect(toggle().querySelector('.filters-count')?.textContent).toContain('1');

    // only the years and the months of the copies are listed, with how many groups each takes
    expect(component.yearFilter.options().map((option) => [option.value, option.count])).toEqual([
      [2016, 1],
      [201603, 1],
      [2019, 1],
      [201905, 1],
    ]);

    component.filterUpdated(component.yearFilter, [201905]);
    fixture.detectChanges();

    expect(text()).toContain('2 videos in 1 groups of copies');
    expect(text()).toContain('1.5 KB');

    element().querySelector<HTMLButtonElement>('.filters-reset')!.click();
    fixture.detectChanges();

    expect(text()).toContain('4 videos in 2 groups of copies');
    expect(getUserVideos).not.toHaveBeenCalled();
  });

  it('should take the duplicates the address asks for', () => {
    queryParams = {duplicates: 'true'};
    build();

    expect(getUserVideoDuplicates).toHaveBeenCalled();
    expect(getUserVideos).not.toHaveBeenCalled();
  });

  it('should play a copy with the player stepping through every duplicate', () => {
    queryParams = {duplicates: 'true'};
    build();

    element().querySelectorAll<HTMLButtonElement>('app-video-duplicates .copy-open')[1].click();
    fixture.detectChanges();

    expect(component.playerVideos()).toEqual([video, copy]);
    expect(component.playingIndex()).toBe(1);
  });

  it('should sort the duplicates into closed sections by the folders of their copies when there are several', () => {
    const other = (id: string, folderPath: string): Video => ({...video, id, fileName: `${id}.mp4`, folderPath});
    getUserVideoDuplicates.mockReturnValue(
      of([
        group,
        {id: '20', fileName: '20.mp4', size: 10, videos: [other('20', 'disk:/Videos'), other('21', 'disk:/Camera Uploads')]},
        {id: '30', fileName: '30.mp4', size: 10, videos: [other('30', 'disk:/Backup'), other('31', 'disk:/Camera Uploads')]},
      ]),
    );
    queryParams = {duplicates: 'true'};
    build();

    const sections = () => [...element().querySelectorAll<HTMLDetailsElement>('app-video-duplicates details.section')];
    expect(sections().map((section) => [...section.querySelectorAll('.folder')].map((folder) => folder.textContent?.trim()))).toEqual([
      ['/Camera Uploads', '/Videos'],
      ['/Backup', '/Camera Uploads'],
    ]);
    expect(sections().map((section) => section.querySelector('.count')?.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      '2 groups · 4 videos',
      '1 group · 2 videos',
    ]);
    expect(element().querySelectorAll('app-video-duplicates .card').length).toBe(0);

    sections()[0].open = true;
    sections()[0].dispatchEvent(new Event('toggle'));
    fixture.detectChanges();

    expect(sections()[0].querySelectorAll('.card').length).toBe(2);
    expect(sections()[1].querySelectorAll('.card').length).toBe(0);
  });

  it('should say so when there are no duplicates', () => {
    getUserVideoDuplicates.mockReturnValue(of([]));
    queryParams = {duplicates: 'true'};
    build();

    expect(text()).toContain('No duplicate videos');
  });
});
