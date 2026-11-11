// Database access for route code.
//
// `pool` looks like a normal pg Pool, but each call goes to the database of
// the organization the current request/job belongs to (see tenancy/). Existing
// code keeps doing `pool.query(...)` / `pool.connect()` unchanged.

import dotenv from "dotenv";
import { currentTenant } from "./tenancy/context.js";
import { poolFor, fallbackPool } from "./tenancy/registry.js";

dotenv.config();

function activePool() {
  const org = currentTenant();
  if (org) return poolFor(org);
  const pool = fallbackPool();
  if (pool) return pool;
  // Multi-tenant mode with no organization: refuse rather than guess,
  // so data can never land in (or be read from) the wrong organization.
  throw new Error("[tenancy] Database used outside of an organization context");
}

const pool = {
  query: (...args) => activePool().query(...args),
  connect: (...args) => activePool().connect(...args),
  // Pool-level events are registered per real pool in tenancy/registry.js.
  on() {
    return pool;
  },
};

export default pool;
