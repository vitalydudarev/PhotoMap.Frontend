/** A folder without the name of the disk it is on, `disk:/Camera Uploads` as `/Camera Uploads`. */
export function folderLabel(folderPath: string): string {
  return folderPath.replace(/^[^/]*:(?=\/)/, '');
}

/** A file with its folder, without the name of the disk it is on: `disk:/Camera Uploads` and `a.jpg` as `/Camera Uploads/a.jpg`. */
export function fileLabel(fileName: string, folderPath?: string | null): string {
  if (!folderPath) {
    return fileName;
  }

  return `${folderLabel(folderPath).replace(/\/+$/, '')}/${fileName}`;
}

/** A size in bytes the way a file manager shows it, such as `1.2 GB`. */
export function sizeLabel(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }

  return `${unit === 0 ? size : size.toFixed(1)} ${units[unit]}`;
}
