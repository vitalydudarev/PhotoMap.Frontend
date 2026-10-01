/**
 * What kind of photo a photo is, as the backend puts the photos in their categories. A photo can be in several, or in
 * none: `Other` takes the photos in none of them. `Deleted` takes the photos the user marked as deleted, which every
 * other category leaves out, as does asking for no category at all.
 */
export const PhotoCategory = {
  Other: 0,
  Screenshot: 1,
  DroneFootage: 2,
  Deleted: 3,
} as const;

export type PhotoCategory = (typeof PhotoCategory)[keyof typeof PhotoCategory];
