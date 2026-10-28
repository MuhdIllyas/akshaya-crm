// Printing > Print Stations  (admin: own centre, superadmin: pick any centre)
// Drop into your printing settings page:  <PrintStations centreId={selectedCentreId} />
// Also exports <PrinterNamePicker/> for the printer-config form, so admins pick the
// exact Windows printer name from a dropdown instead of typing driver_name.
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api` });
api.interceptors.request.use(cfg => {
  cfg.headers.Authorization = `Bearer ${localStorage.getItem('token')}`;
  return cfg;
});

const BASE = '/print-agent';
const AGENT_LOCAL = 'http://127.0.0.1:17777/api/status';
const AGENT_DOWNLOAD = '/downloads/AkshayaPrintAgent-Setup.exe'; // >>> ADAPT: where you host the installer

export function usePrintStations(centreId) {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`${BASE}/stations`, { params: centreId ? { centre_id: centreId } : {} });
      setStations(data.stations || []);
    } finally { setLoading(false); }
  }, [centreId]);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);
  return { stations, loading, reload: load };
}

// Is the agent running on the PC that is viewing this page?
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

export default function PrintStations({ centreId }) {
  const { stations, loading, reload } = usePrintStations(centreId);
  const local = useLocalAgent();
  const [code, setCode] = useState(null);
  const [err, setErr] = useState(null);

  const newCode = async () => {
    setErr(null);
    try {
      const { data } = await api.post(`${BASE}/pairing-codes`, { centre_id: centreId });
      setCode({ value: data.code, until: Date.now() + data.expires_in * 1000 });
    } catch (e) { setErr(e.response?.data?.error || e.message); }
  };
  const remove = async (s) => {
    if (!window.confirm(`Remove "${s.name}"? It will stop printing until paired again.`)) return;
    await api.delete(`${BASE}/stations/${s.id}`);
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <div className="font-semibold">This PC</div>
          <div className="text-sm text-gray-600">
            {local === undefined && 'Checking…'}
            {local === null && <>Print agent not installed. <a className="text-navy-700 font-medium underline" href={AGENT_DOWNLOAD}>Download installer</a></>}
            {local && !local.paired && 'Agent installed but not paired — click "Add this PC".'}
            {local && local.paired && <>Paired to <b>{local.centreName || local.centreId}</b> · {local.connected ? 'online' : 'offline'} · {local.printers.length} printer(s)</>}
          </div>
        </div>
        <button className="px-4 py-2.5 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors" onClick={newCode}>Add this PC</button>
      </div>

      {code && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-sm">Type this code in the installer, or on the agent page (desktop shortcut "Akshaya Print Agent"):</div>
          <div className="text-4xl font-mono tracking-[0.3em] my-2 text-navy-700">{code.value}</div>
          <div className="text-xs text-gray-600">Valid for 15 minutes · one use only</div>
        </div>
      )}
      {err && <div className="text-red-600 text-sm">{err}</div>}

      <div className="rounded-xl border divide-y">
        {loading && <div className="p-4 text-sm text-gray-500">Loading…</div>}
        {!loading && !stations.length && <div className="p-4 text-sm text-gray-500">No print stations yet.</div>}
        {stations.map(s => (
          <div key={s.id} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${s.online ? 'bg-green-500' : 'bg-red-500'}`} />
                <b>{s.name}</b>
                <span className="text-xs text-gray-500 ml-2">v{s.agent_version} · {s.os_user || '—'} · last seen {s.last_seen_at ? new Date(s.last_seen_at).toLocaleString('en-IN') : 'never'}</span>
              </div>
              <button className="text-sm text-red-600" onClick={() => remove(s)}>Remove</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(s.printers || []).filter(p => !p.virtual).map(p => (
                <span key={p.name} className={`text-xs px-2 py-1 rounded-full border ${p.offline ? 'border-red-300 text-red-700' : 'border-gray-300'}`}>
                  {p.name}{p.offline ? ' (offline)' : ''}
                </span>
              ))}
            </div>
            {s.last_error && <div className="mt-2 text-xs text-red-600">{s.last_error}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// Use in your printer configuration form instead of a free-text driver_name input
export function PrinterNamePicker({ centreId, value, onChange }) {
  const { stations } = usePrintStations(centreId);
  const options = stations.flatMap(s => (s.printers || []).filter(p => !p.virtual).map(p => ({ station: s.name, name: p.name })));
  return (
    <select className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent" value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="">Select printer…</option>
      {options.map(o => <option key={`${o.station}|${o.name}`} value={o.name}>{o.name} — {o.station}</option>)}
      {value && !options.some(o => o.name === value) && <option value={value}>{value} (not found on any PC)</option>}
    </select>
  );
}
