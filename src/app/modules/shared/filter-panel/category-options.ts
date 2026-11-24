import {PhotoCategory} from 'src/app/core/models/photo-category.model';
import {MultiselectOption} from 'src/app/shared/ui/multiselect/multiselect.component';

/**
 * The options of the category filter. Other photos are an option too, so that picking every category still leaves no
 * photo out. The deleted photos are a view of their own rather than a category, as the server takes them along with
 * the photos of the other categories rather than narrowing them down.
 */
export const CATEGORY_OPTIONS: readonly MultiselectOption<number>[] = [
  {value: PhotoCategory.Screenshot, label: 'Screenshots'},
  {value: PhotoCategory.DroneFootage, label: 'Drone footage'},
  {value: PhotoCategory.Other, label: 'Other photos'},
];
