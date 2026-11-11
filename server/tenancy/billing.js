// Subscription billing for organizations (control database).
//
// An organization is covered until GREATEST(paid_until, trial_ends_at).
// After that it gets `grace_days`, then it is suspended automatically by a
// daily job. Recording a payment that covers today re-activates an
// organization that was suspended for non-payment. Organizations with no
// trial or paid-until date are never suspended automatically. Your own
// (default) organization is never billed.

import cron from "node-cron";
import { addDays, daysBetween, todayIST } from "../utils/dates.js";
import { DEFAULT_ORG_SLUG, forgetOrg, getControlPool } from "./registry.js";

export const AUTO_SUSPEND_REASON = "Payment overdue (suspended automatically)";

const later = (a, b) => (!a ? b || null : !b ? a : a > b ? a : b);

/**
 * Billing state from YYYY-MM-DD strings.
 * @returns {{ state: 'not_billed'|'unbilled'|'trial'|'active'|'grace'|'overdue', covered_until: string|null, days_left: number|null }}
 *   days_left: days until covered_until (negative once past it)
 */
export function billingState({ slug, trial_ends_at, paid_until, grace_days = 7 }, today = todayIST()) {
  if (slug === DEFAULT_ORG_SLUG) return { state: "not_billed", covered_until: null, days_left: null };
  const covered = later(paid_until, trial_ends_at);
  if (!covered) return { state: "unbilled", covered_until: null, days_left: null };
  const daysLeft = daysBetween(today, covered);
  if (today <= covered) {
    const paid = paid_until && paid_until >= today;
    return { state: paid ? "active" : "trial", covered_until: covered, days_left: daysLeft };
  }
  if (today <= addDays(covered, Number(grace_days) || 0)) return { state: "grace", covered_until: covered, days_left: daysLeft };
  return { state: "overdue", covered_until: covered, days_left: daysLeft };
}

/** Add one billing cycle to a YYYY-MM-DD date (same day next month/year, clamped to month end). */
export function addCycle(ymd, cycle) {
  const [y, m, d] = ymd.split("-").map(Number);
  const months = cycle === "yearly" ? 12 : 1;
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Suspend every organization past its grace period. Returns the suspended slugs. */
export async function suspendOverdueOrgs() {
  const { rows } = await getControlPool().query(
    `UPDATE organizations
        SET status = 'suspended', status_reason = $2, updated_at = now()
      WHERE slug <> $1
        AND status = 'active'
        AND GREATEST(paid_until, trial_ends_at) IS NOT NULL
        AND GREATEST(paid_until, trial_ends_at) + grace_days < (now() AT TIME ZONE 'Asia/Kolkata')::date
      RETURNING slug`,
    [DEFAULT_ORG_SLUG, AUTO_SUSPEND_REASON]
  );
  for (const { slug } of rows) forgetOrg(slug);
  if (rows.length) console.log(`[billing] Suspended for non-payment: ${rows.map((r) => r.slug).join(", ")}`);
  return rows.map((r) => r.slug);
}

let started = false;

/** Daily at 00:30 IST, plus once shortly after start-up. */
export function startBillingJobs() {
  if (started) return;
  started = true;
  const run = () => suspendOverdueOrgs().catch((err) => console.error("[billing] auto-suspend failed:", err.message));
  cron.schedule("30 0 * * *", run, { timezone: "Asia/Kolkata" });
  setTimeout(run, 30_000).unref();
}
