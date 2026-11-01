import React, { useState, useEffect, useMemo } from 'react';
import { FiCreditCard, FiLoader, FiAlertTriangle, FiChevronDown } from 'react-icons/fi';
import { fetchServiceCharges } from '@/services/knowledge';

// Charges are set per centre in Service Management, so they're shown here
// live instead of being typed into the shared SOP.
const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// Row list for one centre: subcategories, or the service itself if it has none
const rowsFor = (centre) => {
  if (centre.subcategories?.length) return centre.subcategories;
  if (centre.service) return [{ id: 'svc', name: 'Service', ...centre.service }];
  return [];
};

const SingleCentreTable = ({ centre }) => {
  const rows = rowsFor(centre);
  if (!centre.enabled) {
    return <p className="px-5 py-4 text-sm text-slate-500">This service isn't enabled at {centre.name}.</p>;
  }
  if (!rows.length) {
    return <p className="px-5 py-4 text-sm text-slate-500">No charges are set up for this service at {centre.name} yet.</p>;
  }
  const anyDept = rows.some(r => r.department_charge > 0);
  const allZero = rows.every(r => r.total === 0);

  return (
    <>
      {allZero && (
        <div className="mx-5 mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <FiAlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          Every charge is ₹0 here. Check this centre's settings in Service Management.
        </div>
      )}
      <div className="overflow-x-auto px-5 py-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4 text-right">Service charge</th>
              {anyDept && <th className="py-2 pr-4 text-right">Department fee</th>}
              {anyDept && <th className="py-2 text-right">Total</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(r => (
              <tr key={r.id}>
                <td className="py-2.5 pr-4 font-medium text-slate-800">{r.name}</td>
                <td className="py-2.5 pr-4 text-right font-semibold text-slate-900">{rupees(r.service_charge)}</td>
                {anyDept && <td className="py-2.5 pr-4 text-right text-slate-600">{rupees(r.department_charge)}</td>}
                {anyDept && <td className="py-2.5 text-right font-bold text-emerald-700">{rupees(r.total)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {!anyDept && <p className="mt-2 text-[11px] text-slate-400">No department fee for this service.</p>}
      </div>
    </>
  );
};

// Superadmin "All centres": one row per type, one column per centre
const AllCentresTable = ({ centres }) => {
  const enabled = centres.filter(c => c.enabled);
  const rowNames = useMemo(() => {
    const names = [];
    enabled.forEach(c => rowsFor(c).forEach(r => { if (!names.includes(r.name)) names.push(r.name); }));
    return names;
  }, [centres]);

  if (!enabled.length) return <p className="px-5 py-4 text-sm text-slate-500">This service isn't enabled at any centre.</p>;

  return (
    <div className="overflow-x-auto px-5 py-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <th className="py-2 pr-4">Type</th>
            {enabled.map(c => <th key={c.id} className="whitespace-nowrap py-2 pr-4 text-right">{c.name.replace(/^Akshaya e Centre\s*/i, '')}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rowNames.map(name => (
            <tr key={name}>
              <td className="py-2.5 pr-4 font-medium text-slate-800">{name}</td>
              {enabled.map(c => {
                const r = rowsFor(c).find(x => x.name === name);
                if (!r) return <td key={c.id} className="py-2.5 pr-4 text-right text-slate-300">—</td>;
                return (
                  <td key={c.id} className={`py-2.5 pr-4 text-right font-semibold ${r.total === 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                    {rupees(r.total)}
                    {r.department_charge > 0 && <div className="text-[10px] font-normal text-slate-400">incl. {rupees(r.department_charge)} dept</div>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-slate-400">
        Totals per centre. <span className="text-amber-600">₹0</span> usually means the charge hasn't been set yet.
        {centres.length > enabled.length && ` Not enabled at: ${centres.filter(c => !c.enabled).map(c => c.name.replace(/^Akshaya e Centre\s*/i, '')).join(', ')}.`}
      </p>
    </div>
  );
};

const ChargesCard = ({ serviceId }) => {
  const isSuperadmin = localStorage.getItem('role') === 'superadmin';
  const [centreId, setCentreId] = useState(''); // superadmin: '' = all centres
  const [data, setData] = useState(null);
  const [centreOptions, setCentreOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchServiceCharges(serviceId, isSuperadmin && centreId ? centreId : null);
        if (cancelled) return;
        setData(res);
        if (res.mode === 'all') setCentreOptions(res.centres.map(c => ({ id: c.id, name: c.name })));
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'Could not load charges.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [serviceId, centreId]);

  const single = data?.mode === 'single' ? data.centres[0] : null;

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-emerald-100 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 bg-emerald-50/50 px-5 py-3">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 text-left">
          <FiCreditCard className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-bold text-slate-900">
            {isSuperadmin ? 'Charges by centre' : `Charges at ${single?.name?.replace(/^Akshaya e Centre\s*/i, '') || 'your centre'}`}
          </span>
          <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Live</span>
          <FiChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {isSuperadmin && (
          <select
            value={centreId}
            onChange={e => setCentreId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none"
          >
            <option value="">All centres</option>
            {centreOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {open && (
        loading ? (
          <div className="flex justify-center py-6"><FiLoader className="h-5 w-5 animate-spin text-emerald-500" /></div>
        ) : error ? (
          <p className="px-5 py-4 text-sm text-rose-600">{error}</p>
        ) : data?.mode === 'all' ? (
          <AllCentresTable centres={data.centres} />
        ) : single ? (
          <SingleCentreTable centre={single} />
        ) : null
      )}

      {open && !loading && !error && (
        <p className="border-t border-slate-100 px-5 py-2 text-[11px] text-slate-400">
          From Service Management. Changes there show here straight away.
        </p>
      )}
    </div>
  );
};

export default ChargesCard;