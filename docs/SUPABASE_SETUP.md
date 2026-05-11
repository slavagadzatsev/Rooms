# Supabase Setup For Rumo

Use this when you are ready to test Rumo with a real backend. This is the beginner-friendly order: create project, paste SQL, create buckets, add env vars, run the app, then test every core flow.

## 1. Create Project

Create a Supabase project and copy:

- Project URL
- Anon public key

Put them into `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_ALLOW_GUEST=true
```

Keep guest mode enabled while testing. Disable it only for production builds.

## 1.1. Enable Social Auth

In Supabase Dashboard:

1. Open Authentication -> Providers.
2. Enable Google.
3. Enable Apple.
4. Add the required client ids/secrets from Google Cloud and Apple Developer.
5. Open Authentication -> URL Configuration.
6. Add redirect URLs:
   - `rumo://auth-callback`
   - `rumo://reset-password`

Google and Apple buttons are visible in the app from the first version, but they require these Supabase provider settings before they can complete login.

Note: Apple Sign In button only appears on iOS devices. Google Sign In appears on all platforms.

## 2. Apply Database Schema

Open Supabase SQL Editor and run:

```sql
-- paste supabase/schema.sql here
```

This creates:

- Profiles and interests
- Rooms, tags, roles and members (includes `icon_bg` for icon color and `card_bg` for premium card background)
- Messages, reactions and message attachments metadata
- Follows/connections
- In-app notifications
- Notification preferences
- Push token storage for future Expo push notifications
- Reports, moderation status, content hiding, and account deletion requests

After running the SQL, open Table Editor and confirm these tables exist:

- `profiles`
- `profile_interests`
- `rooms`
- `room_tags`
- `room_roles`
- `room_members`
- `messages`
- `message_attachments`
- `message_reactions`
- `follows`
- `notifications`
- `notification_preferences`
- `push_tokens`
- `reports`
- `account_deletion_requests`

## 3. Create Storage Buckets

Create these buckets in Supabase Storage:

- `avatars`
- `room-images`
- `message-attachments`

For the first real-device backend test, set these buckets to public so uploaded images can be rendered by the app:

- `avatars`: public
- `room-images`: public
- `message-attachments`: public during testing

The app writes files to these paths:

- Avatar: `avatars/{userId}/avatar.jpg`
- Room image: `room-images/{userId}/{timestamp}.jpg`
- Chat attachment: `message-attachments/{roomId}/{messageId}-{userId}.jpg`

Before public release, tighten Storage policies if private chat attachments become required. For MVP launch, public image URLs are simpler and acceptable if users understand uploaded room/chat images are visible to people with the link.

## 4. Add Environment Variables

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_ALLOW_GUEST=true
```

Restart Expo after changing `.env`.

## 5. Backend Smoke Test

Test this on a real device with guest mode still enabled:

1. Fresh install opens onboarding.
2. Intro explains the app.
3. Interests/tags/goal save.
4. Auth or guest opens.
5. Nickname appears after auth/guest.
6. Create a room with a custom image.
7. Confirm the room appears in Supabase Table Editor -> `rooms`.
8. Confirm room tags appear in `room_tags`.
9. Confirm creator membership appears in `room_members`.
10. Open the created room and send a chat message.
11. Confirm the message appears in `messages`.
12. Attach a photo in chat.
13. Confirm the attachment appears in `message_attachments`.
14. React to a message.
15. Confirm the reaction appears in `message_reactions`.
16. Follow a member.
17. Confirm the row appears in `follows`.
18. Leave the room.
19. Confirm `room_members.status` becomes `left`.
20. Confirm the room appears in Archive inside the app.
21. On the Auth screen, enter an email and tap Forgot password.
22. Confirm Supabase sends a reset password email.
23. Create a new account.
24. If email confirmation is enabled in Supabase, confirm the email before logging in.
25. Tap Continue with Google.
26. Confirm the browser opens and returns to Rumo.
27. Tap Continue with Apple.
28. Confirm the browser opens and returns to Rumo.

## 6. Moderation Smoke Test

Use Supabase Dashboard as the moderation panel:

1. In the app, report a room.
2. Open Table Editor -> `reports`.
3. Filter by `status = pending`.
4. Confirm the report has `priority`.
5. Manually change `status` to `reviewed` or `dismissed`.
6. For a serious report, set `rooms.hidden = true` or `messages.hidden = true`.
7. To ban a user, set `profiles.banned = true`.
8. Confirm that banned users cannot create rooms, join rooms, send messages, react, or follow.

Auto-hide rule:

- If one room or message receives 3 reports from different users, the app sets `hidden = true`.

## 7. Notifications Smoke Test

Current status:

- In-app notifications are supported.
- Notification preferences are supported.
- Push token storage exists.
- Real push delivery is wired through Supabase Edge Functions.
- Push events also create rows in `notifications`, so the notification history stays visible inside Rumo.

Supabase setup required:

1. Deploy `send-push`.
2. Deploy `check-expiring-rooms`.
3. In Supabase Dashboard, create Database Webhooks that call `send-push` for:
   - `messages` -> `INSERT`
   - `room_members` -> `INSERT`
   - `message_reactions` -> `INSERT`
4. Schedule `check-expiring-rooms` once per day.

Test now:

1. Open Profile -> Notifications.
2. Change notification settings.
3. Confirm `notification_preferences` updates in Supabase.
4. Send a message from one account to another account in the same room.
5. Confirm a row appears in `notifications`.
6. On a physical device with push permission granted, confirm the push arrives.

## 8. Account Deletion Smoke Test

1. Open Edit Profile.
2. Delete account.
3. Confirm the app returns to onboarding/auth.
4. If signed in with Supabase, confirm a row appears in `account_deletion_requests`.

Before production, add a server-side worker/function that completes deletion and removes the Supabase Auth user.

## 9. Password Reset Smoke Test

1. Open the Auth screen.
2. Enter an email registered in Supabase.
3. Tap Forgot password.
4. Open the reset email on the same phone.
5. Confirm the link opens Rumo with `rumo://reset-password`.
6. Enter a new password.
7. Confirm you can log in with the new password.

In Supabase Auth settings, make sure `rumo://reset-password` is allowed as a redirect URL.

## 10. Production Switch

- Set `EXPO_PUBLIC_ALLOW_GUEST=false`.
- Test Expo push token registration and server-side notification delivery on real iOS/Android devices.
- Add privacy policy and permissions text for camera/gallery/push.
- Add public support URL/email.
- Add real App Store / Play Store screenshots.
- Keep Premium as preview only until official in-app purchases are implemented.

## 11. Ready Means

Backend is ready for the next release step when:

- SQL runs without errors.
- All required tables exist.
- All three buckets exist.
- New rooms persist after app restart.
- Chat messages persist after app restart.
- Images upload and display.
- Reports appear in `reports`.
- `hidden = true` removes rooms/messages from normal users.
- `profiles.banned = true` blocks core actions.
- Account deletion creates a request.
- Password reset opens the app and updates the password.
- Guest mode can be disabled by changing only `EXPO_PUBLIC_ALLOW_GUEST=false`.
