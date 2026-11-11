// Background jobs run once per active organization, each inside that
// organization's context so db.js and io.js use the right database and rooms.

import cron from "node-cron";
import { runWithTenant } from "./context.js";
import { listActiveOrgs } from "./registry.js";

export async function forEachOrg(label, fn) {
  let orgs;
  try {
    orgs = await listActiveOrgs();
  } catch (err) {
    console.error(`[${label}] could not list organizations:`, err.message);
    return;
  }
  for (const org of orgs) {
    try {
      await runWithTenant(org, fn);
    } catch (err) {
      console.error(`[${label}] failed for organization "${org.slug}":`, err);
    }
  }
}

/** Same as cron.schedule, but the task runs for every active organization. */
export function scheduleForEachOrg(expression, task, options) {
  return cron.schedule(expression, () => forEachOrg(`cron ${expression}`, task), options);
}
