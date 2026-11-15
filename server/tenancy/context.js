// Which organization (tenant) the current request or job belongs to.
//
// Every HTTP request, socket event and background job runs inside
// runWithTenant(org, fn). db.js reads the org from here to pick that
// organization's own database, so route code never has to think about it.

import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage();

export function runWithTenant(org, fn) {
  return storage.run({ org }, fn);
}

/** The organization of the code that is running now, or null outside any. */
export function currentTenant() {
  return storage.getStore()?.org || null;
}
