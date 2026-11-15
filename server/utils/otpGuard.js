// Limits for customer WhatsApp OTPs (login and registration).
//
//  - Sending: a phone gets at most SEND_PER_PHONE codes per SEND_WINDOW, at
//    least SEND_GAP apart, and one IP can ask for at most SEND_PER_IP codes per
//    SEND_WINDOW. Stops anyone using the app to flood a number with messages.
//  - Guessing: after MAX_WRONG wrong codes for a phone, its code is thrown
//    away and a new one has to be sent. One IP gets at most VERIFY_PER_IP
//    tries per VERIFY_WINDOW across all phones.
//
// Counts are kept in memory per organization, like the other sign-in limits
// here; a restart clears them, which only ever gives a few extra tries.

import crypto from "crypto";

const MIN = 60_000;
export const SEND_WINDOW = 15 * MIN;
const SEND_PER_PHONE = 5;
const SEND_GAP = 30_000;
const SEND_PER_IP = 10;
export const MAX_WRONG = 5;
const VERIFY_WINDOW = 15 * MIN;
const VERIFY_PER_IP = 30;

const sends = new Map(); // key -> [timestamps]
const wrong = new Map(); // org|phone -> count of wrong codes for the current code
const verifies = new Map(); // org|ip -> [timestamps]

const recent = (map, key, windowMs, now) => {
  const list = (map.get(key) || []).filter((t) => now - t < windowMs);
  map.set(key, list);
  return list;
};

/** A random 6-digit code. */
export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Checks and records a send. Returns null when allowed, or a message to show.
 */
export function checkSend(org, phone, ip) {
  const now = Date.now();
  const byPhone = recent(sends, `p|${org}|${phone}`, SEND_WINDOW, now);
  const byIp = recent(sends, `i|${org}|${ip}`, SEND_WINDOW, now);
  if (byPhone.length && now - byPhone[byPhone.length - 1] < SEND_GAP) {
    return "Please wait a few seconds before asking for another code.";
  }
  if (byPhone.length >= SEND_PER_PHONE || byIp.length >= SEND_PER_IP) {
    return "Too many codes requested. Please try again in 15 minutes.";
  }
  byPhone.push(now);
  byIp.push(now);
  wrong.delete(`${org}|${phone}`); // a new code starts with a clean count
  return null;
}

/** Returns a message when this IP has made too many tries, else null. */
export function checkVerifyIp(org, ip) {
  const list = recent(verifies, `${org}|${ip}`, VERIFY_WINDOW, Date.now());
  if (list.length >= VERIFY_PER_IP) return "Too many tries. Please try again in 15 minutes.";
  list.push(Date.now());
  return null;
}

/** Records a wrong code; returns true when the code should now be thrown away. */
export function recordWrong(org, phone) {
  const key = `${org}|${phone}`;
  const n = (wrong.get(key) || 0) + 1;
  wrong.set(key, n);
  if (n >= MAX_WRONG) {
    wrong.delete(key);
    return true;
  }
  return false;
}

export function clearWrong(org, phone) {
  wrong.delete(`${org}|${phone}`);
}

// Drop old entries now and then so the maps don't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const map of [sends, verifies]) {
    for (const [key, list] of map) {
      if (!list.some((t) => now - t < SEND_WINDOW)) map.delete(key);
    }
  }
}, 10 * MIN).unref();
