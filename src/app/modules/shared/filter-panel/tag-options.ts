import {PhotoTag} from 'src/app/core/models/photo-tag.model';
import {MultiselectOption} from 'src/app/shared/ui/multiselect/multiselect.component';

/**
 * The photos with no tag are an option of the tags too, so that picking every tag still leaves no photo out. The IDs of
 * the tags start at 1.
 */
export const UNTAGGED = 0;

/** The options of the tag filter: the tags, by name, then the photos with no tag; none with no tag at all. */
export function tagOptions(tags: readonly PhotoTag[]): MultiselectOption<number>[] {
  return tags.length === 0 ? [] : [...tags.map((tag) => ({value: tag.id, label: tag.name})), {value: UNTAGGED, label: 'Untagged'}];
}
