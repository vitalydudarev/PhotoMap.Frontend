import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute, convertToParamMap, provideRouter} from '@angular/router';
import {of} from 'rxjs';
import {beforeEach, describe, expect, it, vi} from 'vitest';

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

  beforeEach(() => {
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
    expect(text()).toContain('Show all videos');
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
