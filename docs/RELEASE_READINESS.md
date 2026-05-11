# Rumo Release Readiness

This checklist tracks what must be true before Rumo is ready for public release.

## Target

Rumo should be prepared for both Apple App Store and Google Play. Guest access stays enabled while testing through `EXPO_PUBLIC_ALLOW_GUEST=true`. Before release, set `EXPO_PUBLIC_ALLOW_GUEST=false` so real usage requires registration/login.

---

## ✅ Completed

### App Identity
- App renamed from **Rooms** → **Rumo** (`app.json`, `i18n`)
- Bundle ID updated: `com.rumoapp.rumo` (iOS + Android)
- Slug updated: `rumo`
- EAS project created: `@slyver/rumo` (projectId: `e81ad681-0f85-423d-bb9e-13f0ffaeba87`)
- `eas.json` created with `development`, `preview`, `production` profiles

### Push Notifications
- `expo-notifications ~0.29.11` installed
- Push token registration on login, unregistration on logout/delete
- Foreground alerts enabled; notification taps navigate to correct room
- Android channel `default` with color `#6B5CE7`
- Edge Function `send-push` deployed — handles new messages, mentions, joins, reactions
- Edge Function `check-expiring-rooms` deployed — runs daily via pg_cron (10:00 UTC = 13:00 МСК), notifies room members 1–3 days before expiry
- Database Webhooks created in Supabase Dashboard (messages INSERT, room_members INSERT, message_reactions INSERT → send-push)
- Per-user notification preferences respected (`messages`, `mentions`, `room_activity`, `room_expiry`)

### Account Deletion
- Edge Function `delete-account` deployed — verifies user JWT, deletes all user data (push tokens, messages, reactions, memberships, profile), then removes auth user via `admin.deleteUser`
- Client calls Edge Function directly (no more "request only" workaround)

### Auth
- Email/password login and signup
- Password reset via deep link `rumo://reset-password`
- Guest mode via `EXPO_PUBLIC_ALLOW_GUEST`
- Auth callback screen with error handling and "Back to sign in" button
- Google and Apple OAuth buttons wired up (need Supabase provider config — see below)

### Supabase Backend
- 15 tables created and verified
- Storage buckets: `avatars`, `room-images`, `message-attachments` (PUBLIC)
- RLS recursion fix: `is_room_member()` and `room_exists()` security definer functions
- Redirect URLs: `rumo://auth-callback` and `rumo://reset-password`
- Auto-profile trigger: `on_auth_user_created`

### UI / Design
- Dark theme applied to AuthScreen, OnboardingScreen, NicknameScreen
- Profile, rooms, chat, notifications, moderation screens complete
- Community guidelines in Profile settings
- Privacy and Help & support in Profile settings
- Light/dark theme throughout app
- EN/DE localization on onboarding/auth/nickname screens

---

## 🔴 Release Blockers (must fix before publishing)

| # | What | How |
|---|------|-----|
| 1 | **Google OAuth** | Supabase Dashboard → Authentication → Providers → Google. Needs Google Cloud Console credentials. |
| 2 | **Apple OAuth** | Supabase Dashboard → Authentication → Providers → Apple. Needs Apple Developer account setup. |
| 3 | **Google OAuth real-device test** | You connected Google; now test full browser return on a phone. |
| 4 | **`assets/rumo-icon.png`** | Save logo PNG to this path — AuthScreen already uses it |
| 5 | **App icon 1024×1024** | `assets/icon.png` must be 1024×1024, no rounded corners (store adds them) |
| 6 | **Privacy Policy URL** | Create policy (e.g. privacypolicygenerator.info), add URL to store listing |
| 7 | **Store screenshots** | Min 3 for iOS, min 2 for Android |
| 8 | **Real-device QA** | Run full Pre-Release QA Flow below on a physical device |
| 9 | **Set `EXPO_PUBLIC_ALLOW_GUEST=false`** | For production build |

---

## 🟡 Important but not blocking

| What | Notes |
|------|-------|
| Apple OAuth | Not connected yet. Needs Apple Developer account setup before publishing with Apple login. |
| Supabase Storage QA | Buckets created but upload flows need real-device test |
| Realtime hardening | Chat, reactions, room state — needs real-device QA |
| Remaining i18n | Most screens outside onboarding/auth still use hardcoded English; German is the priority second language. |
| Support email | Replace placeholder in Profile → Help & support |
| Test account for review | App Store review requires a test account when guest is disabled |

---

## 🟢 Can ship without (add post-launch)

- Full localization of all screens
- Premium in-app purchases (currently preview-only, no real billing)
- Universal links (`rumo.app` domain)
- Custom admin moderation panel
- Manual language override in settings

---

## Pre-Release QA Flow

Run this flow before every test build on a real device:

1. Guest or login opens the app
2. Intro explains Rumo before auth
3. Onboarding saves interests and goals
4. Auth or guest opens
5. Nickname appears after auth/guest
6. Home recommendations match interests
7. Room preview shows neutral room details
8. Join room with a role
9. Send chat message, attach photo, react, reply, copy, delete own message
10. Room appears in My rooms
11. Leave room → appears in Archive
12. Create a new room
13. Created room opens with current user as Creator
14. Receive a push notification → tap → opens correct room
15. Notifications screen marks as read
16. Profile stats and lists match current state
17. Light/dark theme readable everywhere
18. Report a room
19. Report and block a user from member preview
20. Delete account → app returns to onboarding/auth, account gone from Supabase
21. Open Profile → Community guidelines
22. Open Profile → Privacy and Help & support

---

## Current Config

| Key | Value |
|-----|-------|
| App name | Rumo |
| Expo slug | `rumo` |
| iOS bundle ID | `com.rumoapp.rumo` |
| Android package | `com.rumoapp.rumo` |
| URL scheme | `rumo` |
| App version | `1.0.0` |
| iOS build number | `1` |
| Android version code | `1` |
| EAS project | `@slyver/rumo` — `e81ad681-0f85-423d-bb9e-13f0ffaeba87` |
| EAS profiles | `development`, `preview` (internal APK), `production` |
| Supabase project | `aomzxogmzwsursmumcvk` |

---

## Store Assets Needed

- [ ] App name: **Rumo**
- [ ] Subtitle (iOS) / Short description (Android)
- [ ] Full description in English and German
- [ ] Privacy policy URL
- [ ] Support email or URL
- [ ] Screenshots for required phone sizes (iOS: 6.7", 5.5"; Android: phone)
- [ ] App icon at 1024×1024
- [ ] Age rating / content questions answered
- [ ] Test account for App Store review
