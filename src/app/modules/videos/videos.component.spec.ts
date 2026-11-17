import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {Video, VideoDuplicateGroup} from '../../core/models/video.model';
import {VideosService} from '../../core/services/videos.service';
import {VideosComponent} from './videos.component';

describe('VideosComponent', () => {
  let fixture: ComponentFixture<VideosComponent>;
  let component: VideosComponent;
  let getUserVideos: ReturnType<typeof vi.fn>;
  let getUserVideoDuplicates: ReturnType<typeof vi.fn>;
  let queryParams: Record<string, string | string[]>;

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
            getUserVideoFolders: () => of(['disk:/Camera Uploads', 'disk:/Videos']),
          },
        },
      ],
    });
  });

  it('should list the videos of every folder by their previews', () => {
    build();

    expect(lastFolders()).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).querySelector('img')?.getAttribute('src')).toBe(video.previewUrl);
  });

  it('should offer the folders without the name of the disk', () => {
    build();

    expect(component.folderFilter.options().map((option) => option.label)).toEqual(['/Camera Uploads', '/Videos']);
  });

  it('should narrow the videos down to the folders picked', () => {
    build();

    component.folderFilterUpdated(['disk:/Videos']);

    expect(lastFolders()).toEqual(['disk:/Videos']);
    expect(component.pageIndex).toBe(0);
  });

  it('should take the folders the address asks for', () => {
    queryParams = {folder: 'disk:/Camera Uploads'};
    build();

    expect(lastFolders()).toEqual(['disk:/Camera Uploads']);
    expect(component.folderFilter.selected()).toEqual(['disk:/Camera Uploads']);
  });

  it('should show no videos while no folder is picked', () => {
    build();
    getUserVideos.mockClear();

    component.folderFilterUpdated([]);
    fixture.detectChanges();

    expect(getUserVideos).not.toHaveBeenCalled();
    expect(text()).toContain('No folders are selected');
  });

  it('should offer the folders in the sidebar, folded away, which a button hides and shows again', () => {
    build();

    const checklist = () => element().querySelector('.sidebar app-checklist');
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
    build();
    component.pageIndex = 2;

    component.folderFilterUpdated(['disk:/Videos']);
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
    build();

    component.selectedWidth.set('full');
    fixture.detectChanges();

    expect(element().querySelector('.grid')?.classList.contains('grid--full')).toBe(true);

    build();

    expect(component.selectedWidth()).toBe('full');
  });

  it('should switch to the duplicates and back from the sidebar', () => {
    build();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    const viewLinks = () => [...element().querySelectorAll<HTMLButtonElement>('.view-link')];
    viewLinks()[1].click();
    fixture.detectChanges();

    expect(getUserVideoDuplicates).toHaveBeenCalledWith(1);
    expect(viewLinks()[1].getAttribute('aria-current')).toBe('page');
    expect(element().querySelector('.toolbar-title')?.textContent).toContain('Duplicates');
    expect(element().querySelector('.sidebar app-checklist')).toBeNull();

    viewLinks()[0].click();
    fixture.detectChanges();

    expect(component.showDuplicates()).toBe(false);
    expect(element().querySelector('.sidebar app-checklist')).not.toBeNull();
    vi.restoreAllMocks();
  });

  it('should play a video when its preview is clicked', () => {
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
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.group button.thumb').length).toBe(2);
    expect(element().querySelector('.toolbar-title')?.textContent).toContain('Duplicates');
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

    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button.thumb')[1].click();
    fixture.detectChanges();

    expect(component.playerVideos()).toEqual([video, copy]);
    expect(component.playingIndex()).toBe(1);
  });

  it('should say so when there are no duplicates', () => {
    getUserVideoDuplicates.mockReturnValue(of([]));
    queryParams = {duplicates: 'true'};
    build();

    expect(text()).toContain('No duplicate videos');
  });
});
