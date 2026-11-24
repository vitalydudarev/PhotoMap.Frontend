/**
 * Mirrors the backend's `PhotoTagDto`: a tag of the photos and the videos of the user, which the gallery and the videos
 * are filtered by; a tag is the same for both.
 */
export interface PhotoTag {
  id: number;
  /** As the user first wrote it; a tag of the same name in another case is the same tag. */
  name: string;
  /** How many photos have the tag, the deleted ones too. */
  photoCount: number;
  /** How many videos have the tag; none from a backend that does not tell. */
  videoCount?: number;
}

/** How many photos and videos have the tag. */
export function tagUseCount(tag: PhotoTag): number {
  return tag.photoCount + (tag.videoCount ?? 0);
}

/** Mirrors the backend's `TagSuggestionDto`: a tag suggested for a photo, and why. */
export interface TagSuggestion {
  name: string;
  /** Photos taken around the same time have the tag, or the tag tells when the photo was taken. */
  byDate: boolean;
  /** Photos taken nearby have the tag. */
  byLocation: boolean;
}

/** Mirrors the backend's `PhotoTagsDto`: the tags of a photo, by name. */
export interface PhotoTags {
  photoId: string;
  tags: string[];
}

/** The longest name of a tag, and the most tags a photo has, as the backend takes them. */
export const TAG_MAX_LENGTH = 50;
export const TAGS_PER_PHOTO = 30;

/** The name as the backend saves it: trimmed, with single spaces between its words. */
export function cleanTagName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** Whether two names are of the same tag, whatever their case. */
export function sameTag(a: string, b: string): boolean {
  return cleanTagName(a).toLocaleLowerCase() === cleanTagName(b).toLocaleLowerCase();
}
