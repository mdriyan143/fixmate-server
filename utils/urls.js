export const CLIENT_ORIGINS = (process.env.CLIENT_URL || "")
  .split(",")
  .map((url) => url.trim().replace(/\/+$/, ""))
  .filter(Boolean);

// the FIRST address is your live site. Stripe sends customers back to it after paying
export const MAIN_CLIENT = CLIENT_ORIGINS[0];
