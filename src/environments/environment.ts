// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --configuration production` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  backendUrl: 'https://localhost:5001',
  photoMapApiUrl: 'https://localhost:5001/api',
  notificationHub: 'https://localhost:5001/notifications',
  // The key of the Maps JavaScript API, for the Google Maps option on the map views; OpenStreetMap needs none.
  // The map ID enables the advanced markers the photos are drawn with.
  googleMapsApiKey: '',
  googleMapsMapId: 'DEMO_MAP_ID',
};
