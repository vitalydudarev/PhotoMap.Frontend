/** Mirrors the backend's `VideoDto`: a video of a photo source, shown by the preview image the source made of it. */
export interface Video {
  id: string;
  photoSourceId: number;
  previewUrl: string;
  fileName: string;
  /** The folder of the video in the photo source, without its file name, such as `disk:/Camera Uploads`. */
  folderPath?: string;
  mimeType?: string;
  /** In bytes. */
  size: number;
  dateTimeTaken: Date;
  /** The date the video was taken, as the photo source read it from its EXIF; none when it has no EXIF. */
  exifDateTime?: Date;
  latitude?: number;
  longitude?: number;
}
