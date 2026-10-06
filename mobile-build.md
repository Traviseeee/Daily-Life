# MYLIFE Mobile Build Notes

MYLIFE is now prepared for two mobile paths.

## PWA Path

This is the easiest iPhone path without Mac or Xcode.

1. Host this folder online with HTTPS.
2. Open the URL in Safari on iPhone.
3. Tap Share.
4. Tap Add to Home Screen.

## Native App Path

This wraps the current web app into native Android/iOS projects using Capacitor.

Install packages:

```bash
npm install
```

Create native projects:

```bash
npx cap add android
npx cap add ios
```

Sync changes after editing the web app:

```bash
npm run mobile:sync
```

Open Android project:

```bash
npm run mobile:android
```

Open iOS project:

```bash
npm run mobile:ios
```

Android can be built on Windows with Android Studio. iOS needs Apple signing, normally on macOS with Xcode or a cloud build service.

## iOS OTA Install Template

The `ios-ota` folder contains a sample `manifest.plist` and `install.html`.

Before it can work, replace:

- `https://your-domain.com/mylife.ipa`
- `https://your-domain.com/manifest.plist`

Then upload the signed `.ipa`, `manifest.plist`, and `install.html` to an HTTPS server.
