export interface Photo {
  id: string;
  /** The photo itself, as it is in its source. */
  photoUrl: string;
  /**
   * The photo to be viewed: the XXXL preview of it on Yandex.Disk, much smaller than the photo, or the photo itself
   * when its source makes no such preview.
   */
  previewUrl?: string;
  thumbnailSmallUrl: string;
  thumbnailLargeUrl: string;
  dateTimeTaken: Date;
  latitude?: number;
  longitude?: number;
  /** How far off the location may be, in meters, as the camera reported it; none when it did not. */
  horizontalPositioningError?: number | null;
  fileName: string;
  /** The photo source the photo is kept in. */
  photoSourceId?: number;
  /** The path of the photo in its photo source, with its file name. */
  path?: string | null;
  /** When the user marked the photo as deleted, none while it is not. */
  deletedOn?: Date | null;
  /** The names of the tags of the photo, by name. Only the photos of the gallery tell them. */
  tags?: string[];
}

/** Mirrors the backend's `PhotoDuplicateGroupDto`: photos that are copies of one another, of the same contents to the byte. */
export interface PhotoDuplicateGroup {
  /** The ID of the first photo of the group. */
  id: string;
  /** By their ID, two at least. */
  photos: Photo[];
}
