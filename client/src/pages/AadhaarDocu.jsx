// src/pages/AadhaarDocuFinder.jsx
// Public page: akshayasahayi.com/aadhaar_docufinder
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiShield, FiFileText, FiSearch, FiCheckCircle, FiAlertTriangle, FiXCircle,
  FiCopy, FiPrinter, FiArrowRight, FiInfo, FiUser, FiCalendar, FiMapPin,
  FiRefreshCw, FiHome, FiBookOpen, FiExternalLink, FiUsers, FiFilter, FiLayers,
  FiGrid, FiStar
} from 'react-icons/fi';
import {
  CHANGE_TYPES, AGE_GROUPS, NAME_REASONS, DOB_STATUSES, DOB_RESIDENT_TYPES,
  DOC_UPDATE_TYPES, DOC_RESIDENT_TYPES, DOC_CATEGORIES,
  findProcedure, findDocuments, detectNameScenario, getScenario,
} from '../utils/aadhaar/Aadhaarlogic.js';
import { SCENARIOS } from '../utils/aadhaar/Aadhaarscenarios.js';
import { DOCUMENTS } from '../utils/aadhaar/Aadhaardocuments.js';

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
// 1. Procedure finder (name / DOB)
// ---------------------------------------------------------------------
const emptyName = { oldName: '', newName: '', reasonId: '', ageGroup: '', overrideCode: '' };
const emptyDob = { oldDob: '', enrolDate: '', newDob: '', dobStatus: '', prevUpdates: '0', residentType: '', operatorError: '' };

const ProcedureFinder = ({ onOpenDocuments }) => {
  const [mode, setMode] = useState(CHANGE_TYPES[0]);
  const [nameForm, setNameForm] = useState(emptyName);
  const [dobForm, setDobForm] = useState(emptyDob);
  const isName = mode === CHANGE_TYPES[0];
  const form = isName ? nameForm : dobForm;

  const setN = (k) => (v) => setNameForm((f) => ({ ...f, [k]: v }));
  const setD = (k) => (v) => setDobForm((f) => ({ ...f, [k]: v }));

  const result = useMemo(() => findProcedure(mode, form), [mode, form]);
  const touched = isName ? nameForm.oldName || nameForm.newName : dobForm.oldDob || dobForm.enrolDate || dobForm.newDob;

  const nameCodes = useMemo(() => ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)', '(g)', '(h)', '(i)', '(j)', '(k)', '(l)', '(m)', '(n)', '(o)'], []);
  const autoCode = isName && nameForm.reasonId ? detectNameScenario(nameForm) : '';

  const loadExample = () => {
    if (isName) setNameForm({ oldName: 'R.V.N Srinivas', newName: 'RVN Srinivas', reasonId: 'spelling', ageGroup: AGE_GROUPS[0], overrideCode: '' });
    else setDobForm({ oldDob: '2012-05-12', enrolDate: '2014-01-15', newDob: '2011-09-03', dobStatus: DOB_STATUSES[0], prevUpdates: '0', residentType: 'Indian resident', operatorError: 'No' });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Procedure details for ${mode}...`);
      toast.success('Procedure copied');
    } catch {
      toast.error('Could not copy.');
    }
  };

  const openDocs = () => {
    if (isName) {
      onOpenDocuments({ updateType: 'Name', residentType: 'Indian resident', category: nameForm.ageGroup === AGE_GROUPS[1] ? DOC_CATEGORIES[1] : DOC_CATEGORIES[0], dobStatus: '' });
    } else {
      onOpenDocuments({ updateType: 'Date of Birth', residentType: dobForm.residentType === 'NRI' ? 'NRI' : dobForm.residentType === 'Indian resident' ? 'Indian resident' : '', category: result.isMinor ? DOC_CATEGORIES[1] : DOC_CATEGORIES[0], dobStatus: dobForm.dobStatus });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
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
                <Field label="Reason for change" hint="First name: pick 'First name correction' for a spelling / phonetic fix, or 'First name change' for a different name. Use 'Spelling / format correction' for anything else.">
                  <Select value={nameForm.reasonId} onChange={setN('reasonId')} options={NAME_REASONS.map((r) => ({ value: r.id, label: r.label }))} />
                </Field>
                <Field label="Applicant age group">
                  <Select value={nameForm.ageGroup} onChange={setN('ageGroup')} options={AGE_GROUPS} />
                </Field>
                <Field label="Override detected type (optional)" hint="Leave blank to use the auto-detected code. Use it to force (a) abbreviation or (d) phonetic spelling.">
                  <Select value={nameForm.overrideCode} onChange={setN('overrideCode')} options={nameCodes} placeholder="Auto-detect" />
                </Field>
                {autoCode && <p className="text-sm text-gray-600">Detected scenario: <span className="font-bold text-navy-700">{autoCode}</span></p>}
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
            <button type="button" onClick={loadExample} className="text-sm font-medium text-navy-600 hover:text-navy-800">Try an example</button>
            <button type="button" onClick={() => (isName ? setNameForm(emptyName) : setDobForm(emptyDob))} className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-800">
              <FiRefreshCw className="h-4 w-4 mr-1.5" /> Clear
            </button>
          </div>
        </Card>
      </div>

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
              <motion.div key={`${mode}-${result.code}-${result.check}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-3">
                <StatusBanner check={result.check} blocked={result.scenario?.blocked} />
                {result.scenario && (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-navy-100 text-navy-700 text-sm font-bold">Scenario {result.code}</span>
                      <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">{result.scenario.category}</span>
                    </div>
                    <Section label="Scenario">{result.scenario.description}</Section>
                    <Section label="Applies to">{result.scenario.appliesTo}</Section>
                    <Section label="Documents required" tone="note">{result.scenario.documents}</Section>
                    <Section label="Affidavit / annexure to use">{result.scenario.annexure}</Section>
                    <Section label="Note for this applicant" tone="warn">{result.note}</Section>
                    <Section label="Exceptions and conditions">{result.scenario.exceptions}</Section>
                    <Section label="Examples from the source">{result.scenario.examples}</Section>
                    <p className="text-xs text-gray-500 flex items-start">
                      <FiBookOpen className="h-4 w-4 mr-1.5 mt-0.5 flex-shrink-0" /> Source: {result.scenario.source}
                    </p>
                    <div className="flex flex-wrap gap-3 pt-2 print:hidden">
                      {!result.scenario.blocked && (
                        <button type="button" onClick={openDocs} className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-navy-600 to-navy-700 text-white rounded-xl hover:shadow-lg transition-all font-medium text-sm">
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
// 2. Documents finder (Requirements Wizard)
// ---------------------------------------------------------------------
const DocRow = ({ doc, route }) => (
  <div className={`rounded-xl border p-4 ${route === 'hof' ? 'bg-navy-50 border-navy-100' : 'bg-white border-gray-200'}`}>
    <div className="flex items-start gap-3">
      <span className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-navy-100 text-navy-700 text-xs font-bold">Sl. {doc.sl}</span>
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
            <button type="button" onClick={() => { setF({ updateType: '', residentType: '', category: '', dobStatus: '' }); setQuery(''); }} className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-800">
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
                {res.notes.map((n) => <Section key={n.label} label={n.label}>{n.text}</Section>)}
              </div>
              <div className="relative">
                <FiSearch className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                <input className={`${inputCls} pl-10`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search within these documents (e.g. bill, passport)" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Standard route <span className="text-gray-500 font-medium text-sm">({std.length})</span></h3>
                {std.length === 0 ? <p className="text-sm text-gray-500">No matching documents in the source list for this combination.</p> : (
                  <div className="space-y-2.5">{std.map((d) => <DocRow key={d.sl} doc={d} route="std" />)}</div>
                )}
              </div>
              {res.hof.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">HoF-based route <span className="text-gray-500 font-medium text-sm">({hof.length})</span></h3>
                  <p className="text-xs text-gray-500 mb-3">Relationship proof via the Head of Family.</p>
                  <div className="space-y-2.5">{hof.map((d) => <DocRow key={`h-${d.sl}`} doc={d} route="hof" />)}</div>
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
// 3. Document Gallery
// ---------------------------------------------------------------------
const DocumentGallery = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDocs = useMemo(() => {
    return DOCUMENTS.filter((doc) => {
      if (activeTab === 'poi' && !doc.poi) return false;
      if (activeTab === 'poa' && !doc.poa) return false;
      if (activeTab === 'por' && !doc.por) return false;
      if (activeTab === 'pdb' && !doc.pdb) return false;
      const q = searchQuery.toLowerCase();
      if (q) return doc.name.toLowerCase().includes(q) || doc.conditions.toLowerCase().includes(q);
      return true;
    });
  }, [activeTab, searchQuery]);

  const GAL_TABS = [
    { id: 'all', label: 'All Documents' },
    { id: 'poi', label: 'Identity (PoI)' },
    { id: 'poa', label: 'Address (PoA)' },
    { id: 'por', label: 'Relationship (PoR)' },
    { id: 'pdb', label: 'Date of Birth (PDB)' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sticky top-20 z-30">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-center">
          <div className="relative w-full lg:w-96">
            <FiSearch className="absolute left-4 top-3.5 text-gray-400 h-5 w-5" />
            <input type="text" placeholder="Search all 43 UIDAI documents..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-navy-500 focus:outline-none transition-all" />
          </div>
          <div className="flex overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 gap-2 hide-scrollbar">
            {GAL_TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === tab.id ? 'bg-navy-700 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {tab.id === 'all' && <FiFilter className="inline mr-2 mb-0.5" />} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {filteredDocs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 border-dashed"><FiFileText className="h-12 w-12 mx-auto text-gray-300 mb-4" /><h3 className="text-lg font-bold text-gray-900">No documents found</h3></div>
      ) : (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {filteredDocs.map((doc) => (
              <motion.div layout key={doc.sl} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="rounded-2xl border bg-white border-gray-200 p-5 flex flex-col hover:shadow-lg transition-all">
                <div className="flex items-start gap-3 mb-3"><span className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-navy-100 text-navy-700 text-xs font-bold">Sl. {doc.sl}</span><p className="font-bold text-gray-900 text-sm leading-snug">{doc.name}</p></div>
                <div className="flex flex-wrap gap-2 mt-auto mb-3">
                  {doc.poi && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">PoI</span>}
                  {doc.poa && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-100">PoA</span>}
                  {doc.por && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100">PoR</span>}
                  {doc.pdb && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-100">PDB</span>}
                </div>
                {doc.conditions && (
                  <div className="flex items-start pt-3 border-t border-gray-100"><FiInfo className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" /><p className="ml-2 text-xs text-gray-600 font-medium leading-relaxed">{doc.conditions}</p></div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// 4. Scenarios Gallery (Redesigned CMS Matrix Layout)
// ---------------------------------------------------------------------
const ScenariosGallery = () => {
  const [activeCategory, setActiveCategory] = useState('All Categories');
  const [searchQuery, setSearchQuery] = useState('');

  // Extract unique categories and their counts dynamically
  const { uniqueCategories, categoryCounts } = useMemo(() => {
    const counts = {};
    const categories = new Set();
    
    SCENARIOS.forEach((s) => {
      categories.add(s.category);
      counts[s.category] = (counts[s.category] || 0) + 1;
    });

    return { 
      uniqueCategories: Array.from(categories), 
      categoryCounts: counts 
    };
  }, []);

  // Filter Logic
  const filteredScenarios = useMemo(() => {
    return SCENARIOS.filter((s) => {
      // Category Match
      if (activeCategory !== 'All Categories' && s.category !== activeCategory) return false;
      
      // Search Match
      const q = searchQuery.toLowerCase();
      if (q) {
        return (
          (s.code || '').toLowerCase().includes(q) ||
          (s.description || '').toLowerCase().includes(q) ||
          (s.exceptions || '').toLowerCase().includes(q) ||
          (s.examples || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeCategory, searchQuery]);

  // Aggregate Stats
  const stats = useMemo(() => {
    const total = SCENARIOS.length;
    const catCount = uniqueCategories.length;
    const nameCount = SCENARIOS.filter(s => s.category.includes('Name') || s.category === 'Special Cases' || s.category === 'Data Entry Error' || s.category === 'Error in Regional Language').length;
    const dobCount = SCENARIOS.filter(s => s.category.includes('Date of Birth') || s.category.includes('DoB') || s.category === 'Operator Error').length;
    
    return { total, catCount, nameCount, dobCount };
  }, [uniqueCategories]);

  return (
    <div className="space-y-6">
      
      {/* Header and Controls (Mimicking the CMS Layout) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-gray-100 pb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              UIDAI Aadhaar Update Rules
              <span className="ml-3 px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold border border-gray-200">Gallery View</span>
            </h2>
            <p className="text-sm text-gray-500 mt-1">Standard Operating Procedures & Official Document Verification Matrix</p>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-center mb-6">
          <div className="relative w-full lg:w-96">
            <FiSearch className="absolute left-4 top-2.5 text-gray-400 h-5 w-5" />
            <input 
              type="text" 
              placeholder="Search scenarios, examples, rules..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full pl-11 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:outline-none transition-all text-sm" 
            />
          </div>
          
          <div className="flex items-center gap-4 w-full lg:w-auto">
            <FiFilter className="text-gray-400" />
            <select 
              value={activeCategory} 
              onChange={(e) => setActiveCategory(e.target.value)}
              className="w-full lg:w-48 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            >
              <option value="All Categories">All Categories</option>
              {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="border border-gray-200 rounded-xl p-4 flex justify-between items-center bg-white shadow-sm">
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs font-medium text-gray-500 mt-1">Scenarios Shown</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
              <FiGrid className="h-5 w-5" />
            </div>
          </div>
          <div className="border border-gray-200 rounded-xl p-4 flex justify-between items-center bg-white shadow-sm">
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.catCount}</p>
              <p className="text-xs font-medium text-gray-500 mt-1">Update Categories</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center">
              <FiLayers className="h-5 w-5" />
            </div>
          </div>
          <div className="border border-gray-200 rounded-xl p-4 flex justify-between items-center bg-white shadow-sm">
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.nameCount}</p>
              <p className="text-xs font-medium text-gray-500 mt-1">Name Updates</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center">
              <FiStar className="h-5 w-5" />
            </div>
          </div>
          <div className="border border-gray-200 rounded-xl p-4 flex justify-between items-center bg-white shadow-sm">
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.dobCount}</p>
              <p className="text-xs font-medium text-gray-500 mt-1">DoB Procedures</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-green-50 text-green-500 flex items-center justify-center">
              <FiShield className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Horizontal Category Pills */}
        <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar items-center">
          <button 
            onClick={() => setActiveCategory('All Categories')} 
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center border ${
              activeCategory === 'All Categories' ? 'bg-navy-900 text-white border-navy-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            All <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeCategory === 'All Categories' ? 'bg-white/20' : 'bg-gray-100'}`}>{stats.total}</span>
          </button>
          
          {uniqueCategories.map((cat) => (
            <button 
              key={cat}
              onClick={() => setActiveCategory(cat)} 
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center border ${
                activeCategory === cat ? 'bg-navy-900 text-white border-navy-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cat} <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${activeCategory === cat ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>{categoryCounts[cat]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid of CMS-Style Cards */}
      {filteredScenarios.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 border-dashed">
          <FiLayers className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-900">No scenarios found</h3>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredScenarios.map((s) => (
              <motion.div 
                layout 
                key={s.code} 
                initial={{ opacity: 0, scale: 0.98 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.98 }} 
                className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 flex flex-col overflow-hidden"
              >
                <div className="p-6 flex-1 flex flex-col">
                  {/* Card Header */}
                  <div className="flex justify-between items-center mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      s.category.includes('Name') ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                      s.category.includes('Date of Birth') || s.category.includes('DoB') ? 'bg-green-50 text-green-700 border border-green-100' :
                      s.category.includes('Error') ? 'bg-red-50 text-red-600 border border-red-100' :
                      'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}>
                      {s.category}
                    </span>
                    <span className="font-bold text-gray-500 text-sm">{s.code}</span>
                  </div>
                  
                  {/* Card Title & Target */}
                  <h3 className="text-base font-bold text-gray-900 mb-2 leading-snug">{s.description}</h3>
                  {s.appliesTo && (
                    <div className="flex items-start text-xs text-gray-600 mb-4">
                      <FiUsers className="mr-1.5 mt-0.5 text-gray-400 flex-shrink-0" />
                      <span><span className="font-medium text-gray-700">Target:</span> {s.appliesTo}</span>
                    </div>
                  )}
                  
                  {/* Documents Box */}
                  {s.documents && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-3">
                      <div className="flex items-center mb-2">
                        <FiFileText className="text-slate-500 mr-1.5 h-4 w-4" />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Documents Required</p>
                      </div>
                      <p className="text-sm text-slate-800 leading-relaxed">{s.documents}</p>
                    </div>
                  )}

                  {/* Illustrations Box */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-auto mb-4">
                    <div className="flex items-center mb-2">
                      <FiStar className="text-amber-500 mr-1.5 h-4 w-4" />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Illustrations / Examples</p>
                    </div>
                    <p className="text-sm text-amber-900 italic leading-relaxed">
                      {s.examples ? s.examples : "No examples provided in source."}
                    </p>
                  </div>
                  
                  {/* Exceptions Warning (If Any) */}
                  {s.exceptions && (
                    <div className="flex items-start text-xs text-red-600 mb-4 bg-red-50 p-3 rounded-lg border border-red-100">
                      <FiAlertTriangle className="mr-1.5 mt-0.5 flex-shrink-0" />
                      <span className="leading-relaxed">{s.exceptions}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="bg-white border-t border-gray-100 p-4 flex justify-between items-center text-xs text-gray-500">
                  <span>Source 1</span>
                  <button className="text-navy-600 font-medium hover:text-navy-800 transition-colors flex items-center">
                    Inspect <FiArrowRight className="ml-1 h-3 w-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// 5. Main Page Component
// ---------------------------------------------------------------------
const TABS = [
  { id: 'procedure', label: 'Procedure Finder', icon: FiCalendar, blurb: 'Name or DOB exact procedures' },
  { id: 'documents', label: 'Requirements Wizard', icon: FiMapPin, blurb: 'Contextual docs for your update' },
  { id: 'scenarios', label: 'Scenarios Gallery', icon: FiLayers, blurb: 'Browse all 25 edge-case scenarios' },
  { id: 'gallery', label: 'Document Gallery', icon: FiBookOpen, blurb: 'Browse all 43 valid UIDAI docs' },
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
              <Link to="/login" className="px-5 py-2 bg-navy-600 hover:bg-navy-700 text-white rounded-xl hover:shadow-lg transition-all font-medium text-sm">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <header className="pt-16 bg-navy-900 text-white print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-block px-3 py-1 rounded-full bg-white/15 text-xs font-semibold mb-3">
              UIDAI Support & Resolution Suite
            </span>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Aadhaar Document Suite</h1>
            <p className="text-navy-100 max-w-2xl">
              Find exact procedures for demographic changes, run contextual requirement wizards, or browse the complete gallery of acceptable scenarios and government documents.
            </p>
          </motion.div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-8 print:hidden">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center text-left p-4 rounded-2xl border transition-all ${
                  active ? 'bg-white border-navy-500 shadow-lg ring-2 ring-navy-100' : 'bg-white border-gray-200 hover:border-navy-200 hover:shadow'
                }`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mr-4 flex-shrink-0 ${active ? 'bg-gradient-to-br from-navy-600 to-navy-800' : 'bg-gray-100'}`}>
                  <t.icon className={`h-5 w-5 ${active ? 'text-white' : 'text-gray-500'}`} />
                </div>
                <div>
                  <p className={`font-bold ${active ? 'text-navy-800' : 'text-gray-800'}`}>{t.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">{t.blurb}</p>
                </div>
              </button>
            );
          })}
        </div>

        {tab === 'procedure' && <ProcedureFinder onOpenDocuments={openDocuments} />}
        {tab === 'documents' && <DocumentsFinder preset={preset} presetKey={presetKey} />}
        {tab === 'scenarios' && <ScenariosGallery />}
        {tab === 'gallery' && <DocumentGallery />}

        <div className="mt-8 flex items-start p-4 rounded-xl bg-white border border-gray-200 text-xs text-gray-600 print:hidden">
          <FiInfo className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0 text-navy-600" />
          <p>
            This tool summarises the UIDAI documents it was built from and may not reflect later circulars. Always confirm with the latest UIDAI SoP before submitting a request.
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