# MyPhotoAI native app

This is the real React Native/Expo foundation for the MyPhotoAI Android + iPhone app. It replaces the browser-only prototype with native APIs for device photos, local notifications, device calendar events, system sharing, and SQLite local storage.

## Run

1. Install Node.js LTS.
2. In this folder run `npm install`.
3. Run `npx expo start` for the development server.
4. For native development builds use `npx expo run:android` or `npx expo run:ios` (iOS requires macOS/Xcode for local builds).

## Production

Install EAS CLI, set an EAS project ID in `app.json`, then use `eas build --platform android --profile production` for an Android App Bundle. Google Play currently requires new apps and updates to target Android 16 / API 36 or higher.

The local-AI service is intentionally isolated in `src/services/localAI.ts`; connect a bundled/on-device vision model there so photo descriptions and face recognition remain local.
