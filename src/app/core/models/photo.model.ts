export interface Photo {
  id: string;
  photoUrl: string;
  thumbnailSmallUrl: string;
  thumbnailLargeUrl: string;
  dateTimeTaken: Date;
  latitude?: number;
  longitude?: number;
  /** How far off the location may be, in meters, as the camera reported it; none when it did not. */
  horizontalPositioningError?: number | null;
  fileName: string;
  /** The path of the photo in its photo source, with its file name. */
  path?: string | null;
  /** When the user marked the photo as deleted, none while it is not. */
  deletedOn?: Date | null;
}

/** Mirrors the backend's `PhotoDuplicateGroupDto`: photos that are copies of one another, of the same contents to the byte. */
export interface PhotoDuplicateGroup {
  /** The ID of the first photo of the group. */
  id: string;
  /** By their ID, two at least. */
  photos: Photo[];
}
