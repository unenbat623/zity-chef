# Zity Chef Store Release

This repo now has Capacitor packaging hooks for Android and iOS store builds.

## Required Accounts

- Google Play Console developer account with access to the target app.
- Apple Developer Program account with access to App Store Connect.
- Production HTTPS API domain for `VITE_API_URL`.
- Supabase production URL and anon key.

## Build

```bash
VITE_API_URL=https://api.zitychef.mn npm run mobile:build
```

The mobile preflight intentionally fails if `VITE_API_URL` is empty, because a
bundled mobile WebView cannot use same-origin `/api` routes the way the web
deployment can.

## Android

```bash
npm run android:open
```

In Android Studio:

- Set the release signing key.
- Build an Android App Bundle (`.aab`).
- Upload the `.aab` in Play Console.

Current Android package id: `mn.zity.chef`.

## iOS

```bash
npm run ios:open
```

In Xcode:

- Select the Apple Team.
- Confirm the bundle identifier.
- Archive the app.
- Upload the archive to App Store Connect.

Current iOS bundle id: `mn.zity.chef`.

## Store Metadata

- App name: `Zity Chef`
- Primary language: Mongolian
- Category: Food & Drink
- Short description: `AI тогооч туслагч, хөргөгчийн материал бүртгэл, жор, хоолны төлөвлөгөө, дэлгүүрийн захиалга.`

Before submission, prepare screenshots for phone and tablet sizes, privacy
policy URL, support URL, app icon, content rating answers, and data safety /
privacy labels.
