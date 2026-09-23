// TODO: point these at the deployed backend.
// Until then a production build still talks to the local development backend.
export const environment = {
  production: true,
  backendUrl: 'https://localhost:5001',
  photoMapApiUrl: 'https://localhost:5001/api',
  notificationHub: 'https://localhost:5001/notifications',
};
