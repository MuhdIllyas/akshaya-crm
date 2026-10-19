// src/utils/dates.js — business dates in India time, for the frontend.
export const TZ = "Asia/Kolkata";

/** Today in IST, "YYYY-MM-DD" */
export const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

/** Any Date / ISO string / timestamp → its IST calendar date "YYYY-MM-DD" */
export const ymdIST = (value) => new Date(value).toLocaleDateString("en-CA", { timeZone: TZ });

/** Calendar maths on "YYYY-MM-DD" strings */
export const addDays = (ymd, n) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export const monthStartIST = () => `${todayIST().slice(0, 7)}-01`;
export const quarterStartIST = () => {
  const [y, m] = todayIST().split("-").map(Number);
  return `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
};
export const yearStartIST = () => `${todayIST().slice(0, 4)}-01-01`;
export const thisMonthIST = () => todayIST().slice(0, 7); // "YYYY-MM"

/** Sunday that starts the week containing ymd */
export const weekStartYMD = (ymd) => {
  const [y, m, d] = ymd.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(ymd, -weekday);
};

/** Midnight IST of a "YYYY-MM-DD" date, as a Date */
export const istDayStart = (ymd) => new Date(`${ymd}T00:00:00+05:30`);