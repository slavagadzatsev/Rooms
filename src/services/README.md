# Services Layer

This folder is the boundary between screens/context and the future Supabase backend.

Current app state is still mostly local in `AppContext`, but new backend work should go through these service contracts instead of calling Supabase directly from screens.

Implemented now:

- `authService` can sign up, sign in, sign out, and restore the current Supabase session.
- `profileService` can read and save profile data, onboarding/profile interests, and follows/connections.
- `roomsService` has real Supabase contracts for fetching rooms, fetching one room, creating rooms, joining/leaving, choosing roles, adding custom roles, room pulse revival, and realtime room updates.
- `messagesService` can load room messages, send messages, soft-delete messages, toggle reactions, and subscribe to realtime chat updates in Supabase.
- `notificationsService` can load, create, mark read, mark all read, subscribe to realtime in-app notifications, sync notification preferences, and register push tokens once Expo push is connected.
- `storageService` uploads avatars, room images, and message attachments to Supabase Storage buckets.
- `moderationService` can submit room/user/message reports to Supabase, assign report priority, and auto-hide rooms/messages after repeated reports from different users.
- `accountService` can create account deletion requests for signed-in users.

Still intentionally local:

- Push notification delivery.
- Custom admin moderation UI. Launch moderation can use Supabase Dashboard Table Editor.
- Server-side account deletion worker/function that completes deletion requests and removes auth users.
- Final production auth gate. Guest mode stays enabled while the app is being tested.

Planned order:

1. Real Supabase device QA with `docs/SUPABASE_SETUP.md`.
2. Expo push notification registration and delivery.
3. Production auth gate - keep guest mode for testing, require auth before store release.

Why this matters:

- Screens stay simple.
- Supabase can be added without rewriting the UI.
- Mock/local behavior can coexist with real backend while migrating feature by feature.
