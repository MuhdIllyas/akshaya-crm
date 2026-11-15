// Public organization info for the portal pages (/portal/<slug>/...).
// Only returns what a login or registration page needs to show.

import express from "express";
import { DEFAULT_ORG_SLUG, getOrgBySlug } from "../tenancy/registry.js";

const router = express.Router();

router.get("/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug || "").toLowerCase();
    const org = await getOrgBySlug(slug);
    if (!org) return res.status(404).json({ error: "Organization not found" });
    res.json({
      slug: org.slug,
      name: org.name,
      active: org.status === "active",
      is_default: org.slug === DEFAULT_ORG_SLUG,
    });
  } catch (err) {
    console.error("org lookup error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
