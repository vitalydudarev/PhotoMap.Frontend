import {ComponentFixture, TestBed} from '@angular/core/testing';
import {beforeEach, describe, expect, it} from 'vitest';

import {Video} from '../../../core/models/video.model';
import {VideoPlayerComponent} from './video-player.component';

describe('VideoPlayerComponent', () => {
  let fixture: ComponentFixture<VideoPlayerComponent>;
  let component: VideoPlayerComponent;

  const videos: Video[] = [1, 2, 3].map((id) => ({
    id: id.toString(),
    photoSourceId: 2,
    previewUrl: `https://localhost/api/videos/${id}/preview`,
    videoUrl: `https://localhost/api/videos/${id}`,
    fileName: `video${id}.mp4`,
    size: 1024,
    dateTimeTaken: new Date('2024-05-01T10:00:00Z'),
  }));

  const element = () => fixture.nativeElement as HTMLElement;
  const videoElement = () => element().querySelector('video');
  const press = (key: string, target: Element = element().querySelector('.player')!) => {
    target.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true}));
    fixture.detectChanges();
  };

  const open = (index: number | null) => {
    fixture.componentRef.setInput('index', index);
    fixture.detectChanges();
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(VideoPlayerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('videos', videos);
    fixture.detectChanges();
  });

  it('should show nothing while closed', () => {
    expect(element().querySelector('.player')).toBeNull();
  });

  it('should play the video by its link, with its preview standing in', () => {
    open(1);

    expect(videoElement()?.getAttribute('src')).toBe(videos[1].videoUrl);
    expect(videoElement()?.getAttribute('poster')).toBe(videos[1].previewUrl);
    expect(element().textContent).toContain('video2.mp4');
    expect(element().textContent).toContain('2 / 3');
  });

  it('should step to the videos before and after it', () => {
    open(1);

    press('ArrowRight');
    expect(component.index()).toBe(2);

    // there is no video after the last one
    press('ArrowRight');
    expect(component.index()).toBe(2);

    press('ArrowLeft');
    expect(component.index()).toBe(1);
  });

  it('should leave the arrows to the video while it has the focus, to seek', () => {
    open(1);

    press('ArrowRight', videoElement()!);

    expect(component.index()).toBe(1);
  });

  it('should close on Escape', () => {
    open(0);

    press('Escape');

    expect(component.index()).toBeNull();
    expect(element().querySelector('.player')).toBeNull();
  });

  it('should say so when the video cannot be played', () => {
    open(0);

    videoElement()!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(element().textContent).toContain('could not be played');

    // the next video gets a chance of its own
    press('ArrowRight');
    expect(videoElement()).toBeTruthy();
  });
});
