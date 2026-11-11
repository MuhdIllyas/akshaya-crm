// Where uploaded files are saved, per organization.
//
//   default organization  → uploads/<sub>/...           (unchanged, old files stay)
//   other organizations   → uploads/<org-slug>/<sub>/...
//
// So one buyer's files can be backed up, measured or deleted as one folder.
// The URL that goes into the database mirrors the folder: /uploads/<slug>/<sub>/x

import fs from "node:fs";
import path from "node:path";
import { currentTenant } from "./context.js";
import { DEFAULT_ORG_SLUG } from "./registry.js";

/**
 * Folder for the current organization.
 * @param {string} sub   sub-folder such as "staff" or "customer-documents" ("" for the root)
 * @param {string} root  top folder: "uploads" (served publicly) or "private_uploads"
 * @returns {{ dir: string, rel: string, url: string }}
 *   dir: absolute path on disk, rel: "uploads/..." relative path, url: "/uploads/..."
 */
export function orgUploadPath(sub = "", root = "uploads") {
  const org = currentTenant();
  const parts = [root];
  if (org && org.slug !== DEFAULT_ORG_SLUG) parts.push(org.slug);
  if (sub) parts.push(...String(sub).split("/").filter(Boolean));
  const rel = parts.join("/");
  const dir = path.join(process.cwd(), ...parts);
  fs.mkdirSync(dir, { recursive: true });
  return { dir, rel, url: `/${rel}` };
}

/** Top-level names already used under uploads/, which can't be organization slugs. */
export const RESERVED_UPLOAD_NAMES = [
  "chat", "staff", "customer-documents", "customers", "customer-photos", "knowledge",
  "printing", "print-jobs", "service-tracking", "service-documents", "collaboration",
  "files", "tasks", "centres", "logos", "temp", "tmp",
];
