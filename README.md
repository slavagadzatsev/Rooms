# Rumo

Rumo is an Expo + React Native app for finding people and forming short-lived goal-based rooms.

## Current Mode

The app is still in test/demo mode:

- Guest access is controlled by `EXPO_PUBLIC_ALLOW_GUEST`. It is off unless this value is explicitly `true`; keep it `true` while testing and remove it or set it to `false` for production builds.
- Guest access is enabled so the product flow can be tested without registration.
- Local demo mode still works when Supabase env vars are empty.
- Supabase bridges now exist for auth, profile/interests, rooms, room members, roles, messages, reactions, follows/connections, in-app notifications, notification preferences, storage uploads, and push token storage.
- Push notification code is wired through Supabase Edge Functions, but final delivery still needs real-device QA and store credentials. Localization has a first system-language layer for onboarding/auth/nickname, with English and German as the launch languages.

Before public release, guest-only testing should be replaced with required authentication.

## Main Release Goals

- Stable onboarding and recommendation flow.
- Reliable create room, join room, chat, roles, reactions, archive, and notifications flows.
- Supabase-backed auth, profiles, rooms, members, messages, reactions, follows, and notifications.
- Push notifications for messages, mentions, joins, invites, and room expiry.
- Supabase Storage for avatars, room images, and chat attachments.
- System-language localization across the whole app, prioritizing English and German.
- Premium focused on customization and expanded creation/discovery capacity, not better recommendations.

See `docs/RELEASE_READINESS.md` for the publication checklist.
See `docs/SUPABASE_SETUP.md` for backend setup steps.
See `docs/SUPABASE_PRODUCTION_SETUP.md` for the exact Supabase webhooks/functions checklist.
See `docs/NEXT_STEPS_TO_LAUNCH.md` for the current launch order.
See `docs/PREMIUM_SUBSCRIPTIONS.md` for real subscription setup.

## Build Profiles

- `npm run build:preview` creates an internal EAS build with guest mode enabled.
- `npm run build:production` creates a production EAS build with guest mode disabled.
- `npm run export:android` runs a local Android export smoke test.

## Simple Moderation

Rumo uses a minimal moderation flow without a custom admin panel.

Where to review reports:

- Open Supabase Dashboard.
- Go to Table Editor.
- Open the `reports` table.
- Filter by `status = pending`.

How priority works:

- `harassment`, `violence`, `sexual_content` are `high`.
- `spam`, `scam` are `medium`.
- `other` is `low`.

Daily review flow:

- Check `reports` once a day.
- Review high priority first.
- Set `status` to `reviewed`, `dismissed`, or `action_taken`.
- Fill `reviewed_at`, `reviewer_id`, and `action_note`.
- If needed, manually set `hidden = true` on a room or message.
- If needed, set `profiles.banned = true` for a user.

Auto-hide:

- If the same room or message gets 3 or more reports from different users, the app automatically sets `hidden = true` for that room/message.
- Supabase Dashboard stays the moderation interface for launch, so moderation should take about 5-10 minutes per day.
