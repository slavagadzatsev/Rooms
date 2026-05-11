export const APP_CONFIG = {
  allowGuest: process.env.EXPO_PUBLIC_ALLOW_GUEST === 'true',
  showDevTools: process.env.EXPO_PUBLIC_SHOW_DEV_TOOLS === 'true',
  legal: {
    privacyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL || 'https://reflective-butterfly-7d3.notion.site/Privacy-Policy-for-Rumo-357e0d0ddf3a80f7b50beb7121301f85',
    termsUrl: process.env.EXPO_PUBLIC_TERMS_URL || 'https://reflective-butterfly-7d3.notion.site/Terms-of-Service-for-Rumo-357e0d0ddf3a80f7b50beb7121301f85',
    supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'rumo.sup@gmail.com',
  },
  premiumProductIds: {
    monthly: process.env.EXPO_PUBLIC_PREMIUM_MONTHLY_ID || 'rumo_premium_monthly',
    yearly: process.env.EXPO_PUBLIC_PREMIUM_YEARLY_ID || 'rumo_premium_yearly',
  },
};
