/** One EXIF directory, such as the camera, with its tags to show. */
export interface ExifSection {
  title: string;
  rows: ExifRow[];
}

export interface ExifRow {
  label: string;
  value: string;
}

type ExifObject = Record<string, unknown>;

/** The directories the worker reads, in the order to show them. */
const SECTION_TITLES: Record<string, string> = {
  ExifIfd0: 'Camera',
  ExifSubIfd: 'Image',
  Gps: 'GPS',
};

/** The tags worth naming otherwise than after themselves. */
const LABELS: Record<string, string> = {
  DateTimeOriginal: 'Taken',
  DateTimeDigitized: 'Digitized',
  TimeZoneOriginal: 'Time zone (taken)',
  TimeZoneDigitized: 'Time zone (digitized)',
  DateTimeStamp: 'GPS time',
  ImgDirection: 'Image direction',
  ImgDirectionRef: 'Image direction reference',
  DestBearing: 'Destination bearing',
  DestBearingRef: 'Destination bearing reference',
  SpeedRef: 'Speed unit',
  HorizontalPositioningError: 'Positioning error',
};

/** The tags shown in pixels. */
const PIXEL_TAGS = new Set(['Width', 'Height']);

/** An EXIF date, in the camera's own time: it is shown as it is, as there is no zone to convert it from. */
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/;

/**
 * The EXIF of a photo, as the backend sends it, in sections to show: the directories the worker reads first, then
 * any other, each with the tags that have a value. A tag added to the worker shows up, named after itself.
 */
export function exifSections(exif: unknown): ExifSection[] {
  if (!isObject(exif)) {
    return [];
  }

  const known = Object.keys(SECTION_TITLES).filter((name) => name in exif);
  const others = Object.keys(exif).filter((name) => !(name in SECTION_TITLES));

  return [...known, ...others]
    .map((name) => ({title: SECTION_TITLES[name] ?? humanize(name), rows: rows(exif[name])}))
    .filter((section) => section.rows.length > 0);
}

function rows(directory: unknown): ExifRow[] {
  if (!isObject(directory)) {
    return [];
  }

  return Object.entries(directory)
    .filter(([tag, value]) => !isEmpty(value) && !isFoldedReference(directory, tag))
    .map(([tag, value]) => ({label: LABELS[tag] ?? humanize(tag), value: format(directory, tag, value)}));
}

/** The reference of a coordinate or of the altitude, shown with the value it refers to. */
function isFoldedReference(directory: ExifObject, tag: string): boolean {
  const valueTag = tag.endsWith('Ref') ? tag.slice(0, -'Ref'.length) : undefined;

  return valueTag !== undefined && !isEmpty(directory[valueTag]) && (isDegrees(directory[valueTag]) || valueTag === 'Altitude');
}

function format(directory: ExifObject, tag: string, value: unknown): string {
  if (isDegrees(value)) {
    const reference = directory[`${tag}Ref`];

    return `${value.Degrees}° ${value.Minutes}′ ${round(value.Seconds, 2)}″${typeof reference === 'string' ? ` ${reference}` : ''}`;
  }

  // 1 is below sea level
  if (tag === 'Altitude' && typeof value === 'number') {
    return `${round(directory['AltitudeRef'] === 1 ? -value : value, 1)} m`;
  }

  if (typeof value === 'number') {
    return PIXEL_TAGS.has(tag) ? `${value} px` : String(round(value, 6));
  }

  if (typeof value === 'string') {
    const dateTime = DATE_TIME.exec(value);

    return dateTime ? `${dateTime[1]} ${dateTime[2]}` : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => format(directory, tag, item)).join(', ');
  }

  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** "DateTimeOriginal" as "Date time original", keeping an acronym such as ISO as it is. */
function humanize(name: string): string {
  const words = name
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(' ')
    .map((word) => (/^[A-Z\d]{2,}$/.test(word) ? word : word.toLowerCase()))
    .join(' ');

  return words.charAt(0).toUpperCase() + words.slice(1);
}

function isDegrees(value: unknown): value is {Degrees: number; Minutes: number; Seconds: number} {
  return (
    isObject(value) && typeof value['Degrees'] === 'number' && typeof value['Minutes'] === 'number' && typeof value['Seconds'] === 'number'
  );
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

function isObject(value: unknown): value is ExifObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function round(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}
