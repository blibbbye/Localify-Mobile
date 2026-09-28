# Localify Mobile

A rebuilt mobile-first Localify player for phones and iPhone.

- Mobile-first UI with Home, Search, Library, Albums, Artists, Playlists and Library Tools.
- Uses the HTML Media Element plus Media Session API for lock-screen / Control Center media controls and background playback where the browser/PWA permits it.
- Audio is stored in Origin Private File System when available, with IndexedDB fallback.
- Metadata is backed up separately in browser storage.
- Large .localify imports read the ZIP central directory first and import audio one file at a time with a visible progress screen.
- Designed so the UI does not render or load an entire 100+ album library into audio memory at startup.

Open it as a web app or add it to the Home Screen for the best iPhone experience.
