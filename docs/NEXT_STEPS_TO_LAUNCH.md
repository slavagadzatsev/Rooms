# Next Steps To Launch

This is the practical order for finishing Rumo without getting stuck on small details.

## Phase 1: Backend Works

Goal: the app keeps real data after restart.

- Connect Supabase env vars in `.env`.
- Run `supabase/schema.sql` in Supabase SQL Editor.
- Create Storage buckets: `avatars`, `room-images`, `message-attachments`.
- Test create room, join room, chat, reactions, attachments, follows, archive.
- Test reports, auto-hide, and banned users.

Done when:

- Rooms and messages appear in Supabase tables.
- Uploaded images appear in Storage.
- Reports appear in `reports`.
- A banned user cannot create, join, message, react, or follow.

## Phase 2: App Product Flow

Goal: a new user understands the app and reaches a useful room fast.

- Keep onboarding simple: intro, interests/goals, auth/guest, nickname.
- Home should show useful sections: recommended, popular, newly created.
- Room preview should explain the room without pushing a match score.
- Join flow should make role selection clear.
- Chat should stay clean, fast, and modern.
- Profile should show identity, interests, connections, rooms, settings.

Done when:

- A new tester can install the app and understand what to do without explanation.
- Creating a room from Home works.
- Joining and chatting works.
- Leaving a room sends it to Archive.

## Phase 3: Safety And Store Review

Goal: Apple/Google reviewers can see that the app is safe.

- Community guidelines are visible in Profile.
- Report and block are available for rooms, users, and messages.
- Supabase Dashboard is used as the first moderation panel.
- Account deletion flow exists.
- Privacy and support links are ready.

Done when:

- Reports can be reviewed in 5-10 minutes per day.
- Bad content can be hidden.
- Bad users can be banned.
- Account deletion creates a backend request.

## Phase 4: Push Notifications

Goal: users come back for important activity, not noise.

Events to support:

- New message in joined room.
- Mention in chat.
- Someone joined your room.
- Invite received.
- Room expires soon.
- Room revived.
- Role changed.

Rule:

- Do not spam. Mentions, invites, joins, and expiry should matter more than general room noise.

## Phase 5: Premium

Goal: Premium feels valuable without making free recommendations worse.

Premium currently includes (UI implemented, preview only):

- **Profile card color** — full card background tint visible to others in rooms. Stored in `premiumSettings.profileCardBg`.
- **Room card color** — full card background tint on rooms created by this user. Stored in `premiumSettings.roomCardBg` and `room.cardBg` / `card_bg` in DB.

Available to everyone (not behind premium):

- Room icon selection and icon color (comes from the chosen icon).
- Basic room controls, moderation, joining, messaging, profile editing.
- Recommendations work the same for all users.

Do not put these behind Premium:

- Better recommendations.
- Basic room controls.
- Basic moderation/safety.
- Basic joining, messaging, and profile editing.

Important:

- Keep Premium as preview until official Apple/Google in-app purchases are connected.
- Real subscription setup lives in `docs/PREMIUM_SUBSCRIPTIONS.md`.
- `card_bg` column added to `rooms` table in `supabase/schema.sql`.

## Phase 6: Store Build

Goal: build for App Store and Play Market.

- Disable guest mode in production: `EXPO_PUBLIC_ALLOW_GUEST=false`.
- Configure EAS project.
- Confirm bundle id/package: `com.slavagadzatsev.rooms`.
- Prepare icon, splash, screenshots, app description, support URL, privacy policy URL.
- Build Android App Bundle.
- Build iOS archive.
- Test on real devices before submission.

## Current Priority

Do this next:

1. Connect Supabase env vars.
2. Run SQL schema.
3. Create buckets.
4. Test backend smoke flow.
5. Then return to app polish and missing launch features.
