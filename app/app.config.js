// app.json'un üzerine gizli değerleri ortamdan enjekte eder.
// Lokal geliştirme: app/.env (gitignore'lu) → Expo CLI otomatik yükler.
// EAS build:      eas secret:create --name GOOGLE_MAPS_API_KEY --value ...
export default ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
      },
    },
  },
});
