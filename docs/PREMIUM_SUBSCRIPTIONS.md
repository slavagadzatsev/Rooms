# Premium Subscriptions

Rumo Premium should be real only after official Apple and Google billing is connected.

## Current Status

The app currently has Premium preview features:

- Profile accent color.
- Default room accent color.
- Default room icon.
- Premium feature explanation in Profile.

These are local preview features. They are not paid yet.

## Product IDs

Use the same product ids in code, App Store Connect, and Google Play Console:

- Monthly: `rumo_premium_monthly`
- Yearly: `rumo_premium_yearly`

These ids are also documented in `.env.example`:

```env
EXPO_PUBLIC_PREMIUM_MONTHLY_ID=rumo_premium_monthly
EXPO_PUBLIC_PREMIUM_YEARLY_ID=rumo_premium_yearly
```

## Premium Rules

Premium can unlock:

- More profile customization.
- More room visual themes/icons.
- More active created rooms.
- Premium profile styling.
- Advanced archive/history views.

Premium must not unlock:

- Better recommendations.
- Basic create/join/chat.
- Basic room control.
- Basic safety/moderation.
- Basic profile editing.

Recommendations must be excellent for everyone.

## Apple App Store Setup

Before coding real purchase buttons:

1. Create an Apple Developer account.
2. Open App Store Connect.
3. Create the Rumo app.
4. Enable In-App Purchases.
5. Create subscription group: `Rumo Premium`.
6. Create products:
   - `rumo_premium_monthly`
   - `rumo_premium_yearly`
7. Add localized names, descriptions, and prices.
8. Add subscription review information.
9. Prepare sandbox tester account.

## Google Play Setup

Before coding real purchase buttons:

1. Create a Google Play Developer account.
2. Create the Rumo app.
3. Upload at least one internal test build.
4. Open Monetize -> Products -> Subscriptions.
5. Create products:
   - `rumo_premium_monthly`
   - `rumo_premium_yearly`
6. Add base plans, prices, and countries.
7. Add testers to an internal testing track.

## App Implementation Later

Recommended approach:

1. Install a React Native in-app purchase library compatible with Expo builds.
2. Fetch products by product id.
3. Show real prices from Apple/Google, not hardcoded prices.
4. Start purchase flow from the Premium sheet.
5. Validate entitlement after purchase.
6. Store entitlement in Supabase, not only on the device.
7. Restore purchases from Profile.

Important:

- Do not sell Premium with a fake button.
- Do not unlock paid features only with local AsyncStorage.
- Do not hardcode prices in the UI.
- Do not bypass Apple/Google billing for digital app features.

## Backend Entitlement

When Supabase is connected, add a `premium_entitlements` table or profile fields:

- `user_id`
- `provider` (`apple` / `google`)
- `product_id`
- `status` (`active` / `expired` / `cancelled`)
- `expires_at`
- `updated_at`

For MVP, entitlement can be checked when the app starts and cached locally. The server should remain the source of truth.

## Launch Choice

For first public launch, there are two safe options:

1. Launch without paid Premium and keep it as preview/coming soon.
2. Delay launch until Apple/Google subscriptions are fully tested.

The fastest safe path is option 1.
