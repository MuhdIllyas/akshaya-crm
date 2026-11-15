// Required-documents picker for the service forms.
//
// Documents come from the organization's one list of document types, so the
// same document is never typed two ways ("Ration Card" / "RationCard"). Each
// picked document can carry a short note ("all family members", "if married").
// Admins and superadmins can add a missing document; the server warns when a
// similar one already exists.
//
// value: [{ document_type_id, note, label }]   (label: text shown for rows not
//         linked yet, e.g. before the server migration ran)

import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { FiPlus, FiSearch, FiX, FiAlertCircle } from "react-icons/fi";

const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL}/api/document-types` });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")?.trim();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const docKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// One shared copy of the list for every picker on the page.
let cache = null;
let loading = null;
const listeners = new Set();
function loadTypes(force = false) {
  if (cache && !force) return Promise.resolve(cache);
  if (!loading || force) {
    loading = api
      .get("/", { params: { active: 1 } })
      .then(({ data }) => {
        cache = Array.isArray(data) ? data : [];
        listeners.forEach((fn) => fn(cache));
        return cache;
      })
      .finally(() => {
        loading = null;
      });
  }
  return loading;
}

/** Service rows ({ document_type_id, note, document_name }) -> picker value. */
export const toPickedDocuments = (rows) =>
  (rows || []).map((r) => ({
    document_type_id: r.document_type_id ?? null,
    note: r.note || "",
    label: r.document_name || "",
  }));

/** Picker value -> what the server saves. */
export const toDocumentPayload = (items) =>
  (items || []).map((i) =>
    i.document_type_id
      ? { document_type_id: i.document_type_id, note: (i.note || "").trim() || null }
      : { name: i.label, note: (i.note || "").trim() || null }
  );

export default function DocumentPicker({ value = [], onChange, canAdd = true }) {
  const [types, setTypes] = useState(cache || []);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [similar, setSimilar] = useState(null); // { name, list }
  const [error, setError] = useState("");
  const boxRef = useRef(null);

  useEffect(() => {
    listeners.add(setTypes);
    loadTypes().then(setTypes).catch(() => setError("Couldn't load the document list"));
    return () => listeners.delete(setTypes);
  }, []);

  useEffect(() => {
    const close = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const byId = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const nameOf = (item) => byId.get(item.document_type_id)?.name || item.label || "Document";

  const q = docKey(query);
  const matches = useMemo(() => {
    if (!q) return types.slice(0, 8);
    return types.filter((t) => docKey(t.name).includes(q)).slice(0, 8);
  }, [types, q]);
  const exact = types.find((t) => docKey(t.name) === q);

  const pick = (type) => {
    onChange([...value, { document_type_id: type.id, note: "", label: type.name }]);
    setQuery("");
    setSimilar(null);
    setError("");
  };

  const addNew = async (force = false) => {
    const name = query.replace(/\s+/g, " ").trim();
    if (!docKey(name)) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post("/", { name, force });
      await loadTypes(true);
      pick(data);
    } catch (err) {
      const body = err.response?.data || {};
      if (body.code === "EXISTS" && body.existing) pick(body.existing);
      else if (body.code === "SIMILAR") setSimilar({ name, list: body.similar || [] });
      else setError(body.error || "Couldn't add the document");
    } finally {
      setBusy(false);
    }
  };

  const setNote = (index, note) => onChange(value.map((v, i) => (i === index ? { ...v, note } : v)));
  const remove = (index) => onChange(value.filter((_, i) => i !== index));

  return (
    <div ref={boxRef} className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((item, i) => (
            <li
              key={`${item.document_type_id || item.label}-${i}`}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5"
            >
              <span className="min-w-0 shrink-0 truncate text-sm font-medium text-slate-800" title={nameOf(item)}>
                {nameOf(item)}
              </span>
              <input
                value={item.note || ""}
                onChange={(e) => setNote(i, e.target.value)}
                placeholder="Note (optional), e.g. all family members"
                maxLength={200}
                className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-xs text-slate-600 placeholder:text-slate-400 hover:border-slate-200 focus:border-navy-500 focus:bg-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-rose-600"
                aria-label={`Remove ${nameOf(item)}`}
              >
                <FiX className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setSimilar(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              // Enter picks a document from the list; adding a new one is
              // always an explicit click, so a half-typed name isn't added.
              if (exact) pick(exact);
              else if (q && matches.length > 0) pick(matches[0]);
            }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search documents to add…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/20"
        />

        {open && (matches.length > 0 || (canAdd && q && !exact)) && (
          <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {matches.map((t) => (
              <button
                key={t.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(t)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <span>{t.name}</span>
                {t.used_by > 0 && <span className="text-xs text-slate-400">{t.used_by} services</span>}
              </button>
            ))}
            {canAdd && q && !exact && (
              <button
                type="button"
                disabled={busy}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addNew()}
                className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-navy-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <FiPlus className="h-4 w-4" />
                Add “{query.trim()}” as a new document
              </button>
            )}
          </div>
        )}
      </div>

      {similar && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-medium">
            <FiAlertCircle className="h-4 w-4 shrink-0" /> Similar documents already exist
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {similar.list.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pick(t)}
                className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-amber-100"
              >
                Use “{t.name}”
              </button>
            ))}
            <button
              type="button"
              disabled={busy}
              onClick={() => addNew(true)}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-amber-800 underline hover:text-amber-950 disabled:opacity-50"
            >
              Add “{similar.name}” anyway
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
