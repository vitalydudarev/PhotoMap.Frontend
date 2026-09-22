import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {GalleryModule} from '@ks89/angular-modal-gallery';
import {beforeEach, describe, expect, it} from 'vitest';

import {UserPhotosService} from '../../core/services/user-photos.service';
import {GalleryComponent} from './gallery.component';

describe('GalleryComponent', () => {
  let component: GalleryComponent;
  let fixture: ComponentFixture<GalleryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // GalleryModule carries the MODAL_GALLERY_COMPONENT provider ModalGalleryService depends on.
      imports: [GalleryComponent, GalleryModule],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), UserPhotosService],
    }).compileComponents();

    fixture = TestBed.createComponent(GalleryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to the thumbnail view mode', () => {
    expect(component.selectedViewMode).toBe(component.thumbViewMode);
  });
});
