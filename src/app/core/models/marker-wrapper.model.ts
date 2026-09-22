export interface MarkerIcon {
  url: string;
  scaledSize: {width: number; height: number};
  origin: {x: number; y: number};
  anchor: {x: number; y: number};
}

export class MarkerWrapper {
  latitude: number;
  longitude: number;
  title: string;
  icon: MarkerIcon;
  previewImageUrl: string;
}
