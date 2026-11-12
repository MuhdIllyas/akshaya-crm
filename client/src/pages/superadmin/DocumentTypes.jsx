// Superadmin: the organization's list of document types.
// Services pick their required documents from this list and customer uploads
// are linked to it. Here the superadmin renames a type, merges duplicates
// (moving every service and upload over) and switches types off.

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { FiSearch, FiEdit2, FiCheck, FiX, FiGitMerge, FiPlus, FiFileText, FiLoader } from "react-icons/fi";

const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL}/api/document-types` });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")?.trim();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/20";
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors";
const btnPrimary = `${btnBase} bg-navy-700 text-white shadow-sm hover:bg-navy-800`;
const btnGhost = `${btnBase} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
const iconBtn =
  "rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-navy-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500";

const docKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const errorOf = (err, fallback) => err.response?.data?.error || fallback;

const FILTERS = [
  { id: "all", label: "All" },
  { id: "once", label: "Used by one service" },
  { id: "unused", label: "Not used" },
  { id: "off", label: "Switched off" },
];

export default function DocumentTypes() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState(null); // { id, name }
  const [merging, setMerging] = useState(null); // type being merged away
  const [mergeTarget, setMergeTarget] = useState("");
  const [mergeQuery, setMergeQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [similar, setSimilar] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .get("/")
      .then(({ data }) => setTypes(Array.isArray(data) ? data : []))
      .catch((err) => toast.error(errorOf(err, "Couldn't load document types")))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(
    () => ({
      all: types.length,
      once: types.filter((t) => t.used_by === 1).length,
      unused: types.filter((t) => t.used_by === 0 && t.uploads === 0).length,
      off: types.filter((t) => !t.active).length,
    }),
    [types]
  );

  const shown = useMemo(() => {
    const q = docKey(query);
    return types.filter((t) => {
      if (q && !docKey(t.name).includes(q)) return false;
      if (filter === "once") return t.used_by === 1;
      if (filter === "unused") return t.used_by === 0 && t.uploads === 0;
      if (filter === "off") return !t.active;
      return true;
    });
  }, [types, query, filter]);

  const save = async (type, changes, message) => {
    setBusy(true);
    try {
      await api.put(`/${type.id}`, changes);
      toast.success(message);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(errorOf(err, "Couldn't save"));
    } finally {
      setBusy(false);
    }
  };

  const merge = async () => {
    if (!merging || !mergeTarget) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/${merging.id}/merge`, { into_id: Number(mergeTarget) });
      const target = types.find((t) => t.id === Number(mergeTarget));
      toast.success(
        `Merged into “${target?.name}”: ${data.services_updated} service document(s) and ${data.uploads_updated} upload(s) moved`
      );
      setMerging(null);
      setMergeTarget("");
      setMergeQuery("");
      await load();
    } catch (err) {
      toast.error(errorOf(err, "Couldn't merge"));
    } finally {
      setBusy(false);
    }
  };

  const add = async (force = false) => {
    const name = newName.replace(/\s+/g, " ").trim();
    if (!docKey(name)) return;
    setBusy(true);
    try {
      await api.post("/", { name, force });
      toast.success(`Added “${name}”`);
      setNewName("");
      setSimilar(null);
      await load();
    } catch (err) {
      const body = err.response?.data || {};
      if (body.code === "SIMILAR") setSimilar(body.similar || []);
      else toast.error(body.error || "Couldn't add");
    } finally {
      setBusy(false);
    }
  };

  const mergeOptions = useMemo(() => {
    if (!merging) return [];
    const q = docKey(mergeQuery);
    return types.filter((t) => t.id !== merging.id && (!q || docKey(t.name).includes(q))).slice(0, 50);
  }, [types, merging, mergeQuery]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-slate-900">Document Types</h1>
          <p className="text-sm text-slate-500">
            The one list of documents that services ask for and customers upload. Merge duplicates so the same
            document isn't listed twice.
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents…" className={`${inputCls} pl-9`} />
          </div>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setSimilar(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="New document name"
              className={inputCls}
            />
            <button type="button" className={btnPrimary} disabled={busy || !docKey(newName)} onClick={() => add()}>
              <FiPlus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>
        {similar && (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Similar documents already exist: {similar.map((t) => `“${t.name}”`).join(", ")}.{" "}
            <button type="button" className="font-medium underline" onClick={() => add(true)} disabled={busy}>
              Add “{newName.trim()}” anyway
            </button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                filter === f.id ? "bg-navy-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label} <span className="opacity-70">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
            <FiLoader className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">No documents match.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                    <FiFileText className="h-4 w-4" />
                  </span>
                  {editing?.id === t.id ? (
                    <div className="flex flex-1 items-center gap-1">
                      <input
                        autoFocus
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") save(t, { name: editing.name }, "Renamed");
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className={inputCls}
                      />
                      <button type="button" className={iconBtn} disabled={busy} onClick={() => save(t, { name: editing.name }, "Renamed")} aria-label="Save name">
                        <FiCheck className="h-4 w-4" />
                      </button>
                      <button type="button" className={iconBtn} onClick={() => setEditing(null)} aria-label="Cancel">
                        <FiX className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-medium ${t.active ? "text-slate-900" : "text-slate-400 line-through"}`}>{t.name}</p>
                      <p className="text-xs text-slate-500">
                        {t.used_by === 0 ? "Not used by any service" : `Used by ${t.used_by} service${t.used_by === 1 ? "" : "s"}`}
                        {t.uploads > 0 && ` · ${t.uploads} customer upload${t.uploads === 1 ? "" : "s"}`}
                      </p>
                    </div>
                  )}
                </div>
                {editing?.id !== t.id && (
                  <div className="flex shrink-0 items-center gap-1 sm:justify-end">
                    <button type="button" className={iconBtn} onClick={() => setEditing({ id: t.id, name: t.name })} aria-label={`Rename ${t.name}`} title="Rename">
                      <FiEdit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className={iconBtn}
                      onClick={() => {
                        setMerging(t);
                        setMergeTarget("");
                        setMergeQuery("");
                      }}
                      aria-label={`Merge ${t.name} into another document`}
                      title="Merge into another document"
                    >
                      <FiGitMerge className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => save(t, { active: !t.active }, t.active ? "Switched off" : "Switched on")}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                        t.active ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                      title={t.active ? "Shown when picking documents. Click to switch off." : "Hidden when picking documents. Click to switch on."}
                    >
                      {t.active ? "On" : "Off"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {merging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => !busy && setMerging(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900">Merge “{merging.name}”</h2>
            <p className="mt-1 text-sm text-slate-500">
              Every service that asks for “{merging.name}” and every customer upload of it will move to the document you
              choose. “{merging.name}” is then removed. This can't be undone.
            </p>
            <input value={mergeQuery} onChange={(e) => setMergeQuery(e.target.value)} placeholder="Search the document to keep…" className={`${inputCls} mt-3`} />
            <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-slate-200">
              {mergeOptions.map((t) => (
                <label key={t.id} className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 ${String(t.id) === mergeTarget ? "bg-slate-100" : ""}`}>
                  <input type="radio" name="merge-target" value={t.id} checked={String(t.id) === mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} />
                  <span className="flex-1">{t.name}</span>
                  <span className="text-xs text-slate-400">{t.used_by} services</span>
                </label>
              ))}
              {mergeOptions.length === 0 && <p className="p-3 text-sm text-slate-500">No match.</p>}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={btnGhost} disabled={busy} onClick={() => setMerging(null)}>
                Cancel
              </button>
              <button type="button" className={btnPrimary} disabled={busy || !mergeTarget} onClick={merge}>
                <FiGitMerge className="h-4 w-4" /> Merge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
