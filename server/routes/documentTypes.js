// Document types (document_master): the one list of documents for this
// organization. Services pick their required documents from it, and customer
// uploads are linked to it, so matching never depends on how a name is typed.
//
//   GET    /api/document-types            list (any staff), with usage counts
//   POST   /api/document-types            add (admin, superadmin); warns about near-duplicates
//   PUT    /api/document-types/:id        rename / switch on-off (superadmin)
//   POST   /api/document-types/:id/merge  move everything to another type, then delete (superadmin)

import express from "express";
import jwt from "jsonwebtoken";
import pool from "../db.js";

const router = express.Router();

const auth = (roles) => (req, res, next) => {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "")?.[1];
  if (!token) return res.status(401).json({ error: "Sign in required" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }
  if (roles && !roles.includes(req.user.role)) {
    return res.status(403).json({ error: "You don't have permission to do this" });
  }
  next();
};
const ANY_STAFF = auth(null);
const ADMINS = auth(["admin", "superadmin"]);
const SUPERADMIN = auth(["superadmin"]);

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    if (!err.status) console.error("[document-types]", err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Something went wrong" });
  });
const bad = (message, status = 400, extra = {}) => Object.assign(new Error(message), { status, extra });

/** Same rule as doc_key() in the database: ignore case, spaces and punctuation. */
export const docKey = (name) => String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const cleanName = (name) => String(name || "").replace(/\s+/g, " ").trim();

const SCOPES = ["individual", "household", "service"];

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Types whose name is close to this one (typos, extra words). */
function similarTypes(name, types, exceptId = null) {
  const k = docKey(name);
  if (k.length < 3) return [];
  return types
    .filter((t) => t.id !== exceptId)
    .map((t) => ({ t, tk: docKey(t.name) }))
    .filter(({ tk }) => tk.length >= 3 && (tk.includes(k) || k.includes(tk) || editDistance(k, tk) <= 2))
    .slice(0, 5)
    .map(({ t }) => ({ id: t.id, name: t.name, active: t.active }));
}

// Make every label that uses this type read "<type> (<note>)" again.
async function refreshLabels(client, typeId) {
  await client.query("UPDATE required_documents SET document_type_id = document_type_id WHERE document_type_id = $1", [typeId]);
  await client.query(
    "UPDATE customer_documents cd SET document_name = dm.name FROM document_master dm WHERE dm.id = $1 AND cd.document_type_id = $1",
    [typeId]
  );
}

router.get(
  "/",
  ANY_STAFF,
  wrap(async (req, res) => {
    const onlyActive = req.query.active === "1" || req.query.active === "true";
    const { rows } = await pool.query(
      `SELECT dm.id, dm.name, dm.scope, dm.active, dm.requires_number, dm.requires_expiry, dm.creates_household,
              (SELECT count(DISTINCT coalesce(rd.sub_category_id::text, 's' || rd.service_id))::int
                 FROM required_documents rd WHERE rd.document_type_id = dm.id) AS used_by,
              (SELECT count(*)::int FROM customer_documents cd WHERE cd.document_type_id = dm.id) AS uploads
         FROM document_master dm
        WHERE ($1::boolean = false OR dm.active = true)
        ORDER BY lower(dm.name)`,
      [onlyActive]
    );
    res.json(rows);
  })
);

router.post(
  "/",
  ADMINS,
  wrap(async (req, res) => {
    const name = cleanName(req.body?.name);
    if (!docKey(name)) throw bad("Enter a document name");
    if (name.length > 120) throw bad("Keep the name under 120 characters");

    const { rows: types } = await pool.query("SELECT id, name, active FROM document_master");
    const same = types.find((t) => docKey(t.name) === docKey(name));
    if (same) {
      return res.status(409).json({ code: "EXISTS", error: `"${same.name}" already exists`, existing: same });
    }
    const similar = similarTypes(name, types);
    if (similar.length && !req.body?.force) {
      return res.status(409).json({ code: "SIMILAR", error: "Similar documents already exist", similar });
    }

    const scope = SCOPES.includes(req.body?.scope) ? req.body.scope : "individual";
    const { rows } = await pool.query(
      `INSERT INTO document_master (name, scope, requires_number, creates_household, active, requires_expiry)
       VALUES ($1, $2, false, false, true, false)
       RETURNING id, name, scope, active, requires_number, requires_expiry, creates_household`,
      [name, scope]
    );
    res.status(201).json({ ...rows[0], used_by: 0, uploads: 0 });
  })
);

router.put(
  "/:id",
  SUPERADMIN,
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const { rows: found } = await pool.query("SELECT * FROM document_master WHERE id = $1", [id]);
    if (!found[0]) throw bad("Document type not found", 404);
    const current = found[0];

    const name = req.body?.name !== undefined ? cleanName(req.body.name) : current.name;
    if (!docKey(name)) throw bad("Enter a document name");
    const { rows: clash } = await pool.query(
      "SELECT id, name FROM document_master WHERE doc_key(name) = doc_key($1) AND id <> $2",
      [name, id]
    );
    if (clash[0]) throw bad(`"${clash[0].name}" already exists. Merge into it instead.`, 409);

    const pick = (key) => (typeof req.body?.[key] === "boolean" ? req.body[key] : current[key]);
    const scope = SCOPES.includes(req.body?.scope) ? req.body.scope : current.scope;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `UPDATE document_master
            SET name = $1, scope = $2, active = $3, requires_number = $4, requires_expiry = $5
          WHERE id = $6
          RETURNING id, name, scope, active, requires_number, requires_expiry, creates_household`,
        [name, scope, pick("active"), pick("requires_number"), pick("requires_expiry"), id]
      );
      if (name !== current.name) await refreshLabels(client, id);
      await client.query("COMMIT");
      res.json(rows[0]);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  })
);

router.post(
  "/:id/merge",
  SUPERADMIN,
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const into = Number(req.body?.into_id);
    if (!into || into === id) throw bad("Choose another document to merge into");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query("SELECT id, name FROM document_master WHERE id = ANY($1) FOR UPDATE", [[id, into]]);
      if (rows.length !== 2) throw bad("Document type not found", 404);

      // What made the old type different ("mobile number linked") is kept as a
      // note on the services that used it, in front of any note they had.
      const mergeNote = String(req.body?.note || "").replace(/\s+/g, " ").trim().slice(0, 200);
      const noteSql = `nullif(concat_ws(', ', nullif($3, ''), nullif(a.note, '')), '')`;

      // A service that already asks for the kept type: fold the note into that
      // row (if it has none) instead of listing the same document twice.
      await client.query(
        `UPDATE required_documents b
            SET note = coalesce(nullif(b.note, ''), ${noteSql})
           FROM required_documents a
          WHERE a.document_type_id = $1 AND b.document_type_id = $2
            AND a.service_id IS NOT DISTINCT FROM b.service_id
            AND a.sub_category_id IS NOT DISTINCT FROM b.sub_category_id`,
        [id, into, mergeNote]
      );
      await client.query(
        `DELETE FROM required_documents a
          USING required_documents b
          WHERE a.document_type_id = $1 AND b.document_type_id = $2
            AND a.service_id IS NOT DISTINCT FROM b.service_id
            AND a.sub_category_id IS NOT DISTINCT FROM b.sub_category_id`,
        [id, into]
      );
      const moved = await client.query(
        `UPDATE required_documents a SET document_type_id = $2, note = ${noteSql} WHERE a.document_type_id = $1`,
        [id, into, mergeNote]
      );
      const uploads = await client.query(
        "UPDATE customer_documents SET document_type_id = $2, document_name = (SELECT name FROM document_master WHERE id = $2) WHERE document_type_id = $1",
        [id, into]
      );
      await client.query("DELETE FROM document_master WHERE id = $1", [id]);
      await client.query("COMMIT");
      res.json({ merged_into: into, services_updated: moved.rowCount, uploads_updated: uploads.rowCount });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  })
);

export default router;
