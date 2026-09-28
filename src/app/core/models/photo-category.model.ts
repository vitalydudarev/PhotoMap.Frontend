/**
 * What kind of photo a photo is, as the backend puts the photos in their categories. A photo can be in several, or in
 * none: `Other` takes the photos in none of them.
 */
export const PhotoCategory = {
  Other: 0,
  Screenshot: 1,
  DroneFootage: 2,
} as const;

export type PhotoCategory = (typeof PhotoCategory)[keyof typeof PhotoCategory];
