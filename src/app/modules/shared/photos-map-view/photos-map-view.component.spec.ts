import {Component, input, output} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Router, provideRouter} from '@angular/router';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {MapArea} from 'src/app/core/models/map-area.model';
import {Photo} from 'src/app/core/models/photo.model';
import {ButtonDirective} from 'src/app/shared/ui/button/button.directive';
import {IconComponent} from 'src/app/shared/ui/icon/icon.component';
import {SegmentedComponent} from 'src/app/shared/ui/segmented/segmented.component';

import {PhotoGroupPanelComponent} from './photo-group-panel.component';
import {GeotaggedPhoto, PhotoSelection} from './photo-map.model';
import {PhotosMapViewComponent} from './photos-map-view.component';

/** Stands in for the maps, which draw nothing in a test: tells the area the test gives it. */
@Component({selector: 'app-leaflet-photo-map', template: ''})
class MapStubComponent {
  readonly photos = input.required<readonly GeotaggedPhoto[]>();
  readonly highlighted = input<readonly GeotaggedPhoto[] | undefined>(undefined);
  readonly showAccuracyAreas = input(false);
  readonly photosSelected = output<PhotoSelection>();
  readonly groupOpened = output<readonly GeotaggedPhoto[]>();
  readonly areaChanged = output<MapArea>();
}

describe('PhotosMapViewComponent', () => {
  let fixture: ComponentFixture<PhotosMapViewComponent>;

  const photo = (id: string, latitude?: number, longitude?: number): Photo => ({
    id,
    photoUrl: `/photo-${id}.jpg`,
    thumbnailSmallUrl: `/thumb-${id}.jpg`,
    thumbnailLargeUrl: `/thumb-${id}.jpg`,
    dateTimeTaken: new Date(2024, 4, 3),
    fileName: `IMG_${id}.jpg`,
    latitude,
    longitude,
  });

  const lisbon: MapArea = {west: -9.23, south: 38.69, east: -9.09, north: 38.8};

  const element = () => fixture.nativeElement as HTMLElement;
  const galleryLink = () => element().querySelector<HTMLButtonElement>('.gallery-link');

  const moveMapTo = (area: MapArea) => {
    const map = fixture.debugElement.query((debug) => debug.componentInstance instanceof MapStubComponent);
    (map.componentInstance as MapStubComponent).areaChanged.emit(area);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    try {
      localStorage.clear();
    } catch {
      // the provider is OpenStreetMap by default anyway
    }

    await TestBed.configureTestingModule({
      imports: [PhotosMapViewComponent],
      providers: [provideRouter([])],
    })
      .overrideComponent(PhotosMapViewComponent, {
        set: {imports: [ButtonDirective, IconComponent, MapStubComponent, PhotoGroupPanelComponent, SegmentedComponent]},
      })
      .compileComponents();

    fixture = TestBed.createComponent(PhotosMapViewComponent);
    fixture.componentRef.setInput('photos', [photo('1', 38.72, -9.14), photo('2', 38.75, -9.2), photo('3', 53.9, 27.56), photo('4')]);
    fixture.componentRef.setInput('showInGallery', true);
    fixture.detectChanges();
  });

  it('should offer the photos within the area the map shows to the gallery, by how many there are', () => {
    moveMapTo(lisbon);

    expect(galleryLink()?.textContent).toContain('Show 2 in gallery');
  });

  it('should open the gallery on the area the map shows, with the photos of every folder', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    moveMapTo(lisbon);

    galleryLink()!.click();

    expect(navigate).toHaveBeenCalledWith(['/gallery'], {
      queryParams: {area: '-9.23,38.69,-9.09,38.8', allFolders: true},
    });
  });

  it('should not offer the gallery until the map has been drawn, or when it shows none of the photos', () => {
    expect(galleryLink()).toBeNull();

    moveMapTo({west: 100, south: 0, east: 110, north: 10});

    expect(galleryLink()).toBeNull();
  });

  it('should not offer the gallery unless asked to', () => {
    fixture.componentRef.setInput('showInGallery', false);
    moveMapTo(lisbon);

    expect(galleryLink()).toBeNull();
  });
});
