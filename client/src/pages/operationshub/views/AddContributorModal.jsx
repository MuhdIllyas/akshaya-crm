import React, { useState, useEffect } from 'react';
import { FiX, FiSearch, FiUserPlus, FiCheck, FiLoader } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { fetchStaffSuggestions, addContributor } from '@/services/knowledge';

export const CONTRIBUTOR_ROLE_OPTIONS = [
  { id: 'OWNER',    label: 'Owner',    hint: 'Responsible for keeping this service up to date' },
  { id: 'EDITOR',   label: 'Editor',   hint: 'Writes and updates SOPs and FAQs' },
  { id: 'REVIEWER', label: 'Reviewer', hint: 'Checks content before it is published' },
  { id: 'VIEWER',   label: 'Viewer',   hint: 'Follows this service for updates' },
];

const AddContributorModal = ({ workspaceId, existingStaffIds = [], onClose, onAdded }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [role, setRole] = useState('EDITOR');
  const [saving, setSaving] = useState(false);

  // Debounced staff search (reuses the @mention search endpoint)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        setResults(await fetchStaffSuggestions(q));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSave = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      await addContributor(workspaceId, selected.id, role);
      toast.success(`${selected.display} added as ${role.toLowerCase()}`);
      onAdded();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add contributor');
    } finally {
      setSaving(false);
    }
  };

  const isExisting = (id) => existingStaffIds.map(String).includes(String(id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FiUserPlus className="text-navy-700" /> Add Contributor
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"><FiX className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Staff search */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Staff member</label>
            {selected ? (
              <div className="flex items-center justify-between p-3 bg-navy-500/10 border border-navy-500/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-navy-700 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {selected.display?.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{selected.display}</span>
                </div>
                <button onClick={() => setSelected(null)} className="text-xs font-semibold text-navy-700 hover:underline">Change</button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Type at least 2 letters of a name..."
                    className="min-h-[44px] w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-navy-500 outline-none text-base sm:text-sm"
                  />
                  {searching && <FiLoader className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
                </div>
                {results.length > 0 && (
                  <div className="mt-2 border border-slate-200 rounded-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {results.map(s => {
                      const already = isExisting(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={already}
                          onClick={() => setSelected(s)}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="font-medium text-slate-800">{s.display}</span>
                          {already && <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1"><FiCheck /> Already added</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {query.trim().length >= 2 && !searching && results.length === 0 && (
                  <p className="mt-2 text-xs text-slate-500">No staff found.</p>
                )}
              </>
            )}
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Role</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CONTRIBUTOR_ROLE_OPTIONS.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={`text-left p-3 rounded-xl border transition ${
                    role === r.id ? 'bg-navy-500/10 border-navy-500/30 ring-1 ring-navy-500' : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900">{r.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{r.hint}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!selected || saving}
            className="px-6 py-2.5 text-sm font-medium text-white bg-navy-700 hover:bg-navy-800 rounded-xl disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add Contributor'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddContributorModal;