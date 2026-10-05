/** Mirrors the backend's `VideoDto`: a video of a photo source, shown by the preview image the source made of it. */
export interface Video {
  id: string;
  photoSourceId: number;
  previewUrl: string;
  /** Streams the video from its photo source, a range at a time. */
  videoUrl: string;
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

/** Mirrors the backend's `VideoDuplicateGroupDto`: videos that are copies of one another, of the same size and file name. */
export interface VideoDuplicateGroup {
  /** The ID of the first video of the group. */
  id: string;
  /** The file name of the first video of the group, the others differ from it in case at most. */
  fileName: string;
  /** The size of each video of the group, in bytes. */
  size: number;
  /** By their ID, two at least. */
  videos: Video[];
}
