// src/components/files/ServiceFilesPopover.jsx
// Paperclip button for a service cart card. Shows the File Repository files linked to the
// selected service (files.related_service_id === categoryId) and opens one in a new tab.
// Read-only and self-contained: it never touches the service entry form, its state or its payload.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiPaperclip, FiChevronDown, FiExternalLink, FiFileText, FiFile, FiBell, FiGlobe, FiHome } from 'react-icons/fi';

const API_BASE_URL = import.meta.env.VITE_API_URL;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// File Repository categories (same ids as FilesView.jsx)
const CATEGORY_META = {
  application_forms: { label: 'Application Forms', icon: FiFileText, color: 'bg-emerald-100 text-emerald-700' },
  affidavits:        { label: 'Affidavits',        icon: FiFile,     color: 'bg-rose-100 text-rose-700' },
  govt_orders:       { label: 'Government Orders', icon: FiFileText, color: 'bg-slate-100 text-navy-700' },
  circulars:         { label: 'Circulars',         icon: FiBell,     color: 'bg-slate-200 text-navy-800' },
  notifications:     { label: 'Notifications',     icon: FiBell,     color: 'bg-amber-100 text-amber-700' },
  manuals:           { label: 'Manuals',           icon: FiFileText, color: 'bg-orange-100 text-orange-700' },
  general_files:     { label: 'General Files',     icon: FiFile,     color: 'bg-slate-50 text-slate-600' },
};
// Forms first, then the rest
const CATEGORY_ORDER = ['application_forms', 'affidavits', 'govt_orders', 'circulars', 'notifications', 'manuals', 'general_files'];

// One shared fetch of /api/files for the whole page: every cart card reuses it.
let filesCache = null;
let filesPromise = null;
const loadAllFiles = () => {
  if (filesCache) return Promise.resolve(filesCache);
  if (!filesPromise) {
    filesPromise = fetch(`${API_BASE_URL}/api/files`, { headers: authHeaders() })
      .then(res => (res.ok ? res.json() : []))
      .then(data => { filesCache = Array.isArray(data) ? data : []; return filesCache; })
      .catch(() => [])
      .finally(() => { filesPromise = null; });
  }
  return filesPromise;
};
// Call after uploading a file if you want the next popover open to refetch.
export const clearServiceFilesCache = () => { filesCache = null; };

const ServiceFilesPopover = ({ categoryId, repositoryPath }) => {
  const [files, setFiles] = useState([]);
  const [open, setOpen] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  const [error, setError] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0, width: 320 });
  const btnRef = useRef(null);
  const popRef = useRef(null);

  // Files for this service; quietly empty when there are none or the request fails.
  useEffect(() => {
    let alive = true;
    setOpen(false);
    if (!categoryId) { setFiles([]); return; }
    loadAllFiles().then(all => {
      if (!alive) return;
      const mine = all
        .filter(f => String(f.related_service_id) === String(categoryId))
        .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
          || (a.name || '').localeCompare(b.name || ''));
      setFiles(mine);
    });
    return () => { alive = false; };
  }, [categoryId]);

  // The cart card clips overflow, so the list is portalled to <body> and placed under the button.
  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(320, window.innerWidth - 16);
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    setPos({ top: r.bottom + 6, left, width });
  };
  useLayoutEffect(() => { if (open) place(); }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onMove = () => place();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open]);

  // The download route needs the auth header, so fetch the latest version as a blob and open that.
  const openFile = async (file) => {
    setError('');
    setOpeningId(file.id);
    const tab = window.open('', '_blank'); // opened now, inside the click, so popup blockers allow it
    try {
      const vRes = await fetch(`${API_BASE_URL}/api/files/${file.id}/versions`, { headers: authHeaders() });
      if (!vRes.ok) throw new Error('versions');
      const versions = await vRes.json();
      const latest = [...(versions || [])].sort((a, b) => (b.version_number || 0) - (a.version_number || 0))[0];
      if (!latest) throw new Error('no version');

      const res = await fetch(`${API_BASE_URL}/api/files/version/${latest.id}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(res.status === 403 ? 'denied' : 'download');
      const url = URL.createObjectURL(await res.blob());
      if (tab) tab.location.href = url;
      else window.location.assign(url);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      if (tab) tab.close();
      setError(e.message === 'denied' ? "You don't have access to this file." : "Couldn't open this file. Try again.");
    } finally {
      setOpeningId(null);
    }
  };

  if (!categoryId || files.length === 0) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        title="Forms and files for this service"
        className={`flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] rounded-lg border text-xs font-semibold transition-colors ${
          open ? 'border-navy-500/40 bg-navy-500/10 text-navy-800' : 'border-navy-500/30 bg-navy-500/5 text-navy-700 hover:bg-navy-500/10'
        }`}
      >
        <FiPaperclip className="h-3.5 w-3.5" />
        {files.length}
        <FiChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          ref={popRef}
          role="menu"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
          className="z-[55] bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Forms for this service
          </div>
          <div className="divide-y divide-slate-100 max-h-[min(360px,60vh)] overflow-y-auto">
            {files.map(f => {
              const meta = CATEGORY_META[f.category] || CATEGORY_META.general_files;
              const Icon = meta.icon;
              const busy = openingId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="menuitem"
                  onClick={() => openFile(f)}
                  disabled={busy}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 disabled:opacity-60"
                >
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-800 truncate">{f.name}</span>
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      {meta.label}
                      <span className="text-slate-300">·</span>
                      {f.is_global
                        ? <><FiGlobe className="h-3 w-3" /> Global</>
                        : <><FiHome className="h-3 w-3" /> Centre</>}
                    </span>
                  </span>
                  {busy
                    ? <span className="h-4 w-4 border-2 border-navy-500 border-t-transparent rounded-full animate-spin" />
                    : <FiExternalLink className="h-4 w-4 text-slate-400" />}
                </button>
              );
            })}
          </div>
          {error && <div className="px-3 py-2 text-xs text-rose-600 bg-rose-50 border-t border-rose-100">{error}</div>}
          {repositoryPath && (
            <a href={repositoryPath} target="_blank" rel="noopener noreferrer"
               className="block px-3 py-2 border-t border-slate-100 text-xs text-navy-700 font-medium hover:bg-slate-50">
              Open File Repository →
            </a>
          )}
        </div>,
        document.body
      )}
    </>
  );
};

export default ServiceFilesPopover;