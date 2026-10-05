// TODO: point these at the deployed backend.
// Until then a production build still talks to the local development backend.
export const environment = {
  production: true,
  backendUrl: 'https://localhost:5002',
  photoMapApiUrl: 'https://localhost:5002/api',
  notificationHub: 'https://localhost:5002/notifications',
  googleMapsApiKey: '',
  googleMapsMapId: 'DEMO_MAP_ID',
};
