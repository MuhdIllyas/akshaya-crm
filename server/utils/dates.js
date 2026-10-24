// utils/dates.js — one place for "what day is it in India"
// Never use new Date().toISOString().split('T')[0] for a business date: that is the UTC date,
// which is still "yesterday" until 05:30 IST.

export const TZ = "Asia/Kolkata";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
export const isYMD = (v) => typeof v === "string" && YMD.test(v);

/** Pull "YYYY-MM-DD" out of "2026-10-19", "2026-10-19T10:00:00Z", etc. Returns null otherwise. */
export const toYMD = (v) => {
  if (typeof v !== "string") return null;
  const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
};

/** Today's date in IST, "YYYY-MM-DD" */
export const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

/** Pure calendar math on "YYYY-MM-DD" strings (no time zone involved) */
export const addDays = (ymd, n) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export const yesterdayIST = () => addDays(todayIST(), -1);

/** Whole days from a to b ("YYYY-MM-DD"), e.g. daysBetween("2026-10-18", "2026-10-19") === 1 */
export const daysBetween = (a, b) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Calendar parts of a moment as seen in India. weekday: 0 = Sunday … 6 = Saturday */
export const istParts = (date = new Date()) => {
  const ymd = date.toLocaleDateString("en-CA", { timeZone: TZ });
  const [year, month, day] = ymd.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { ymd, year, month, day, weekday };
};

/** Midnight IST of a date, as a timestamptz-safe string */
export const istMidnight = (ymd) => `${ymd}T00:00:00+05:30`;