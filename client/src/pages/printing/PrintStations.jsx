// Print Stations tab (used inside AdminPrintSettings.jsx)
// - shows whether the print agent is installed on THIS PC
// - "Add this PC" -> 6-digit pairing code
// - list of paired PCs with online status and the printers each one reports
// Also exports <PrinterNamePicker/> used in the Add/Edit Printer form.
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FiMonitor, FiPlus, FiTrash2, FiPrinter, FiAlertCircle, FiDownload, FiRefreshCw, FiCopy } from 'react-icons/fi';

const API = `${import.meta.env.VITE_API_URL}/api/print-agent`;
const AGENT_LOCAL = 'http://127.0.0.1:17777/api/status';
const AGENT_DOWNLOAD = '/downloads/AkshayaPrintAgent-Setup.exe'; // host the installer here (Vercel /public/downloads/)
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export function usePrintStations(centreId) {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/stations`, { ...auth(), params: centreId ? { centre_id: centreId } : {} });
      setStations(data.stations || []);
    } catch { /* shown as empty list */ } finally { setLoading(false); }
  }, [centreId]);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);
  return { stations, loading, reload: load };
}

// Is the print agent running on the PC that is viewing this page?
function useLocalAgent() {
  const [agent, setAgent] = useState(undefined);
  useEffect(() => {
    let alive = true;
    const check = () => fetch(AGENT_LOCAL, { cache: 'no-store' })
      .then(r => r.json()).then(d => alive && setAgent(d)).catch(() => alive && setAgent(null));
    check();
    const t = setInterval(check, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return agent;
}

const StatusBadge = ({ online }) => (
  <span className={`${online ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'} text-xs font-medium px-3 py-1.5 rounded-full flex items-center w-fit border`}>
    <span className={`w-2 h-2 ${online ? 'bg-emerald-500' : 'bg-rose-500'} rounded-full mr-2`} />
    {online ? 'ONLINE' : 'OFFLINE'}
  </span>
);

export default function PrintStations({ centreId }) {
  const { stations, loading, reload } = usePrintStations(centreId);
  const local = useLocalAgent();
  const [code, setCode] = useState(null);
  const [creating, setCreating] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!code) return undefined;
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((code.until - Date.now()) / 1000));
      setSecondsLeft(s);
      if (!s) setCode(null);
    }, 1000);
    return () => clearInterval(t);
  }, [code]);

  // when a new PC pairs while the code is showing, refresh faster
  useEffect(() => {
    if (!code) return undefined;
    const t = setInterval(reload, 4000);
    return () => clearInterval(t);
  }, [code, reload]);

  const newCode = async () => {
    setCreating(true);
    try {
      const { data } = await axios.post(`${API}/pairing-codes`, { centre_id: centreId }, auth());
      setCode({ value: data.code, until: Date.now() + data.expires_in * 1000 });
      setSecondsLeft(data.expires_in);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Could not create pairing code', { position: 'top-right', autoClose: 5000, theme: 'light' });
    } finally { setCreating(false); }
  };

  const remove = async s => {
    if (!window.confirm(`Remove "${s.name}"? This PC will stop printing until it is paired again.`)) return;
    try {
      await axios.delete(`${API}/stations/${s.id}`, auth());
      toast.success('Print station removed', { position: 'top-right', autoClose: 3000, theme: 'light' });
      reload();
    } catch {
      toast.error('Failed to remove station', { position: 'top-right', autoClose: 5000, theme: 'light' });
    }
  };

  const thisPcPairedHere = local?.paired && Number(local.centreId) === Number(centreId);

  return (
    <div className="space-y-6">
      {/* This PC */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-12 h-12 shrink-0 bg-slate-100 text-navy-700 rounded-xl flex items-center justify-center text-2xl border border-slate-200"><FiMonitor /></div>
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 text-lg">This PC</h3>
            <p className="text-sm text-slate-600 mt-0.5">
              {local === undefined && 'Checking for the print agent…'}
              {local === null && 'Print agent is not installed on this PC.'}
              {local && !local.paired && 'Print agent is installed but not paired yet. Click "Add this PC".'}
              {local && local.paired && !thisPcPairedHere && `Paired to another centre (${local.centreName || local.centreId}).`}
              {thisPcPairedHere && `Paired · ${local.connected ? 'connected' : 'cannot reach server'} · ${local.printers.filter(p => !p.virtual).length} printer(s) found`}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          {local === null && (
            <a href={AGENT_DOWNLOAD} className="flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-all">
              <FiDownload /> Download installer
            </a>
          )}
          <button onClick={newCode} disabled={creating} className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 min-h-[44px] rounded-xl font-semibold text-white bg-navy-700 hover:bg-navy-800 shadow-sm transition-all disabled:opacity-50">
            <FiPlus className="text-lg" /> Add this PC
          </button>
        </div>
      </div>

      {/* Pairing code */}
      {code && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 text-center">
          <p className="text-sm text-slate-600">Type this code in the print agent installer, or on the agent page (desktop shortcut <b>Akshaya Print Agent</b>)</p>
          <div className="flex items-center justify-center gap-3 my-4">
            <span className="text-4xl sm:text-5xl font-mono font-bold tracking-[0.3em] text-navy-700">{code.value}</span>
            <button onClick={() => { navigator.clipboard?.writeText(code.value); toast.info('Code copied', { autoClose: 1500 }); }}
              className="p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center bg-slate-100 text-navy-700 hover:bg-slate-200 rounded-lg transition" title="Copy"><FiCopy /></button>
          </div>
          <p className="text-xs text-slate-500">Valid for {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')} · one use only</p>
        </div>
      )}

      {/* Stations */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Paired PCs</h3>
        <button onClick={reload} className="p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition" title="Refresh"><FiRefreshCw /></button>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : stations.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-2xl w-20 h-20 flex items-center justify-center mb-6 mx-auto"><FiMonitor className="text-slate-400 text-3xl" /></div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No PCs paired yet</h3>
          <p className="text-slate-600">Install the print agent on the PC connected to your printers, then click "Add this PC".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stations.map(s => {
            const realPrinters = (s.printers || []).filter(p => !p.virtual);
            return (
              <div key={s.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 transition-all hover:shadow-md group relative">
                <div className="absolute top-4 right-4 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button onClick={() => remove(s)} className="p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center bg-slate-100 text-rose-600 hover:bg-rose-100 rounded-lg transition" title="Remove"><FiTrash2 /></button>
                </div>
                <div className="w-12 h-12 bg-slate-100 text-navy-700 rounded-xl flex items-center justify-center text-2xl border border-slate-200 mb-4"><FiMonitor /></div>
                <div className="flex flex-wrap justify-between items-center gap-2 mb-1">
                  <h3 className="font-bold text-slate-900 text-xl truncate pr-2 min-w-0">{s.name}</h3>
                  <StatusBadge online={s.online} />
                </div>
                <p className="text-sm text-slate-500 mb-4">
                  {s.os_user ? `${s.os_user} · ` : ''}v{s.agent_version || '?'} · last seen {s.last_seen_at ? new Date(s.last_seen_at).toLocaleString('en-IN') : 'never'}
                </p>
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Printers on this PC</p>
                  {realPrinters.length ? (
                    <div className="flex flex-wrap gap-2">
                      {realPrinters.map(p => (
                        <span key={p.name} className={`text-xs px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${p.offline ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                          <FiPrinter /> {p.name}{p.offline ? ' (offline)' : ''}
                        </span>
                      ))}
                    </div>
                  ) : <p className="text-sm text-slate-500">No printers reported</p>}
                </div>
                {s.last_error && (
                  <p className="mt-4 text-xs text-rose-600 flex items-start gap-1.5"><FiAlertCircle className="mt-0.5 shrink-0" /> {s.last_error}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Dropdown of printers reported by this centre's PCs; falls back to typing when none are known
export function PrinterNamePicker({ centreId, value, onChange, className = '' }) {
  const { stations } = usePrintStations(centreId);
  const options = [];
  const seen = new Set();
  for (const s of stations) {
    for (const p of s.printers || []) {
      if (p.virtual || seen.has(p.name)) continue;
      seen.add(p.name);
      options.push({ name: p.name, station: s.name });
    }
  }
  const known = options.some(o => o.name === value);
  const [manual, setManual] = useState(false);
  const showInput = manual || options.length === 0 || (value && !known);

  if (showInput) {
    return (
      <div>
        <input type="text" required placeholder="e.g., Canon iR2270/2870 PCL5e" value={value || ''} onChange={e => onChange(e.target.value)} className={className} />
        {options.length > 0 && (
          <button type="button" onClick={() => { setManual(false); onChange(''); }} className="text-xs text-navy-700 font-medium mt-1">Choose from detected printers</button>
        )}
      </div>
    );
  }
  return (
    <select required value={value || ''} className={className}
      onChange={e => (e.target.value === '__manual__' ? (setManual(true), onChange('')) : onChange(e.target.value))}>
      <option value="">Select printer…</option>
      {options.map(o => <option key={o.name} value={o.name}>{o.name} — {o.station}</option>)}
      <option value="__manual__">Other (type name)…</option>
    </select>
  );
}