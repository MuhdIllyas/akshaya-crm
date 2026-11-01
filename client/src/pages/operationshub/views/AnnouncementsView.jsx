import React, { useState, useEffect, useMemo } from 'react';
import { FiBell, FiPlus, FiHeart, FiClock, FiUser, FiX, FiGlobe, FiUsers, FiHome } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { fetchAnnouncements, createAnnouncement } from '@/services/knowledge';
import { can } from '@/utils/knowledgePermissions';

const API_BASE = import.meta.env.VITE_API_URL || '';
const authFetch = async (path) => {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
};
const shortCentre = (name = '') => name.replace(/^Akshaya e Centre\s*/i, '');

const EMPTY_FORM = {
  title: '', content: '', category: 'general', priority: 'normal', isPinned: false,
  audienceType: '', centreId: '', teamId: '',
};

// Who an announcement went to, as a small badge
const AudienceBadge = ({ a }) => {
  const type = a.audience_type || (a.team_id ? 'team' : 'all');
  if (type === 'team') {
    return (
      <span className="flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
        {a.team_is_global ? <FiGlobe className="h-3 w-3" /> : <FiUsers className="h-3 w-3" />} {a.team_name || 'Team'}
      </span>
    );
  }
  if (type === 'centre') {
    return (
      <span className="flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
        <FiHome className="h-3 w-3" /> {shortCentre(a.centre_name) || 'Centre'}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
      <FiGlobe className="h-3 w-3" /> Everyone
    </span>
  );
};

const AnnouncementsView = () => {
  const role = localStorage.getItem('role') || 'staff';
  const isSuperadmin = role === 'superadmin';
  const canCreate = can('announcement.create');

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  // Options for "Send to"
  const [teams, setTeams] = useState([]);
  const [centres, setCentres] = useState([]);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      setAnnouncements(await fetchAnnouncements());
    } catch (err) {
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAnnouncements(); }, []);

  // Teams: admin gets their centre's teams, superadmin gets every team (the API scopes this)
  useEffect(() => {
    if (!isModalOpen || !canCreate) return;
    authFetch('/api/teams').then(list => setTeams(Array.isArray(list) ? list : [])).catch(() => setTeams([]));
    if (isSuperadmin) {
      authFetch('/api/centres').then(list => setCentres(Array.isArray(list) ? list : [])).catch(() => setCentres([]));
    }
  }, [isModalOpen]);

  const openModal = () => {
    setFormData({ ...EMPTY_FORM, audienceType: isSuperadmin ? 'all' : 'centre' });
    setIsModalOpen(true);
  };

  const audienceOptions = useMemo(() => (isSuperadmin
    ? [
        { id: 'all', label: 'Everyone', hint: 'All staff in every centre', icon: FiGlobe },
        { id: 'centre', label: 'One centre', hint: 'All staff in a centre', icon: FiHome },
        { id: 'team', label: 'A team', hint: 'Centre or global team', icon: FiUsers },
      ]
    : [
        { id: 'centre', label: 'My centre', hint: 'All staff in your centre', icon: FiHome },
        { id: 'team', label: 'A team', hint: "One of your centre's teams", icon: FiUsers },
      ]), [isSuperadmin]);

  const centreTeams = teams.filter(t => !t.is_global);
  const globalTeams = teams.filter(t => t.is_global);
  const centreName = (id) => shortCentre(centres.find(c => String(c.id) === String(id))?.name || '');

  const audienceReady =
    formData.audienceType === 'all' ||
    (formData.audienceType === 'centre' && (!isSuperadmin || formData.centreId)) ||
    (formData.audienceType === 'team' && formData.teamId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!audienceReady) {
      toast.error(formData.audienceType === 'team' ? 'Choose a team' : 'Choose a centre');
      return;
    }
    try {
      setIsSubmitting(true);
      await createAnnouncement({
        title: formData.title,
        content: formData.content,
        category: formData.category,
        priority: formData.priority,
        isPinned: formData.isPinned,
        audienceType: formData.audienceType,
        centreId: formData.audienceType === 'centre' && isSuperadmin ? formData.centreId : undefined,
        teamId: formData.audienceType === 'team' ? formData.teamId : undefined,
      });
      toast.success('Announcement sent!');
      setIsModalOpen(false);
      setFormData(EMPTY_FORM);
      loadAnnouncements();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to publish announcement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 outline-none focus:bg-white focus:ring-2 focus:ring-navy-500';

  return (
    <div className="animate-in fade-in mx-auto max-w-5xl duration-300">
      {/* Header */}
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Announcements</h2>
          <p className="mt-1 text-sm text-slate-500">Updates for you: from management, your centre and your teams.</p>
        </div>
        {canCreate && (
          <button
            onClick={openModal}
            className="flex items-center gap-2 rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-navy-800"
          >
            <FiPlus className="h-4 w-4" /> New Announcement
          </button>
        )}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">Loading feed...</div>
      ) : announcements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-20 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
            <FiBell className="h-8 w-8" />
          </div>
          <h3 className="mb-1 font-bold text-slate-900">No Announcements</h3>
          <p className="text-sm text-slate-500">
            {canCreate ? 'Send an announcement to your centre or a team.' : 'New updates from management will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map(a => (
            <div key={a.id} className={`rounded-2xl border bg-white p-5 transition-all ${a.is_pinned ? 'border-amber-200 shadow-sm' : 'border-slate-200'}`}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                {a.is_pinned && <span className="flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700"><FiHeart className="h-3 w-3" /> Pinned</span>}
                <AudienceBadge a={a} />
                <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${a.priority === 'high' ? 'bg-rose-100 text-rose-700' : 'bg-navy-500/10 text-navy-700'}`}>{a.priority} priority</span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">{a.category}</span>
              </div>
              <h3 className="mb-3 text-lg font-bold text-slate-900">{a.title}</h3>
              <p className="mb-4 whitespace-pre-wrap text-sm text-slate-700">{a.content}</p>
              <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><FiUser className="h-3.5 w-3.5" /> {a.author_name || 'System Admin'}</span>
                <span className="flex items-center gap-1"><FiClock className="h-3.5 w-3.5" /> {new Date(a.created_at).toLocaleString('en-IN')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Creation Modal */}
      {isModalOpen && canCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
          <div className="animate-in zoom-in-95 max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900"><FiBell className="text-navy-700" /> Send Announcement</h2>
              <button onClick={() => setIsModalOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><FiX className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              {/* Send to */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Send to</label>
                <div className={`grid gap-2 ${audienceOptions.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {audienceOptions.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFormData(f => ({ ...f, audienceType: opt.id, centreId: '', teamId: '' }))}
                      className={`rounded-xl border p-3 text-left transition ${
                        formData.audienceType === opt.id ? 'border-navy-500/30 bg-navy-500/10 ring-1 ring-navy-500' : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <opt.icon className={`mb-1 h-4 w-4 ${formData.audienceType === opt.id ? 'text-navy-700' : 'text-slate-400'}`} />
                      <div className="text-sm font-semibold text-slate-900">{opt.label}</div>
                      <div className="text-[11px] text-slate-500">{opt.hint}</div>
                    </button>
                  ))}
                </div>

                {formData.audienceType === 'centre' && isSuperadmin && (
                  <select
                    value={formData.centreId}
                    onChange={e => setFormData(f => ({ ...f, centreId: e.target.value }))}
                    className={`${inputCls} mt-3`}
                  >
                    <option value="">Choose a centre...</option>
                    {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}

                {formData.audienceType === 'team' && (
                  teams.length === 0 ? (
                    <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">No teams yet. Create one in Teams first.</p>
                  ) : (
                    <select
                      value={formData.teamId}
                      onChange={e => setFormData(f => ({ ...f, teamId: e.target.value }))}
                      className={`${inputCls} mt-3`}
                    >
                      <option value="">Choose a team...</option>
                      {centreTeams.length > 0 && (
                        <optgroup label="Centre teams">
                          {centreTeams.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.name}{isSuperadmin && centreName(t.centre_id) ? ` · ${centreName(t.centre_id)}` : ''} ({t.member_count || 0})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {isSuperadmin && globalTeams.length > 0 && (
                        <optgroup label="Global teams">
                          {globalTeams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.member_count || 0})</option>)}
                        </optgroup>
                      )}
                    </select>
                  )
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Title</label>
                <input required type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className={`${inputCls} min-h-[44px] text-base sm:text-sm`} placeholder="e.g. Server maintenance tonight" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Message</label>
                <textarea required rows="4" value={formData.content} onChange={e => setFormData({ ...formData, content: e.target.value })} className={`${inputCls} resize-none`} placeholder="Provide details here..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Category</label>
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className={inputCls}>
                    <option value="general">General</option>
                    <option value="government">Government Order</option>
                    <option value="software">Software Update</option>
                    <option value="training">Training</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Priority</label>
                  <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })} className={inputCls}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="pin" checked={formData.isPinned} onChange={e => setFormData({ ...formData, isPinned: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-navy-700 focus:ring-navy-500" />
                <label htmlFor="pin" className="cursor-pointer text-sm font-medium text-slate-700">Pin to top of the feed</label>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={isSubmitting || !audienceReady} className="rounded-xl bg-navy-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50">
                  {isSubmitting ? 'Sending...' : 'Send Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementsView;
