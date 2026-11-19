import {Component, input, output} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {VideoLocation} from '../../core/models/photo-location.model';
import {Video, VideoDuplicateGroup} from '../../core/models/video.model';
import {Photo} from '../../core/models/photo.model';
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
  let locations: VideoLocation[];

  const video: Video = {
    id: '1',
    photoSourceId: 2,
    previewUrl: 'https://localhost/api/videos/1/preview',
    videoUrl: 'https://localhost/api/videos/1',
    fileName: 'trip.mp4',
    folderPath: 'disk:/Videos',
    size: 1024,
    dateTimeTaken: new Date('2024-05-01T10:00:00Z'),
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
        {
          provide: VideosService,
          useValue: {
            getUserVideos,
            getUserVideoDuplicates,
            getUserVideoFolders: vi.fn(() => of(folders)),
            getUserVideoYears: () => of([2016, 2019]),
            getUserVideoLocations: () => of(locations),
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

  describe('by year', () => {
    const lastYears = () => getUserVideos.mock.lastCall![5];

    it('should offer the years in the sidebar, above the folders, all picked, and ask for every year', () => {
      build();

      expect([...element().querySelectorAll('.sidebar app-checklist')].map((checklist) => checklist.textContent)).toEqual([
        expect.stringContaining('Years'),
        expect.stringContaining('Folders'),
      ]);
      expect(component.yearFilter.selected()).toEqual([2016, 2019]);
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
      expect(component.yearFilter.selected()).toEqual([2016]);
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
      expect(component.yearFilter.selected()).toEqual([2016, 2019]);
    });
  });

  describe('by location', () => {
    const lastLocations = () => getUserVideos.mock.lastCall!.slice(6, 8);
    const checklists = () => [...element().querySelectorAll('.sidebar app-checklist')].map((checklist) => checklist.textContent);

    beforeEach(() => {
      locations = [
        {id: 8, level: 'City', name: 'Minsk', description: 'Belarus', videoCount: 2},
        {id: 3, level: 'Country', name: 'Belarus', description: null, videoCount: 4},
      ];
    });

    it('should offer the locations under their levels, from the countries down, below the folders, all picked', () => {
      build();

      expect(component.locationFilter.options()).toEqual([
        {value: 0, label: 'Unknown location'},
        {value: 3, label: 'Belarus', group: 'Countries', hint: undefined},
        {value: 8, label: 'Minsk', group: 'Cities', hint: 'Belarus'},
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
    const minsk: Video = {...video, id: '3', fileName: 'minsk.mp4', latitude: 53.9, longitude: 27.56};
    const mapView = () =>
      fixture.debugElement.query((debug) => debug.componentInstance instanceof MapViewStubComponent)?.componentInstance as
        MapViewStubComponent | undefined;
    const showMap = () => {
      component.selectedViewMode.set('map');
      fixture.detectChanges();
    };

    beforeEach(() => {
      TestBed.overrideComponent(VideosComponent, {remove: {imports: [PhotosMapViewComponent]}, add: {imports: [MapViewStubComponent]}});
      getUserVideos.mockReturnValue(of({values: [video, minsk], total: 2, limit: 100, offset: 0}));
      queryParams = {allFolders: 'true'};
    });

    it('should show the videos of the page on the map by their previews, named as videos, and play them itself', () => {
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

      expect(component.playerVideos()).toEqual([minsk, video]);
      expect(component.playingIndex()).toBe(0);

      // played from the grid, the player steps through the videos of the page again
      component.play(video);

      expect(component.playerVideos()).toEqual([video, minsk]);
    });

    it('should narrow the videos of the map down by the filters of the sidebar, as the grid', () => {
      locations = [{id: 8, level: 'City', name: 'Minsk', description: 'Belarus', videoCount: 1}];
      build();
      showMap();

      component.filterUpdated(component.locationFilter, [8]);
      fixture.detectChanges();

      expect(getUserVideos.mock.lastCall!.slice(6, 8)).toEqual([[8], false]);
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

    component.filterUpdated(component.yearFilter, [2019]);
    fixture.detectChanges();

    expect(text()).toContain('No duplicate videos taken in the selected years.');

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
