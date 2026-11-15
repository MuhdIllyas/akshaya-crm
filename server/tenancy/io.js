// Socket.io, kept separate per organization.
//
// Room names like `user:5`, `centre:1` or `conversation:9` repeat in every
// organization (each has its own id sequences), so every room is stored as
// "<org-slug>|<room>". Route code keeps calling io.to(`user:${id}`).emit(...)
// and this wrapper adds the current organization's prefix.

import { currentTenant } from "./context.js";
import { DEFAULT_ORG_SLUG, isMultiTenant } from "./registry.js";

let server = null;

export function attachSocketServer(io) {
  server = io;
}

export function roomFor(org, room) {
  return `${org.slug}|${room}`;
}

/** Room every socket of an organization joins; used for org-wide broadcasts. */
export function orgRoom(org) {
  return roomFor(org, "*");
}

function orgOrNull() {
  const org = currentTenant();
  if (org) return org;
  if (!isMultiTenant()) return { slug: DEFAULT_ORG_SLUG };
  console.warn("[tenancy] socket emit outside an organization context was dropped");
  return null;
}

const prefix = (org, rooms) => (Array.isArray(rooms) ? rooms : [rooms]).map((r) => roomFor(org, r));

const DROPPED = {
  to: () => DROPPED,
  in: () => DROPPED,
  except: () => DROPPED,
  emit: () => false,
};

class OrgBroadcast {
  constructor(op, org) {
    this.op = op;
    this.org = org;
  }
  to(rooms) {
    return new OrgBroadcast(this.op.to(prefix(this.org, rooms)), this.org);
  }
  in(rooms) {
    return this.to(rooms);
  }
  except(rooms) {
    return new OrgBroadcast(this.op.except(prefix(this.org, rooms)), this.org);
  }
  emit(...args) {
    return this.op.emit(...args);
  }
}

export const io = {
  to(rooms) {
    const org = orgOrNull();
    if (!org || !server) return DROPPED;
    return new OrgBroadcast(server.to(prefix(org, rooms)), org);
  },
  in(rooms) {
    return io.to(rooms);
  },
  /** Broadcast to everyone in the current organization only. */
  emit(...args) {
    const org = orgOrNull();
    if (!org || !server) return false;
    return server.to(orgRoom(org)).emit(...args);
  },
};
