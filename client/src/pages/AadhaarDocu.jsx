// src/pages/AadhaarDocuFinder.jsx
// Public page: akshayasahayi.com/aadhaar_docufinder
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiShield, FiFileText, FiSearch, FiCheckCircle, FiAlertTriangle, FiXCircle,
  FiCopy, FiPrinter, FiArrowRight, FiInfo, FiUser, FiCalendar, FiMapPin,
  FiRefreshCw, FiHome, FiBookOpen, FiExternalLink, FiUsers,
} from 'react-icons/fi';
import {
  CHANGE_TYPES, AGE_GROUPS, NAME_REASONS, DOB_STATUSES, DOB_RESIDENT_TYPES,
  DOC_UPDATE_TYPES, DOC_RESIDENT_TYPES, DOC_CATEGORIES,
  findProcedure, findDocuments, detectNameScenario, getScenario,
} from '../utils/aadhaar/Aadhaarlogic.js';

// ---------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------
const inputCls =
  'w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition-all';

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

const Segmented = ({ value, onChange, options }) => (
  <div className="inline-flex w-full bg-gray-100 rounded-xl p-1">
    {options.map((o) => (
      <button
        key={o}
        type="button"
        onClick={() => onChange(o)}
        className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
          value === o ? 'bg-white text-navy-700 shadow' : 'text-gray-600 hover:text-navy-700'
        }`}
      >
        {o}
      </button>
    ))}
  </div>
);

const Card = ({ title, icon: Icon, children, className = '' }) => (
  <div className={`bg-white rounded-2xl shadow-lg border border-gray-100 p-6 ${className}`}>
    {title && (
      <div className="flex items-center mb-5">
        {Icon && (
          <div className="w-10 h-10 bg-gradient-to-br from-navy-600 to-navy-800 rounded-xl flex items-center justify-center mr-3">
            <Icon className="h-5 w-5 text-white" />
          </div>
        )}
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      </div>
    )}
    {children}
  </div>
);

const StatusBanner = ({ check, blocked }) => {
  if (check !== 'OK') {
    return (
      <div className="flex items-start p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
        <FiAlertTriangle className="h-5 w-5 mt-0.5 mr-3 flex-shrink-0" />
        <p className="font-medium text-sm">{check}</p>
      </div>
    );
  }
  if (blocked) {
    return (
      <div className="flex items-start p-4 rounded-xl bg-red-600 text-white">
        <FiXCircle className="h-5 w-5 mt-0.5 mr-3 flex-shrink-0" />
        <p className="font-semibold">BLOCKED - this request is not permitted. See the exceptions below.</p>
      </div>
    );
  }
  return (
    <div className="flex items-start p-4 rounded-xl bg-green-50 border border-green-200 text-green-800">
      <FiCheckCircle className="h-5 w-5 mt-0.5 mr-3 flex-shrink-0" />
      <p className="font-semibold">PROCEED - follow the requirements below.</p>
    </div>
  );
};

const Section = ({ label, children, tone = 'plain' }) => {
  if (!children) return null;
  const tones = {
    plain: 'bg-gray-50 border-gray-100',
    note: 'bg-navy-50 border-navy-100',
    warn: 'bg-amber-50 border-amber-200',
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">{label}</p>
      <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-line">{children}</p>
    </div>
  );
};

// ---------------------------------------------------------------------
// Procedure finder (name / DOB)
// ---------------------------------------------------------------------
const emptyName = { oldName: '', newName: '', reasonId: '', ageGroup: '', overrideCode: '' };
const emptyDob = {
  oldDob: '', enrolDate: '', newDob: '', dobStatus: '', prevUpdates: '0',
  residentType: '', operatorError: '',
};

const ProcedureFinder = ({ onOpenDocuments }) => {
  const [mode, setMode] = useState(CHANGE_TYPES[0]);
  const [nameForm, setNameForm] = useState(emptyName);
  const [dobForm, setDobForm] = useState(emptyDob);
  const isName = mode === CHANGE_TYPES[0];
  const form = isName ? nameForm : dobForm;

  const setN = (k) => (v) => setNameForm((f) => ({ ...f, [k]: v }));
  const setD = (k) => (v) => setDobForm((f) => ({ ...f, [k]: v }));

  const result = useMemo(() => findProcedure(mode, form), [mode, form]);
  const touched = isName
    ? nameForm.oldName || nameForm.newName
    : dobForm.oldDob || dobForm.enrolDate || dobForm.newDob;

  const nameCodes = useMemo(
    () => ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)', '(g)', '(h)', '(i)', '(j)', '(k)', '(l)', '(m)', '(n)', '(o)'],
    []
  );
  const autoCode = isName && nameForm.reasonId ? detectNameScenario(nameForm) : '';

  const loadExample = () => {
    if (isName) {
      setNameForm({ oldName: 'R.V.N Srinivas', newName: 'RVN Srinivas', reasonId: 'spelling', ageGroup: AGE_GROUPS[0], overrideCode: '' });
    } else {
      setDobForm({ oldDob: '2012-05-12', enrolDate: '2014-01-15', newDob: '2011-09-03', dobStatus: DOB_STATUSES[0],
        prevUpdates: '0', residentType: 'Indian resident', operatorError: 'No' });
    }
  };

  const summaryText = () => {
    const s = result.scenario;
    if (!s) return '';
    return [
      `Aadhaar ${mode} - scenario ${result.code}`,
      s.description && `Scenario: ${s.description}`,
      `Documents required: ${s.documents}`,
      `Affidavit / annexure: ${s.annexure}`,
      result.note && `Note: ${result.note}`,
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

  const openDocs = () => {
    if (isName) {
      onOpenDocuments({
        updateType: 'Name',
        residentType: 'Indian resident',
        category: nameForm.ageGroup === AGE_GROUPS[1] ? DOC_CATEGORIES[1] : DOC_CATEGORIES[0],
        dobStatus: '',
      });
    } else {
      onOpenDocuments({
        updateType: 'Date of Birth',
        residentType: dobForm.residentType === 'NRI' ? 'NRI' : dobForm.residentType === 'Indian resident' ? 'Indian resident' : '',
        category: result.isMinor ? DOC_CATEGORIES[1] : DOC_CATEGORIES[0],
        dobStatus: dobForm.dobStatus,
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Inputs */}
      <div className="lg:col-span-2">
        <Card title="What do you want to change?" icon={FiUser}>
          <Segmented value={mode} onChange={setMode} options={CHANGE_TYPES} />

          <div className="mt-5 space-y-4">
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
                  <Select value={nameForm.overrideCode} onChange={setN('overrideCode')} options={nameCodes} placeholder="Auto-detect" />
                </Field>
                {autoCode && (
                  <p className="text-sm text-gray-600">
                    Detected scenario: <span className="font-bold text-navy-700">{autoCode}</span>
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
                  <Segmented value={dobForm.operatorError} onChange={setD('operatorError')} options={['Yes', 'No']} />
                </Field>
              </>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button type="button" onClick={loadExample} className="text-sm font-medium text-navy-600 hover:text-navy-800">
              Try an example
            </button>
            <button
              type="button"
              onClick={() => (isName ? setNameForm(emptyName) : setDobForm(emptyDob))}
              className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-800"
            >
              <FiRefreshCw className="h-4 w-4 mr-1.5" /> Clear
            </button>
          </div>
        </Card>
      </div>

      {/* Result */}
      <div className="lg:col-span-3">
        <Card title="Procedure" icon={FiFileText} className="lg:sticky lg:top-24">
          {!touched ? (
            <div className="text-center py-12 text-gray-500">
              <FiSearch className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Fill in the details to see the exact procedure.</p>
              <p className="text-sm mt-1">Or press "Try an example" to see how it works.</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${mode}-${result.code}-${result.check}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                <StatusBanner check={result.check} blocked={result.scenario?.blocked} />

                {result.scenario && (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-navy-100 text-navy-700 text-sm font-bold">
                        Scenario {result.code}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                        {result.scenario.category}
                      </span>
                    </div>
                    <Section label="Scenario">{result.scenario.description}</Section>
                    <Section label="Applies to">{result.scenario.appliesTo}</Section>
                    <Section label="Documents required" tone="note">{result.scenario.documents}</Section>
                    <Section label="Affidavit / annexure to use">{result.scenario.annexure}</Section>
                    <Section label="Note for this applicant" tone="warn">{result.note}</Section>
                    <Section label="Exceptions and conditions">{result.scenario.exceptions}</Section>
                    <Section label="Examples from the source">{result.scenario.examples}</Section>
                    <p className="text-xs text-gray-500 flex items-start">
                      <FiBookOpen className="h-4 w-4 mr-1.5 mt-0.5 flex-shrink-0" />
                      Source: {result.scenario.source}
                    </p>

                    <div className="flex flex-wrap gap-3 pt-2 print:hidden">
                      {!result.scenario.blocked && (
                        <button
                          type="button"
                          onClick={openDocs}
                          className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-navy-600 to-navy-700 text-white rounded-xl hover:shadow-lg transition-all font-medium text-sm"
                        >
                          See acceptable documents <FiArrowRight className="ml-2 h-4 w-4" />
                        </button>
                      )}
                      <button type="button" onClick={copy} className="inline-flex items-center px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium text-sm">
                        <FiCopy className="mr-2 h-4 w-4" /> Copy
                      </button>
                      <button type="button" onClick={() => window.print()} className="inline-flex items-center px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium text-sm">
                        <FiPrinter className="mr-2 h-4 w-4" /> Print
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </Card>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Documents finder
// ---------------------------------------------------------------------
const DocRow = ({ doc, route }) => (
  <div className={`rounded-xl border p-4 ${route === 'hof' ? 'bg-navy-50 border-navy-100' : 'bg-white border-gray-200'}`}>
    <div className="flex items-start gap-3">
      <span className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-navy-100 text-navy-700 text-xs font-bold">
        Sl. {doc.sl}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm leading-snug">{doc.name}</p>
        {doc.displayNote && <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{doc.displayNote}</p>}
      </div>
    </div>
  </div>
);

const DocumentsFinder = ({ preset, presetKey }) => {
  const [f, setF] = useState({ updateType: '', residentType: '', category: '', dobStatus: '' });
  const [query, setQuery] = useState('');
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  // pre-fill when the user comes from the Procedure tab
  useEffect(() => {
    if (preset) setF({ updateType: '', residentType: '', category: '', dobStatus: '', ...preset });
  }, [presetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const res = useMemo(() => findDocuments(f), [f]);
  const touched = f.updateType || f.residentType || f.category;
  const q = query.trim().toLowerCase();
  const match = (d) => !q || d.name.toLowerCase().includes(q) || (d.displayNote || '').toLowerCase().includes(q);
  const std = res.standard.filter(match);
  const hof = res.hof.filter(match);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2">
        <Card title="Select the details" icon={FiUsers}>
          <div className="space-y-4">
            <Field label="What do you want to update?">
              <Segmented value={f.updateType} onChange={set('updateType')} options={DOC_UPDATE_TYPES} />
            </Field>
            <Field label="Resident type" hint="Indian resident and NRI use the main list; foreign nationals use their own passport / visa documents.">
              <Select value={f.residentType} onChange={set('residentType')} options={DOC_RESIDENT_TYPES} />
            </Field>
            <Field label="Applicant category" hint="Minor and adult change which route and documents apply. Special categories show their dedicated certificates.">
              <Select value={f.category} onChange={set('category')} options={DOC_CATEGORIES} />
            </Field>
            {f.updateType === 'Date of Birth' && (
              <Field label="DOB status in Aadhaar">
                <Select value={f.dobStatus} onChange={set('dobStatus')} options={DOB_STATUSES} />
              </Field>
            )}
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => { setF({ updateType: '', residentType: '', category: '', dobStatus: '' }); setQuery(''); }}
              className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-800"
            >
              <FiRefreshCw className="h-4 w-4 mr-1.5" /> Clear
            </button>
          </div>
        </Card>
      </div>

      <div className="lg:col-span-3">
        <Card title="Acceptable documents" icon={FiFileText}>
          {!touched ? (
            <div className="text-center py-12 text-gray-500">
              <FiSearch className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Choose what you want to update to see the documents.</p>
            </div>
          ) : res.check !== 'OK' ? (
            <StatusBanner check={res.check} />
          ) : (
            <div className="space-y-5">
              <div className="rounded-xl bg-navy-50 border border-navy-100 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Proof type needed</p>
                <p className="font-semibold text-navy-800 text-sm">{res.proofNeeded}</p>
                <p className="text-xs text-gray-600 mt-2">
                  {res.standard.length} document{res.standard.length === 1 ? '' : 's'} on the standard route
                  {res.hof.length > 0 && `, ${res.hof.length} on the HoF route`}.
                </p>
              </div>

              <div className="space-y-3">
                {res.notes.map((n) => (
                  <Section key={n.label} label={n.label}>{n.text}</Section>
                ))}
              </div>

              <div className="relative">
                <FiSearch className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                <input
                  className={`${inputCls} pl-10`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search within these documents (e.g. bill, passport)"
                />
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-3">
                  Standard route <span className="text-gray-500 font-medium text-sm">({std.length})</span>
                </h3>
                {std.length === 0 ? (
                  <p className="text-sm text-gray-500">No matching documents in the source list for this combination.</p>
                ) : (
                  <div className="space-y-2.5">
                    {std.map((d) => <DocRow key={d.sl} doc={d} route="std" />)}
                  </div>
                )}
              </div>

              {res.hof.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">
                    HoF-based route <span className="text-gray-500 font-medium text-sm">({hof.length})</span>
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">Relationship proof via the Head of Family.</p>
                  <div className="space-y-2.5">
                    {hof.map((d) => <DocRow key={`h-${d.sl}`} doc={d} route="hof" />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------
const TABS = [
  { id: 'procedure', label: 'Procedure Finder', icon: FiCalendar, blurb: 'Name or DOB change - exact procedure' },
  { id: 'documents', label: 'Documents Finder', icon: FiMapPin, blurb: 'Which documents are acceptable' },
];

const AadhaarDocuFinder = () => {
  const [tab, setTab] = useState('procedure');
  const [preset, setPreset] = useState(null);
  const [presetKey, setPresetKey] = useState(0);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Aadhaar Docu Finder | Akshaya e-Centre Pukayur';
    return () => { document.title = prev; };
  }, []);

  const openDocuments = (p) => {
    setPreset(p);
    setPresetKey((k) => k + 1);
    setTab('documents');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md shadow-md print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-navy-600 to-navy-800 rounded-xl flex items-center justify-center">
                <FiShield className="h-6 w-6 text-white" />
              </div>
              <div className="ml-3">
                <h1 className="text-xl font-bold text-navy-900 leading-tight">Akshaya</h1>
                <p className="text-xs text-navy-600">e-Centre Pukayur</p>
              </div>
            </Link>
            <div className="flex items-center space-x-3">
              <Link to="/" className="hidden sm:inline-flex items-center text-gray-700 hover:text-navy-600 font-medium transition-colors">
                <FiHome className="h-4 w-4 mr-1.5" /> Home
              </Link>
              <Link to="/login" className="px-5 py-2 bg-gradient-to-r from-navy-600 to-navy-700 text-white rounded-xl hover:shadow-lg transition-all font-medium text-sm">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="pt-16 bg-gradient-to-br from-navy-900 to-navy-700 text-white print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-block px-3 py-1 rounded-full bg-white/15 text-xs font-semibold mb-3">
              Based on UIDAI SoPs and the List of Acceptable Documents
            </span>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Aadhaar Docu Finder</h1>
            <p className="text-navy-100 max-w-2xl">
              Find the exact procedure for a name or date of birth change, and the documents UIDAI accepts for a
              name, address or date of birth update.
            </p>
          </motion.div>
        </div>
      </header>

      {/* Tabs + content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8 print:hidden">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center text-left p-4 rounded-2xl border transition-all ${
                  active
                    ? 'bg-white border-navy-500 shadow-lg ring-2 ring-navy-100'
                    : 'bg-white border-gray-200 hover:border-navy-200 hover:shadow'
                }`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mr-4 ${
                  active ? 'bg-gradient-to-br from-navy-600 to-navy-800' : 'bg-gray-100'
                }`}>
                  <t.icon className={`h-5 w-5 ${active ? 'text-white' : 'text-gray-500'}`} />
                </div>
                <div>
                  <p className={`font-bold ${active ? 'text-navy-800' : 'text-gray-800'}`}>{t.label}</p>
                  <p className="text-xs text-gray-500">{t.blurb}</p>
                </div>
              </button>
            );
          })}
        </div>

        {tab === 'procedure' ? (
          <ProcedureFinder onOpenDocuments={openDocuments} />
        ) : (
          <DocumentsFinder preset={preset} presetKey={presetKey} />
        )}

        <div className="mt-8 flex items-start p-4 rounded-xl bg-white border border-gray-200 text-xs text-gray-600 print:hidden">
          <FiInfo className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0 text-navy-600" />
          <p>
            This tool summarises the UIDAI documents it was built from and may not reflect later circulars.
            Where a field says "Not specified in the source sheet", the source gave no detail. Please confirm with the
            latest UIDAI SoP before submitting a request.{' '}
            <a
              href="https://uidai.gov.in/images/SOP_for_DOB_update.pdf"
              target="_blank"
              rel="noreferrer"
              className="text-navy-600 font-medium inline-flex items-center hover:underline"
            >
              DOB SoP <FiExternalLink className="h-3 w-3 ml-1" />
            </a>
            <span className="mx-1">|</span>
            <a
              href="https://uidai.gov.in/images/SOP_28.10.2021-Name_And_Gender_UpdateRequest_under_Exception_Handling_Process.pdf"
              target="_blank"
              rel="noreferrer"
              className="text-navy-600 font-medium inline-flex items-center hover:underline"
            >
              Name &amp; Gender SoP <FiExternalLink className="h-3 w-3 ml-1" />
            </a>
          </p>
        </div>
      </main>

      <footer className="bg-gradient-to-br from-navy-900 to-navy-800 text-navy-200 text-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>&copy; {new Date().getFullYear()} Akshaya e-Centre Pukayur</p>
          <Link to="/" className="hover:text-white transition-colors">Back to home</Link>
        </div>
      </footer>
    </div>
  );
};

export default AadhaarDocuFinder;