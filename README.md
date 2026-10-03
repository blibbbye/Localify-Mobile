# Localify Mobile

Separate mobile-first Localify website and Android app.

## Mobile website

The GitHub Pages site is this repository's root web app. Enable GitHub Pages → Source: GitHub Actions in the repository settings.
After the Pages workflow finishes, the site is normally available at:

https://blibbbye.github.io/Localify-Mobile/

The site is a standalone mobile build; it does not replace the desktop/web Localify repository.

## Mobile features

- Mobile-first UI for phones and tablets.
- Local audio stored in OPFS when available with IndexedDB fallback.
- MP3 ID3 metadata reading for title, artist, album, album artist, year, genre, track/disc numbers and editor/software tags.
- Metadata title replaces the filename for display while fileTrack keeps filename numbering for sorting (for example 01. something.mp3 stays first even when the embedded title is different).
- Folders that can contain albums, songs, artists and playlists.
- Folder cards use a 2x2 album-art collage from the first four albums in the folder.
- Folder import creates a Localify folder from the selected directory.
- Profile overview with song/album/artist/playlist counts, recently played, listening time and top songs.
- Dedicated account settings from the profile.
- Media Session support for OS/lock-screen media controls where the browser supports it.
- Service worker/PWA support.

## Android APK

This repository includes a GitHub Actions workflow that generates a Capacitor Android project and builds a debug APK.

Open the Actions tab and run Build Localify Mobile Android APK (or push a matching change). The workflow uploads the APK as an artifact named localify-mobile-debug.

The Android build also installs a small foreground playback service and a JavaScript bridge so the WebView can request background playback support.

### Local Android build

Install Node.js and Java 21, then run:

npm install

npx cap add android

npx cap sync android

node scripts/prepare-android.cjs

cd android && gradlew.bat assembleDebug

The APK will be under android/app/build/outputs/apk/debug/.
