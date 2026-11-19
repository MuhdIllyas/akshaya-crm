// Helpers for SMS forwarded by the companion phone.

// How long an OTP stays "live" in the top bar. Most portals expire OTPs in 5–10 minutes.
export const OTP_LIVE_MINUTES = 10;

const OTP_WORDS = /\b(otp|one[\s-]?time|verification|verify|passcode|password|code|pin)\b/i;

/**
 * Pull the OTP digits out of an SMS, e.g. "Your OTP is 482913" → "482913".
 * Prefers a 4–8 digit number that comes right after an OTP word; otherwise the
 * first standalone 4–8 digit number. Returns null when nothing looks like a code.
 */
export function extractOtpCode(message) {
  if (!message) return null;
  const text = String(message);

  const near = text.match(/(?:otp|code|pin|password|passcode)[^0-9]{0,25}(\d{4,8})\b/i);
  if (near) return near[1];

  // Standalone number that is not part of an amount, phone number or date
  const all = [...text.matchAll(/(?<![\d₹.,/:-])(\d{4,8})(?![\d.,/:-]?\d)/g)].map((m) => m[1]);
  return all[0] || null;
}

/** The phone app flags OTPs itself; fall back to our own check if it didn't. */
export function looksLikeOtp(message, flagged) {
  if (flagged === true || flagged === "true") return true;
  return OTP_WORDS.test(message || "") && Boolean(extractOtpCode(message));
}
