-- One list of document types per organization (document_master), linked by id.
--
-- Until now a service's required documents, the document master and the
-- customer's uploads were matched by their typed name, so "Ration Card",
-- "RationCard" and "Ration card" counted as different documents.
--
--  - required_documents gets document_type_id (the type) and note (e.g.
--    "all family members"); document_name stays as the label shown on screens
--    and checklists: "<type> (<note>)".
--  - customer_documents gets document_type_id.
--  - doc_key() compares names ignoring case, spaces and punctuation; a type's
--    key is unique, so "RationCard" can't be added next to "Ration Card".
--  - Existing rows are linked: same key -> that type; "X (note)" / "X - note"
--    where X is already a type -> X + note; anything else becomes its own type
--    (merge near-duplicates later on the Document Types page).
--  - Triggers link rows inserted by any other code path the same way.
--
-- Safe to run more than once. Apply with:
--   node scripts/orgs.js migrate migrations/2026-11-13-document-types.sql

CREATE OR REPLACE FUNCTION doc_key(t TEXT) RETURNS TEXT
  LANGUAGE sql IMMUTABLE AS
$$ SELECT lower(regexp_replace(coalesce(t, ''), '[^a-zA-Z0-9]', '', 'g')) $$;

-- Tidy spacing in a name: trim and collapse runs of spaces.
CREATE OR REPLACE FUNCTION doc_clean(t TEXT) RETURNS TEXT
  LANGUAGE sql IMMUTABLE AS
$$ SELECT btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')) $$;

ALTER TABLE document_master ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE required_documents ADD COLUMN IF NOT EXISTS document_type_id INTEGER REFERENCES document_master(id) ON DELETE SET NULL;
ALTER TABLE required_documents ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE customer_documents ADD COLUMN IF NOT EXISTS document_type_id INTEGER REFERENCES document_master(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS required_documents_type_idx ON required_documents (document_type_id);
CREATE INDEX IF NOT EXISTS customer_documents_type_idx ON customer_documents (document_type_id);

-- Find a type by name (ignoring case/spaces/punctuation), creating it if missing.
CREATE OR REPLACE FUNCTION doc_type_for(p_name TEXT) RETURNS INTEGER
  LANGUAGE plpgsql AS
$$
DECLARE
  v_id INTEGER;
  v_name TEXT := doc_clean(p_name);
BEGIN
  IF doc_key(v_name) = '' THEN
    RETURN NULL;
  END IF;
  SELECT id INTO v_id FROM document_master WHERE doc_key(name) = doc_key(v_name) ORDER BY id LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO document_master (name, scope, requires_number, creates_household, active, requires_expiry)
    VALUES (v_name, 'individual', false, false, true, false)
    ON CONFLICT (name) DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      SELECT id INTO v_id FROM document_master WHERE doc_key(name) = doc_key(v_name) ORDER BY id LIMIT 1;
    END IF;
  END IF;
  RETURN v_id;
END
$$;

-- Find an existing type for a name, without adding one. "X (note)" finds X.
-- Used for customer uploads, so a typo there never adds a new type.
CREATE OR REPLACE FUNCTION doc_type_find(p_name TEXT) RETURNS INTEGER
  LANGUAGE plpgsql STABLE AS
$$
DECLARE
  v_id INTEGER;
  v_parts TEXT[];
BEGIN
  SELECT id INTO v_id FROM document_master WHERE doc_key(name) = doc_key(p_name) LIMIT 1;
  IF v_id IS NULL THEN
    v_parts := regexp_match(doc_clean(p_name), '^(.+?)\s*\((.+)\)$');
    IF v_parts IS NOT NULL THEN
      SELECT id INTO v_id FROM document_master WHERE doc_key(name) = doc_key(v_parts[1]) LIMIT 1;
    END IF;
  END IF;
  RETURN v_id;
END
$$;

DO $$
DECLARE
  r RECORD;
  v_base TEXT;
  v_note TEXT;
  v_parts TEXT[];
  v_id INTEGER;
BEGIN
  -- 1. Names used as they are (no "(note)" / " - note"): each becomes a type,
  --    spelled the way it is used most.
  FOR r IN
    SELECT DISTINCT ON (doc_key(document_name)) doc_clean(document_name) AS name
      FROM (SELECT document_name, count(*) AS n FROM required_documents
             WHERE document_type_id IS NULL
               AND document_name !~ '^.+?\s*\(.+\)\s*$'
               AND document_name !~ '^.+?\s+-\s+.+$'
             GROUP BY document_name) x
     WHERE doc_key(document_name) <> ''
     ORDER BY doc_key(document_name), n DESC, document_name
  LOOP
    PERFORM doc_type_for(r.name);
  END LOOP;

  -- 2. Link every row: whole name first, then "X (note)" / "X - note" when X
  --    is a known type, otherwise the whole name becomes its own type.
  FOR r IN SELECT id, document_name FROM required_documents WHERE document_type_id IS NULL LOOP
    v_id := NULL;
    v_note := NULL;
    SELECT id INTO v_id FROM document_master WHERE doc_key(name) = doc_key(r.document_name) LIMIT 1;

    IF v_id IS NULL THEN
      v_parts := regexp_match(doc_clean(r.document_name), '^(.+?)\s*\((.+)\)$');
      IF v_parts IS NULL THEN
        v_parts := regexp_match(doc_clean(r.document_name), '^(.+?)\s+-\s+(.+)$');
      END IF;
      IF v_parts IS NOT NULL THEN
        v_base := v_parts[1];
        SELECT id INTO v_id FROM document_master WHERE doc_key(name) = doc_key(v_base) LIMIT 1;
        IF v_id IS NOT NULL THEN
          v_note := doc_clean(v_parts[2]);
        END IF;
      END IF;
    END IF;

    IF v_id IS NULL THEN
      v_id := doc_type_for(r.document_name);
    END IF;

    UPDATE required_documents SET document_type_id = v_id, note = NULLIF(v_note, '') WHERE id = r.id;
  END LOOP;

  -- 3. Labels: "<type>" or "<type> (<note>)", in the type's spelling.
  UPDATE required_documents rd
     SET document_name = dm.name || CASE WHEN coalesce(rd.note, '') <> '' THEN ' (' || rd.note || ')' ELSE '' END
    FROM document_master dm
   WHERE dm.id = rd.document_type_id;

  -- 4. Customer uploads.
  --    Linked to an existing type only; anything unmatched stays unlinked.
  UPDATE customer_documents
     SET document_type_id = coalesce(doc_type_find(document_name), doc_type_find(document_type))
   WHERE document_type_id IS NULL;

  -- 5. One type per key, enforced from now on (skipped if older data already
  --    has two types that differ only in case/spaces; merge those first).
  IF NOT EXISTS (SELECT 1 FROM document_master GROUP BY doc_key(name) HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS document_master_key_idx ON document_master (doc_key(name));
  ELSE
    RAISE NOTICE 'document_master has names that differ only in case/spaces; unique key index not created';
  END IF;
END
$$;

-- Rows saved by code that only knows the name get linked automatically.
CREATE OR REPLACE FUNCTION required_documents_link_type() RETURNS TRIGGER
  LANGUAGE plpgsql AS
$$
BEGIN
  IF NEW.document_type_id IS NULL AND coalesce(NEW.document_name, '') <> '' THEN
    NEW.document_type_id := doc_type_for(NEW.document_name);
  END IF;
  -- The label always reads "<type>" or "<type> (<note>)" in the type's spelling.
  IF NEW.document_type_id IS NOT NULL THEN
    SELECT name || CASE WHEN coalesce(NEW.note, '') <> '' THEN ' (' || NEW.note || ')' ELSE '' END
      INTO NEW.document_name FROM document_master WHERE id = NEW.document_type_id;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS required_documents_link_type ON required_documents;
CREATE TRIGGER required_documents_link_type
  BEFORE INSERT OR UPDATE OF document_name, document_type_id, note ON required_documents
  FOR EACH ROW EXECUTE FUNCTION required_documents_link_type();

CREATE OR REPLACE FUNCTION customer_documents_link_type() RETURNS TRIGGER
  LANGUAGE plpgsql AS
$$
BEGIN
  IF NEW.document_type_id IS NULL THEN
    NEW.document_type_id := coalesce(doc_type_find(NEW.document_name), doc_type_find(NEW.document_type));
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS customer_documents_link_type ON customer_documents;
CREATE TRIGGER customer_documents_link_type
  BEFORE INSERT OR UPDATE OF document_name ON customer_documents
  FOR EACH ROW EXECUTE FUNCTION customer_documents_link_type();
