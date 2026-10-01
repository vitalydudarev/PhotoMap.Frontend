export interface Photo {
  id: string;
  photoUrl: string;
  thumbnailSmallUrl: string;
  thumbnailLargeUrl: string;
  dateTimeTaken: Date;
  latitude?: number;
  longitude?: number;
  fileName: string;
  /** When the user marked the photo as deleted, none while it is not. */
  deletedOn?: Date | null;
}
