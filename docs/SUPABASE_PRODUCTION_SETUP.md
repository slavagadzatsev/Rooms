# Supabase Production Setup

Use this when moving Rumo from local testing to real backend usage.

## 1. Apply Database Schema

Open Supabase Dashboard -> SQL Editor and run:

```sql
-- paste supabase/schema.sql here
```

Then verify these tables exist:

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

## 2. Deploy Edge Functions

From the project folder:

```bash
supabase functions deploy send-push
supabase functions deploy check-expiring-rooms
supabase functions deploy delete-account
```

The functions need these secrets:

```bash
supabase secrets set SUPABASE_URL=your-project-url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 3. Create Database Webhooks

Open Supabase Dashboard -> Database -> Webhooks.

Create 3 webhooks:

| Table | Event | Edge Function |
|---|---|---|
| `messages` | `INSERT` | `send-push` |
| `room_members` | `INSERT` | `send-push` |
| `message_reactions` | `INSERT` | `send-push` |

Each webhook should send the full row payload.

## 4. Schedule Expiring Room Notifications

Open Supabase Dashboard -> Edge Functions -> `check-expiring-rooms`.

Create a schedule:

```text
0 10 * * *
```

This runs once per day at 10:00 UTC.

## 5. Test Push And In-App Notifications

Use two real accounts on real devices.

1. Log in on both phones.
2. Join the same room.
3. Send a message from account A.
4. Account B should get:
   - a row in `notifications`
   - a push notification if permission is granted
5. React to a message.
6. Confirm a `reaction` notification appears.
7. Check Profile -> Notifications and turn off Messages.
8. Send another message and confirm that account does not receive message notifications.

## 6. Before Production Build

Set:

```env
EXPO_PUBLIC_ALLOW_GUEST=false
EXPO_PUBLIC_SHOW_DEV_TOOLS=false
```

Keep guest mode only for development.
