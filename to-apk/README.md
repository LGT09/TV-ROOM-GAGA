# TV Room GAGA — Android / Play Store package

This folder contains the Android Trusted Web Activity (TWA) starter files and a copy of the PWA manifest. The project is a website; the files here are configuration and publishing instructions, not a built or signed APK/AAB.

## Before building

1. Publish the web app over HTTPS and choose its final hostname.
2. Replace `YOUR_PUBLISHED_HOSTNAME` and `com.example.tvroomgaga` in `twa-manifest.json` with the production host and your permanent, unique Android application ID.
3. Build the website and confirm these URLs are public and return successfully:
   - `https://YOUR_PUBLISHED_HOSTNAME/manifest.webmanifest`
   - `https://YOUR_PUBLISHED_HOSTNAME/sw.js`
   - `https://YOUR_PUBLISHED_HOSTNAME/.well-known/assetlinks.json`
4. Install Java (JDK 17 or newer) and Node.js on your Android packaging workstation. Keep the release keystore private and back it up securely.

## Create the Trusted Web Activity

Install Bubblewrap and initialize it from the deployed manifest:

```sh
npm install --global @bubblewrap/cli
bubblewrap doctor
bubblewrap init --manifest https://YOUR_PUBLISHED_HOSTNAME/manifest.webmanifest
```

Review the generated Android project, application ID, launcher icon, start route, colors, signing configuration and Digital Asset Links. Do not commit a release keystore or its passwords.

Build and test the Android App Bundle:

```sh
bubblewrap build
```

Install the generated APK on a physical Android device for testing. Upload the signed `.aab` to a Play Console internal-testing track first; complete the current Play Console declarations, privacy/data-safety forms, content rating, target SDK requirements, screenshots and store listing before production release.

## Digital Asset Links

Copy `assetlinks.json.example` to the deployed site's `/.well-known/assetlinks.json`, then replace the package name and fingerprint with the SHA-256 fingerprint of the exact Play App Signing certificate used for the published app. Confirm the file is served as JSON without redirects. A mismatch causes the app to open browser chrome instead of a verified TWA.

## PWA and offline behavior

The production manifest is `public/manifest.webmanifest`; the service-worker entrypoint is `public/sw.js`, which loads `to-apk/service-worker.js`. The worker caches the offline shell and a small set of same-origin images. It deliberately does not cache API responses, signed media URLs or downloaded movies. Streaming and downloads still require a connection.

## Play Store responsibilities

Review the current Play policies for user-generated content, media rights, external content, privacy, and data safety. The app links to third-party media services; verify that every source and distribution right is appropriate for your intended region and audience. This starter setup does not guarantee Play Store approval.
