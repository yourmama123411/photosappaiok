# Build MyPhotoAI

## 1. Install prerequisites

- Node.js 20.19+ (Expo SDK 55 requirement)
- Android Studio + Android SDK 36 for local Android builds
- Xcode 26.2+ on macOS for local iOS builds
- An Expo/EAS account for cloud builds

## 2. Install dependencies

```bash
npm install
```

If Expo reports version mismatches, run:

```bash
npx expo install --fix
```

## 3. Run the development server

```bash
npx expo start
```

For real native APIs such as Calendar and full notification testing, use a development build rather than relying on Expo Go.

## 4. Android development build

```bash
npx expo run:android
```

## 5. Android Play Store build

Log in to EAS and initialize the project:

```bash
eas login
eas init
```

Then replace the placeholder EAS project ID in `app.json` with the ID EAS creates, and build:

```bash
eas build --platform android --profile production
```

The production Android artifact is an `.aab` suitable for Google Play submission.

## 6. iPhone build

On macOS:

```bash
npx expo run:ios
```

or use EAS:

```bash
eas build --platform ios --profile production
```

## Native capabilities already wired

- Device photo library
- Local SQLite database
- Local task notifications
- Android notification channel
- Device calendar events
- Native system sharing (Android share sheet / Quick Share-compatible targets and iOS share sheet / AirDrop-compatible targets)
- Long-press photo action menu
- Sticky Notes
- Face-name storage
- Search overlay
- Photo corner-radius settings
- Local-AI service boundary

## Important before publishing

1. Replace the temporary app icon/branding assets.
2. Replace `com.myphotoai.app` with your final unique Android package ID and iOS bundle ID.
3. Connect the final on-device AI model in `src/services/localAI.ts`.
4. Add a real task due-date picker so notifications are scheduled for the user's selected time rather than the current development test delay.
5. Test photo permissions and the Google Play photo/video permission policy before release.
6. Fill out Google Play Data Safety and the privacy policy accurately based on the final implementation.
