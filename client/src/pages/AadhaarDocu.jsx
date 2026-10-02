// src/pages/AadhaarDocu.jsx
// Public page: akshayasahayi.com/aadhaar_docufinder
// Styled after StaffDashboard.jsx (welcome banner, stat cards, tabbed workspace card).
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import {
  FiShield, FiFileText, FiSearch, FiCheckCircle, FiAlertCircle, FiXCircle, FiCopy,
  FiPrinter, FiArrowRight, FiInfo, FiUser, FiRefreshCw, FiBookOpen, FiExternalLink,
  FiTarget, FiUsers, FiClock, FiLayers, FiList, FiPlayCircle,
} from 'react-icons/fi';
import {
  CHANGE_TYPES, AGE_GROUPS, NAME_REASONS, DOB_STATUSES, DOB_RESIDENT_TYPES,
  DOC_UPDATE_TYPES, DOC_RESIDENT_TYPES, DOC_CATEGORIES,
  findProcedure, findDocuments, detectNameScenario,
} from '../utils/aadhaarLogic';

// ---------------------------------------------------------------------
// Shared UI (same look as the dashboard)
// ---------------------------------------------------------------------
const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300 p-5"
  >
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium text-gray-600 mb-1 text-sm">{title}</p>
        <p className="font-bold text-gray-900 text-2xl truncate" title={String(value)}>{value}</p>
        {subtitle && <p className="text-gray-500 text-sm mt-1 truncate">{subtitle}</p>}
      </div>
      <div className={`rounded-xl ${color} p-3 shrink-0`}>
        <Icon className="text-white h-6 w-6" />
      </div>
    </div>
  </motion.div>
);

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2.5 bg-white text-gray-900 placeholder-gray-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
    {children}
    {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
  </div>
);

const Select = ({ value, onChange, options, placeholder = 'Select...' }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
    <option value="">{placeholder}</option>
    {options.map((o) => {
      const v = typeof o === 'string' ? o : o.value;
      const l = typeof o === 'string' ? o : o.label;
      return <option key={v} value={v}>{l}</option>;
    })}
  </select>
);

const Toggle = ({ value, onChange, options }) => (
  <div className="bg-gray-100 p-1 rounded-lg flex w-full">
    {options.map((o) => (
      <button
        key={o}
        type="button"
        onClick={() => onChange(o)}
        className={`flex-1 px-3 py-1.5 text-sm font-bold rounded-md transition-all ${
          value === o ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        {o}
      </button>
    ))}
  </div>
);

const Divider = ({ icon: Icon = FiList, children }) => (
  <div className="flex items-center gap-2 mb-3 pl-1">
    <Icon className="h-4 w-4 text-indigo-500" />
    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">{children}</h3>
    <div className="h-px bg-gray-200 flex-1 ml-2" />
  </div>
);

const Empty = ({ icon: Icon, text, sub }) => (
  <div className="text-center py-16 text-gray-400">
    <Icon className="mx-auto h-12 w-12 mb-3 opacity-30" />
    <p className="font-medium">{text}</p>
    {sub && <p className="text-sm mt-1">{sub}</p>}
  </div>
);

// Same left-border banner idea as the dashboard's attendance banner
const StatusBanner = ({ check, blocked }) => {
  let cls = 'bg-emerald-50 border-emerald-500 text-emerald-800';
  let Icon = FiCheckCircle;
  let text = 'PROCEED - follow the requirements below.';
  if (check !== 'OK') { cls = 'bg-amber-50 border-amber-500 text-amber-800'; Icon = FiAlertCircle; text = check; }
  else if (blocked) { cls = 'bg-rose-50 border-rose-500 text-rose-800'; Icon = FiXCircle; text = 'BLOCKED - this request is not permitted. See the exceptions below.'; }
  return (
    <div className={`border-l-4 rounded-r-xl shadow-sm px-4 py-3 flex items-start gap-3 ${cls}`}>
      <Icon className="h-5 w-5 mt-0.5 shrink-0" />
      <p className="text-sm font-semibold">{text}</p>
    </div>
  );
};

const TONES = {
  plain: { box: 'bg-white border-gray-200', icon: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  note: { box: 'bg-blue-50 border-blue-100', icon: 'bg-white text-blue-700 border-blue-100' },
  warn: { box: 'bg-amber-50 border-amber-200', icon: 'bg-white text-amber-700 border-amber-200' },
  danger: { box: 'bg-rose-50 border-rose-200', icon: 'bg-white text-rose-700 border-rose-200' },
};

const InfoCard = ({ label, icon: Icon = FiInfo, tone = 'plain', children }) => {
  if (!children) return null;
  const t = TONES[tone];
  return (
    <div className={`flex gap-3 p-4 border rounded-xl hover:shadow-md transition-all ${t.box}`}>
      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${t.icon}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">{label}</p>
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line break-words">{children}</p>
      </div>
    </div>
  );
};

const PROOF_CHIPS = [
  { key: 'poi', label: 'PoI', cls: 'bg-blue-100 text-blue-800' },
  { key: 'poa', label: 'PoA', cls: 'bg-green-100 text-green-800' },
  { key: 'por', label: 'PoR', cls: 'bg-purple-100 text-purple-800' },
  { key: 'pdb', label: 'PDB', cls: 'bg-amber-100 text-amber-800' },
];

const DocRow = ({ doc, route }) => (
  <div className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-indigo-300 transition-all">
    <div className={`min-w-[2.5rem] h-10 px-2 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border ${
      route === 'hof' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'
    }`}>
      {doc.sl}
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-1.5 mb-1">
        {PROOF_CHIPS.filter((c) => doc[c.key]).map((c) => (
          <span key={c.key} className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${c.cls}`}>{c.label}</span>
        ))}
        {route === 'hof' && (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-800 text-white">HoF route</span>
        )}
      </div>
      <h4 className="font-bold text-gray-900 text-sm leading-snug">{doc.name}</h4>
      {doc.displayNote && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{doc.displayNote}</p>}
    </div>
  </div>
);

// Clock lives in its own component so the page does not re-render every tick
const Clock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="md:text-right">
      <p className="text-3xl font-light tracking-tight">
        {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
      </p>
      <p className="text-white/80 text-sm mt-1">
        {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------
// Initial form state
// ---------------------------------------------------------------------
const emptyName = { oldName: '', newName: '', reasonId: '', ageGroup: '', overrideCode: '' };
const emptyDob = { oldDob: '', enrolDate: '', newDob: '', dobStatus: '', prevUpdates: '0', residentType: '', operatorError: '' };
const emptyDoc = { updateType: '', residentType: '', category: '', dobStatus: '' };
const NAME_CODES = ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)', '(g)', '(h)', '(i)', '(j)', '(k)', '(l)', '(m)', '(n)', '(o)'];

// ---------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------
const AadhaarDocu = () => {
  const [tab, setTab] = useState('procedure');
  const [mode, setMode] = useState(CHANGE_TYPES[0]);
  const [nameForm, setNameForm] = useState(emptyName);
  const [dobForm, setDobForm] = useState(emptyDob);
  const [docForm, setDocForm] = useState(emptyDoc);
  const [query, setQuery] = useState('');
  const [routeView, setRouteView] = useState('all');

  useEffect(() => {
    const prev = document.title;
    document.title = 'Aadhaar Docu Finder | Akshaya e-Centre Pukayur';
    return () => { document.title = prev; };
  }, []);

  const isName = mode === CHANGE_TYPES[0];
  const procForm = isName ? nameForm : dobForm;
  const proc = useMemo(() => findProcedure(mode, procForm), [mode, procForm]);
  const docRes = useMemo(() => findDocuments(docForm), [docForm]);

  const procTouched = isName
    ? Boolean(nameForm.oldName || nameForm.newName)
    : Boolean(dobForm.oldDob || dobForm.enrolDate || dobForm.newDob);
  const docTouched = Boolean(docForm.updateType || docForm.residentType || docForm.category);

  const setN = (k) => (v) => setNameForm((f) => ({ ...f, [k]: v }));
  const setD = (k) => (v) => setDobForm((f) => ({ ...f, [k]: v }));
  const setC = (k) => (v) => setDocForm((f) => ({ ...f, [k]: v }));
  const autoCode = isName && nameForm.reasonId ? detectNameScenario(nameForm) : '';

  // ----- actions -----
  const goToDocuments = (preset) => {
    setDocForm({ ...emptyDoc, ...preset });
    setQuery('');
    setRouteView('all');
    setTab('documents');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openDocsFromProcedure = () => {
    if (isName) {
      goToDocuments({
        updateType: 'Name',
        residentType: 'Indian resident',
        category: nameForm.ageGroup === AGE_GROUPS[1] ? DOC_CATEGORIES[1] : DOC_CATEGORIES[0],
      });
    } else {
      goToDocuments({
        updateType: 'Date of Birth',
        residentType: ['Indian resident', 'NRI'].includes(dobForm.residentType) ? dobForm.residentType : '',
        category: proc.isMinor ? DOC_CATEGORIES[1] : DOC_CATEGORIES[0],
        dobStatus: dobForm.dobStatus,
      });
    }
  };

  const loadExample = () => {
    if (tab === 'procedure') {
      if (isName) setNameForm({ oldName: 'R.V.N Srinivas', newName: 'RVN Srinivas', reasonId: 'spelling', ageGroup: AGE_GROUPS[0], overrideCode: '' });
      else setDobForm({ oldDob: '2012-05-12', enrolDate: '2014-01-15', newDob: '2011-09-03', dobStatus: DOB_STATUSES[0], prevUpdates: '0', residentType: 'Indian resident', operatorError: 'No' });
    } else {
      setDocForm({ updateType: 'Address', residentType: 'Indian resident', category: DOC_CATEGORIES[0], dobStatus: '' });
    }
  };

  const clearAll = () => {
    if (tab === 'procedure') {
      if (isName) setNameForm(emptyName); else setDobForm(emptyDob);
    } else {
      setDocForm(emptyDoc); setQuery(''); setRouteView('all');
    }
  };

  const summaryText = () => {
    const s = proc.scenario;
    if (!s) return '';
    return [
      `Aadhaar ${mode} - scenario ${proc.code}`,
      s.description && `Scenario: ${s.description}`,
      `Documents required: ${s.documents}`,
      `Affidavit / annexure: ${s.annexure}`,
      proc.note && `Note: ${proc.note}`,
      `Exceptions and conditions: ${s.exceptions}`,
      s.source && `Source: ${s.source}`,
    ].filter(Boolean).join('\n');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText());
      toast.success('Procedure copied');
    } catch {
      toast.error('Could not copy. Please select the text manually.');
    }
  };

  // ----- stat cards -----
  const procStatus = !procTouched
    ? { v: '—', c: 'bg-gray-600', i: FiClock }
    : proc.check !== 'OK'
      ? { v: 'Check input', c: 'bg-amber-500', i: FiAlertCircle }
      : proc.scenario?.blocked
        ? { v: 'Blocked', c: 'bg-rose-500', i: FiXCircle }
        : { v: 'Proceed', c: 'bg-green-500', i: FiCheckCircle };
  const annexureShort = proc.scenario && !proc.scenario.annexure.startsWith('None') ? proc.scenario.annexure : 'None';

  const proofShort = { Name: 'PoI', Address: 'PoA', 'Date of Birth': 'PDB' }[docForm.updateType] || '—';
  const docOk = docTouched && docRes.check === 'OK';
  const docTotal = docOk ? docRes.standard.length + docRes.hof.length : 0;

  // ----- documents tab filtering -----
  const q = query.trim().toLowerCase();
  const match = (d) => !q || d.name.toLowerCase().includes(q) || (d.displayNote || '').toLowerCase().includes(q);
  const stdList = docOk ? docRes.standard.filter(match) : [];
  const hofList = docOk ? docRes.hof.filter(match) : [];

  const tabCls = (active, color) =>
    `flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
      active ? `bg-white ${color} shadow-sm border border-gray-200` : 'text-gray-500 hover:bg-white/60 hover:text-gray-700'
    }`;

  // ---------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ===== WELCOME BANNER ===== */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white px-6 py-6 print:hidden">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-start gap-4 mb-3">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <FiShield className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Aadhaar Docu Finder</h2>
                  <p className="text-white/80 text-lg mt-0.5">
                    Exact procedure and acceptable documents for Aadhaar updates.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-white/90 mt-2 mb-6">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 bg-green-400 rounded-full" />
                  <span>Based on UIDAI SoPs</span>
                </div>
                <Link to="/" className="underline hover:text-white/80">Back to home</Link>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-white/70 mb-2 font-semibold">Quick Actions</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setTab('procedure'); setMode(CHANGE_TYPES[0]); }}
                    className="px-4 py-2 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition"
                  >
                    Name change
                  </button>
                  <button
                    onClick={() => { setTab('procedure'); setMode(CHANGE_TYPES[1]); }}
                    className="px-4 py-2 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition"
                  >
                    DOB change
                  </button>
                  <button
                    onClick={() => goToDocuments({ updateType: 'Address', residentType: 'Indian resident', category: DOC_CATEGORIES[0] })}
                    className="px-4 py-2 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition"
                  >
                    Address documents
                  </button>
                </div>
              </div>
            </div>
            <Clock />
          </div>
          <div className="mt-5 pt-5 border-t border-white/20 text-sm text-white/70 italic">
            Source: UIDAI Name and DOB update SoPs and the List of Acceptable Documents (List IV - update). Always confirm with the latest UIDAI circular before submitting a request.
          </div>
        </div>
      </div>

      {/* ===== BODY ===== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Overview metrics */}
        <div className="flex items-center justify-between mb-4 print:hidden">
          <h3 className="text-lg font-bold text-gray-900">Overview Metrics</h3>
          <span className="text-xs font-medium text-gray-500">Updates live as you type</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-8 print:hidden">
          {tab === 'procedure' ? (
            <>
              <StatCard title="Scenario" value={proc.code || '—'} icon={FiTarget} color="bg-indigo-500" subtitle={proc.scenario?.category} />
              <StatCard title="Status" value={procStatus.v} icon={procStatus.i} color={procStatus.c} />
              <StatCard
                title="Applicant"
                value={proc.isMinor === undefined ? '—' : proc.isMinor ? 'Minor' : 'Adult'}
                icon={FiUser}
                color="bg-blue-500"
                subtitle={proc.currentAge != null ? `Current age ${proc.currentAge}` : undefined}
              />
              <StatCard title="Annexure" value={proc.scenario ? annexureShort : '—'} icon={FiFileText} color="bg-purple-500" />
              <StatCard title="Change type" value={isName ? 'Name' : 'DOB'} icon={FiLayers} color="bg-gray-600" />
            </>
          ) : (
            <>
              <StatCard title="Documents found" value={docOk ? docTotal : '—'} icon={FiFileText} color="bg-indigo-500" />
              <StatCard title="Standard route" value={docOk ? docRes.standard.length : '—'} icon={FiCheckCircle} color="bg-green-500" />
              <StatCard title="HoF route" value={docOk ? docRes.hof.length : '—'} icon={FiUsers} color="bg-purple-500" />
              <StatCard title="Proof type" value={proofShort} icon={FiTarget} color="bg-blue-500" subtitle={docForm.category || undefined} />
              <StatCard
                title="Status"
                value={!docTouched ? '—' : docRes.check === 'OK' ? 'Ready' : 'Check input'}
                icon={!docTouched ? FiClock : docRes.check === 'OK' ? FiCheckCircle : FiAlertCircle}
                color={!docTouched ? 'bg-gray-600' : docRes.check === 'OK' ? 'bg-green-500' : 'bg-amber-500'}
              />
            </>
          )}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          {/* ---------- Right column (form) - shown first on small screens ---------- */}
          <div className="order-1 xl:order-2 flex flex-col gap-6 xl:sticky xl:top-4 print:hidden">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {tab === 'procedure' ? 'Enter details' : 'Select the details'}
              </h3>

              {tab === 'procedure' ? (
                <div className="space-y-4">
                  <Toggle value={mode} onChange={setMode} options={CHANGE_TYPES} />
                  {isName ? (
                    <>
                      <Field label="Name currently in Aadhaar (old)" hint="Exactly as printed, including dots and capitals.">
                        <input className={inputCls} value={nameForm.oldName} onChange={(e) => setN('oldName')(e.target.value)} placeholder="e.g. R.V.N Srinivas" />
                      </Field>
                      <Field label="Required name (new)">
                        <input className={inputCls} value={nameForm.newName} onChange={(e) => setN('newName')(e.target.value)} placeholder="e.g. RVN Srinivas" />
                      </Field>
                      <Field
                        label="Reason for change"
                        hint="First name: pick 'First name correction' for a spelling / phonetic fix, or 'First name change' for a different name. Use 'Spelling / format correction' for anything else."
                      >
                        <Select value={nameForm.reasonId} onChange={setN('reasonId')} options={NAME_REASONS.map((r) => ({ value: r.id, label: r.label }))} />
                      </Field>
                      <Field label="Applicant age group">
                        <Select value={nameForm.ageGroup} onChange={setN('ageGroup')} options={AGE_GROUPS} />
                      </Field>
                      <Field label="Override detected type (optional)" hint="Leave blank to use the auto-detected code. Use it to force (a) abbreviation or (d) phonetic spelling.">
                        <Select value={nameForm.overrideCode} onChange={setN('overrideCode')} options={NAME_CODES} placeholder="Auto-detect" />
                      </Field>
                      {autoCode && (
                        <p className="text-sm text-gray-600">
                          Detected scenario: <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs font-bold">{autoCode}</span>
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <Field label="Old DOB (as recorded in Aadhaar)">
                        <input type="date" className={inputCls} value={dobForm.oldDob} onChange={(e) => setD('oldDob')(e.target.value)} />
                      </Field>
                      <Field label="Initial enrollment date">
                        <input type="date" className={inputCls} value={dobForm.enrolDate} onChange={(e) => setD('enrolDate')(e.target.value)} />
                      </Field>
                      <Field label="Required (new) DOB">
                        <input type="date" className={inputCls} value={dobForm.newDob} onChange={(e) => setD('newDob')(e.target.value)} />
                      </Field>
                      <Field label="DOB status in Aadhaar" hint="'Declared / Approximate' if no document was used; otherwise the type of document that verified it.">
                        <Select value={dobForm.dobStatus} onChange={setD('dobStatus')} options={DOB_STATUSES} />
                      </Field>
                      <Field label="Previous DOB updates since enrollment" hint="Enter 0 if this would be the first DOB update.">
                        <input type="number" min="0" max="20" className={inputCls} value={dobForm.prevUpdates} onChange={(e) => setD('prevUpdates')(e.target.value)} />
                      </Field>
                      <Field label="Resident type">
                        <Select value={dobForm.residentType} onChange={setD('residentType')} options={DOB_RESIDENT_TYPES} />
                      </Field>
                      <Field label="Operator error alleged?" hint="Yes = the applicant says the enrolment operator recorded the DOB wrongly.">
                        <Toggle value={dobForm.operatorError} onChange={setD('operatorError')} options={['Yes', 'No']} />
                      </Field>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <Field label="What do you want to update?">
                    <Toggle value={docForm.updateType} onChange={setC('updateType')} options={DOC_UPDATE_TYPES} />
                  </Field>
                  <Field label="Resident type" hint="Indian resident and NRI use the main list; foreign nationals use their own passport / visa documents.">
                    <Select value={docForm.residentType} onChange={setC('residentType')} options={DOC_RESIDENT_TYPES} />
                  </Field>
                  <Field label="Applicant category" hint="Minor and adult change which route and documents apply. Special categories show their dedicated certificates.">
                    <Select value={docForm.category} onChange={setC('category')} options={DOC_CATEGORIES} />
                  </Field>
                  {docForm.updateType === 'Date of Birth' && (
                    <Field label="DOB status in Aadhaar">
                      <Select value={docForm.dobStatus} onChange={setC('dobStatus')} options={DOB_STATUSES} />
                    </Field>
                  )}
                </div>
              )}

              <div className="mt-6 flex items-center justify-between">
                <button type="button" onClick={loadExample} className="text-sm font-semibold text-blue-700 hover:text-blue-900">
                  Try an example
                </button>
                <button type="button" onClick={clearAll} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800">
                  <FiRefreshCw className="h-4 w-4" /> Clear
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <FiInfo className="h-4 w-4 text-indigo-500" /> About this tool
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                This tool summarises the UIDAI documents it was built from and may not reflect later circulars. Where a field says
                "Not specified in the source sheet", the source gave no detail.
              </p>
              <div className="mt-3 space-y-2">
                <a href="https://uidai.gov.in/images/SOP_for_DOB_update.pdf" target="_blank" rel="noreferrer"
                   className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:border-indigo-300 hover:text-indigo-700 transition-all">
                  DOB update SoP <FiExternalLink className="h-3.5 w-3.5" />
                </a>
                <a href="https://uidai.gov.in/images/SOP_28.10.2021-Name_And_Gender_UpdateRequest_under_Exception_Handling_Process.pdf" target="_blank" rel="noreferrer"
                   className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:border-indigo-300 hover:text-indigo-700 transition-all">
                  Name &amp; Gender SoP <FiExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* ---------- Left column (workspace) ---------- */}
          <div className="order-2 xl:order-1 xl:col-span-2 flex flex-col gap-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col xl:h-[860px] print:h-auto">
              {/* Workspace tabs */}
              <div className="flex p-3 border-b border-gray-200 bg-gray-50/80 gap-2 overflow-x-auto print:hidden">
                <button onClick={() => setTab('procedure')} className={tabCls(tab === 'procedure', 'text-indigo-700')}>
                  <FiTarget className="h-4 w-4" />
                  Procedure Finder
                  <span className={`px-2 py-0.5 rounded-full text-xs ${tab === 'procedure' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'}`}>
                    {proc.code || '—'}
                  </span>
                </button>
                <button onClick={() => setTab('documents')} className={tabCls(tab === 'documents', 'text-blue-700')}>
                  <FiFileText className="h-4 w-4" />
                  Documents Finder
                  <span className={`px-2 py-0.5 rounded-full text-xs ${tab === 'documents' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                    {docOk ? docTotal : '—'}
                  </span>
                </button>
              </div>

              {/* Workspace content */}
              <div className="flex-1 overflow-y-auto bg-gray-50/30 p-4 sm:p-6">
                <AnimatePresence mode="wait">
                  {tab === 'procedure' ? (
                    <motion.div key="procedure" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-4">
                      {!procTouched ? (
                        <Empty icon={FiPlayCircle} text="Fill in the details to see the exact procedure" sub='Or press "Try an example" to see how it works.' />
                      ) : (
                        <>
                          <StatusBanner check={proc.check} blocked={proc.scenario?.blocked} />
                          {proc.scenario && (
                            <>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800">
                                  Scenario {proc.code}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700">
                                  {proc.scenario.category}
                                </span>
                              </div>

                              <Divider icon={FiList}>Procedure details</Divider>
                              <div className="grid grid-cols-1 gap-3">
                                <InfoCard label="Scenario" icon={FiTarget}>{proc.scenario.description}</InfoCard>
                                <InfoCard label="Applies to" icon={FiUsers}>{proc.scenario.appliesTo}</InfoCard>
                                <InfoCard label="Documents required" icon={FiFileText} tone="note">{proc.scenario.documents}</InfoCard>
                                <InfoCard label="Affidavit / annexure to use" icon={FiLayers}>{proc.scenario.annexure}</InfoCard>
                                <InfoCard label="Note for this applicant" icon={FiAlertCircle} tone="warn">{proc.note}</InfoCard>
                                <InfoCard label="Exceptions and conditions" icon={FiInfo} tone={proc.scenario.blocked ? 'danger' : 'plain'}>{proc.scenario.exceptions}</InfoCard>
                                <InfoCard label="Examples from the source" icon={FiBookOpen}>{proc.scenario.examples}</InfoCard>
                              </div>

                              <p className="text-xs text-gray-500 flex items-start gap-1.5 pl-1">
                                <FiBookOpen className="h-4 w-4 mt-0.5 shrink-0" /> Source: {proc.scenario.source}
                              </p>

                              <div className="flex flex-wrap gap-2 pt-1 print:hidden">
                                {!proc.scenario.blocked && (
                                  <button type="button" onClick={openDocsFromProcedure}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-all font-semibold text-sm shadow-sm">
                                    See acceptable documents <FiArrowRight className="h-4 w-4" />
                                  </button>
                                )}
                                <button type="button" onClick={copy}
                                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-semibold text-sm">
                                  <FiCopy className="h-4 w-4" /> Copy
                                </button>
                                <button type="button" onClick={() => window.print()}
                                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-semibold text-sm">
                                  <FiPrinter className="h-4 w-4" /> Print
                                </button>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div key="documents" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="space-y-4">
                      {!docTouched ? (
                        <Empty icon={FiFileText} text="Choose what you want to update to see the documents" sub='Or press "Try an example" to see how it works.' />
                      ) : docRes.check !== 'OK' ? (
                        <StatusBanner check={docRes.check} />
                      ) : (
                        <>
                          <div className="flex gap-3 p-4 border rounded-xl bg-blue-50 border-blue-100">
                            <div className="w-9 h-9 rounded-lg border bg-white text-blue-700 border-blue-100 flex items-center justify-center shrink-0">
                              <FiTarget className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">Proof type needed</p>
                              <p className="text-sm font-semibold text-blue-900">{docRes.proofNeeded}</p>
                            </div>
                          </div>

                          {/* Search + route pills (same pattern as the dashboard filter bar) */}
                          <div className="flex flex-wrap gap-3 items-center print:hidden">
                            <div className="relative flex-1 min-w-[220px]">
                              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search these documents (e.g. bill, passport)..."
                                className="pl-10 pr-4 py-2.5 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                              />
                            </div>
                            <div className="flex gap-2">
                              {[
                                ['all', 'All'],
                                ['std', 'Standard'],
                                ...(docRes.hof.length ? [['hof', 'HoF route']] : []),
                              ].map(([id, label]) => (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => setRouteView(id)}
                                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                                    routeView === id ? 'bg-gray-800 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {routeView !== 'hof' && (
                            <div>
                              <Divider icon={FiCheckCircle}>Standard route ({stdList.length})</Divider>
                              {stdList.length === 0 ? (
                                <p className="text-sm text-gray-500 pl-1">No matching documents in the source list for this combination.</p>
                              ) : (
                                <div className="grid grid-cols-1 gap-3">
                                  {stdList.map((d) => <DocRow key={d.sl} doc={d} route="std" />)}
                                </div>
                              )}
                            </div>
                          )}

                          {routeView !== 'std' && docRes.hof.length > 0 && (
                            <div>
                              <Divider icon={FiUsers}>HoF-based route ({hofList.length})</Divider>
                              <p className="text-xs text-gray-500 mb-3 pl-1">Relationship proof via the Head of Family.</p>
                              <div className="grid grid-cols-1 gap-3">
                                {hofList.map((d) => <DocRow key={`h-${d.sl}`} doc={d} route="hof" />)}
                              </div>
                            </div>
                          )}

                          <div>
                            <Divider icon={FiInfo}>Rules and conditions</Divider>
                            <div className="grid grid-cols-1 gap-3">
                              {docRes.notes.map((n, i) => (
                                <InfoCard key={n.label} label={n.label} icon={i === 0 ? FiTarget : FiInfo} tone={i === 0 ? 'note' : 'plain'}>{n.text}</InfoCard>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AadhaarDocu;