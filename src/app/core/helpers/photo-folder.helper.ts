import {Photo} from '../models/photo.model';

/** The folder of the photo, without the name of the disk it is on: `disk:/Camera Uploads/a.jpg` as `/Camera Uploads`. */
export function photoFolder(photo: Photo): string {
  if (!photo.path) {
    return '—';
  }

  const folder = photo.path.replace(/^[^/]*:(?=\/)/, '').replace(/\/[^/]*$/, '');

  return folder || '/';
}
