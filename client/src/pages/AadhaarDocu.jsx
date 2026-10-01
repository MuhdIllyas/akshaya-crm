// src/pages/AadhaarDocu.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiShield, FiFileText, FiSearch, FiCheckCircle, FiAlertTriangle, FiXCircle,
  FiCopy, FiPrinter, FiArrowRight, FiInfo, FiUser, FiCalendar, FiMapPin,
  FiRefreshCw, FiHome, FiBookOpen, FiExternalLink, FiUsers, FiFilter
} from 'react-icons/fi';

// =====================================================================
// 1. DATA & CONSTANTS (Merged from utils)
// =====================================================================

const CHANGE_TYPES = ['Name Change', 'DOB Change'];
const AGE_GROUPS = ['Adult (18+)', 'Minor (under 18)'];
const DOB_STATUSES = ['Declared / Approximate', 'Verified - Birth Certificate', 'Verified - Other PDB document'];
const DOB_RESIDENT_TYPES = ['Indian resident', 'NRI', 'Resident foreigner'];

const DOC_UPDATE_TYPES = ['Name', 'Address', 'Date of Birth'];
const DOC_RESIDENT_TYPES = [
  'Indian resident', 'NRI', 'OCI cardholder', 'Nepal / Bhutan national',
  'Long Term Visa (LTV) holder', 'Other foreign national', 'Foreign national without passport (FRRO/FRO)'
];
const DOC_CATEGORIES = [
  'Adult (18+)', 'Minor (under 18)', 'Child in Child Care Institution (CCI)',
  'Destitute person with disability (18+)', 'Prisoner'
];

const NAME_REASONS = [
  { id: 'spelling', label: 'Spelling / format correction' },
  { id: 'marriage', label: 'Surname change after marriage or divorce' },
  { id: 'gender', label: 'Change of name due to change of gender' },
  { id: 'wrong', label: 'Name recorded wrongly (earlier document has the correct name)' },
  { id: 'regional', label: 'Regional-language spelling error only' },
  { id: 'complete', label: 'Complete change of name / identity' },
  { id: 'baby', label: 'Baby of (name) changed to actual name' },
  { id: 'first_variant', label: 'First name correction (spelling / phonetic variant)' },
  { id: 'first_new', label: 'First name change (a different name)' }
];

const PREFIXES_TO_DROP = ['lt', 'maj', 'brig', 'col', 'sub', 'nb', 'hav', 'nk', 'l', 'justice', 'dr', 'mr', 'mrs', 'ms', 'shri', 'smt', 'kumari', 'babu', 'prof'];

const SCENARIOS = {
  '(a)': { code: '(a)', category: 'Minor Name Change', description: 'Expanding the abbreviation or abbreviating the name to initials', appliesTo: 'All residents / Minors (<18 yrs for HoF)', examples: 'T R D Prasad to Tadi Rama Durga Prasad; Ram Mohan Naidu to RM Naidu', documents: 'PoI / Applicable PoR in cases of HoF-based name update of children', exceptions: 'Name shall be updated as per the spelling, sequence, abbreviation etc. mentioned in the submitted document.', status: 'Proceed', adultAnnexure: 'None listed in the source sheet', minorAnnexure: 'None listed in the source sheet', source: 'SoP for Name Update dt 18Sep2026.pdf' },
  '(b)': { code: '(b)', category: 'Minor Name Change', description: 'Addition or deletion of middle name(s) or last name', appliesTo: 'All residents / Minors (<18 yrs for HoF)', examples: 'Addition: Himanshu Gupta to Himanshu Chandra Gupta; Deletion: Himanshu Chandra Gupta to Himanshu Gupta', documents: 'PoI / Applicable PoR in cases of HoF-based name update of children', exceptions: 'Name shall be updated as per the spelling, sequence, abbreviation etc. mentioned in the submitted document.', status: 'Proceed', adultAnnexure: 'None listed in the source sheet', minorAnnexure: 'None listed in the source sheet', source: 'SoP for Name Update dt 18Sep2026.pdf' },
  '(c)': { code: '(c)', category: 'Minor Name Change', description: 'Change in sequential order', appliesTo: 'All residents / Minors (<18 yrs for HoF)', examples: 'Divakar Anand to Anand Divakar; Ravi Kishan to Kishan Ravi', documents: 'PoI / Applicable PoR in cases of HoF-based name update of children', exceptions: 'Name shall be updated as per the spelling, sequence, abbreviation etc. mentioned in the submitted document.', status: 'Proceed', adultAnnexure: 'None listed in the source sheet', minorAnnexure: 'None listed in the source sheet', source: 'SoP for Name Update dt 18Sep2026.pdf' },
  '(d)': { code: '(d)', category: 'Minor Name Change', description: 'Minor correction in English spelling, however names are phonetically similar', appliesTo: 'All residents / Minors (<18 yrs for HoF)', examples: 'Ram to Rama; Sitaram to Sita Ram; Somya to Saumya', documents: 'PoI / Applicable PoR in cases of HoF-based name update of children', exceptions: 'Name shall be updated as per the spelling, sequence, abbreviation etc. mentioned in the submitted document.', status: 'Proceed', adultAnnexure: 'None listed in the source sheet', minorAnnexure: 'None listed in the source sheet', source: 'SoP for Name Update dt 18Sep2026.pdf' },
  '(e)': { code: '(e)', category: 'Minor Name Change', description: 'Any combination of (a), (b), (c) and (d)', appliesTo: 'All residents / Minors (<18 yrs for HoF)', examples: 'Not in source', documents: 'PoI / Applicable PoR in cases of HoF-based name update of children', exceptions: 'Name shall be updated as per the spelling, sequence, abbreviation etc. mentioned in the submitted document.', status: 'Proceed', adultAnnexure: 'None listed in the source sheet', minorAnnexure: 'None listed in the source sheet', source: 'SoP for Name Update dt 18Sep2026.pdf' },
  '(h)': { code: '(h)', category: 'Name Change (Baby)', description: 'Baby of (Name) to Actual Name', appliesTo: 'Minors enrolled before giving a name', examples: 'Baby of Kavita to Shweta', documents: 'Birth Certificate (mandatory) + applicable PoR document', exceptions: 'Must be done before age 5, or requires exception handling.', status: 'Proceed', adultAnnexure: 'Annexure D', minorAnnexure: 'Annexure D', source: 'SoP for Name Update dt 18Sep2026.pdf' },
  '(o)': { code: '(o)', category: 'Major Name Change', description: 'Complete change of name / change of identity', appliesTo: 'Not specified in the source sheet', examples: 'Ram Gupta to Shyam Gupta; Amisha Patel to Ameesha Kumar Singh', documents: 'PoI (only Gazette Notification for name change)', exceptions: 'Complete change in name / change of identity is liable to be rejected if not accompanied by a Gazette Notification.', status: 'Proceed', adultAnnexure: 'None listed in the source sheet', minorAnnexure: 'None listed in the source sheet', source: 'SoP for Name Update dt 18Sep2026.pdf' },
  'unknown': { code: 'unknown', category: 'Manual Review Required', description: 'This specific change combination does not match a standard automated rule.', appliesTo: 'N/A', examples: 'N/A', documents: 'Standard PoI/PoR based on the update type.', exceptions: 'Check with UIDAI RO / standard SoP circulars.', status: 'Review Required', adultAnnexure: 'Check current SoP', minorAnnexure: 'Check current SoP', source: 'N/A', blocked: true }
};

const AADHAAR_DOCUMENTS = [
  { id: "1", name: "Valid Indian Passport", poi: true, poa: true, por: true, pdb: true, notes: "Valid Indian passport. DOB conditions (#) apply." },
  { id: "2", name: "Ration / PDS Photograph Card / e-Ration Card", poi: true, poa: true, por: true, pdb: false, notes: "" },
  { id: "3", name: "Voter Identity Card / e-Voter Identity Card", poi: true, poa: true, por: false, pdb: false, notes: "Details must be displayed online on the website of the Election Commission of India or the Chief Electoral Officer concerned." },
  { id: "4", name: "Driving licence", poi: true, poa: false, por: false, pdb: false, notes: "" },
  { id: "5", name: "Service Photo Identity Card issued by Central / State Government / PSU / regulatory body", poi: true, poa: true, por: false, pdb: true, notes: "DOB conditions (#) apply." },
  { id: "6", name: "Pensioner Photo Identity Card / Freedom Fighter Photo Identity Card / Pension Payment Order", poi: true, poa: true, por: true, pdb: true, notes: "DOB conditions (#) apply." },
  { id: "7", name: "Kisan Photo Passbook", poi: true, poa: true, por: false, pdb: false, notes: "" },
  { id: "8", name: "CGHS / ECHS / ESIC / Medi-Claim Card issued by Central / State Government / PSU", poi: true, poa: false, por: false, pdb: false, notes: "" },
  { id: "9", name: "Certificate in UIDAI prescribed format, jointly signed and stamped by Head of Shelter Home and District Social Welfare Officer", poi: true, poa: true, por: false, pdb: false, notes: "For destitute persons with disability only." },
  { id: "10", name: "MGNREGA / NREGS Job Card and Domicile Certificate issued by State Government", poi: true, poa: true, por: true, pdb: false, notes: "Job Card together with the Domicile Certificate." },
  { id: "11", name: "Marriage Certificate with or without photograph", poi: true, poa: true, por: true, pdb: false, notes: "If no photograph, a PoI document bearing old name with photograph is also required." },
  { id: "12", name: "Divorce Decree issued by family court", poi: true, poa: false, por: false, pdb: false, notes: "If no photograph, a PoI document bearing old name with photograph is also required." },
  { id: "13", name: "ST / SC / OBC Certificate issued by Central / State Government", poi: true, poa: true, por: true, pdb: false, notes: "" },
  { id: "14", name: "Marksheet / Certificate issued by a recognised Board of Education or University", poi: true, poa: false, por: true, pdb: true, notes: "DOB conditions (#) apply." },
  { id: "15", name: "Passbook issued by a scheduled commercial bank, State cooperative bank, or Post Office", poi: false, poa: true, por: false, pdb: false, notes: "Must be cross-stamped with bank seal and signed by an official." },
  { id: "16", name: "Bank / Credit Card / Post Office Savings Account Statement", poi: false, poa: true, por: false, pdb: false, notes: "Must carry stamp and signature of the issuing official. Not older than 3 months." },
  { id: "17", name: "Third gender / Transgender Identity Card or Certificate", poi: true, poa: true, por: true, pdb: true, notes: "Also acceptable for gender and full-name change. DOB conditions (#) apply." },
  { id: "18", name: "Gazette notification", poi: true, poa: false, por: false, pdb: false, notes: "Accepted for a change in first name or in full name." },
  { id: "19 i", name: "UIDAI Standard Format: MP / MLA / MLC / Municipal Councillor", poi: false, poa: true, por: false, pdb: false, notes: "Valid 3 months from date of issue." },
  { id: "19 ii", name: "UIDAI Standard Format: Gazetted Officer Group 'A' / EPFO Officer", poi: false, poa: true, por: false, pdb: false, notes: "Valid 3 months from date of issue." },
  { id: "19 iii", name: "UIDAI Standard Format: Tehsildar / Gazetted Officer Group 'B'", poi: false, poa: true, por: false, pdb: false, notes: "Valid 3 months from date of issue." },
  { id: "19 iv", name: "UIDAI Standard Format: Gazetted Officer at NACO / State Health Dept", poi: true, poa: true, por: false, pdb: false, notes: "Valid 3 months from date of issue. Also counts as PoI." },
  { id: "19 v", name: "UIDAI Standard Format: District Child Protection Officer (DCPO) + placement order", poi: true, poa: true, por: false, pdb: false, notes: "For children in Child Care Institutions only. Also counts as PoI." },
  { id: "19 vi", name: "UIDAI Standard Format: Recognised educational institution (signed by Head of Institute)", poi: false, poa: true, por: false, pdb: false, notes: "Only for the institute's own students. Valid 3 months from date of issue." },
  { id: "19 vii", name: "UIDAI Standard Format: Village Panchayat Head / Mukhiya / Village Revenue Officer", poi: false, poa: true, por: false, pdb: false, notes: "For rural areas only. Valid 3 months from date of issue." },
  { id: "20", name: "Electricity bill (pre-paid / post-paid)", poi: false, poa: true, por: false, pdb: false, notes: "Not older than 3 months." },
  { id: "21", name: "Water bill", poi: false, poa: true, por: false, pdb: false, notes: "Not older than 3 months." },
  { id: "22", name: "Telephone landline bill / post-paid mobile bill / broadband bill", poi: false, poa: true, por: false, pdb: false, notes: "Not older than 3 months." },
  { id: "23", name: "Property Tax Receipt", poi: false, poa: true, por: false, pdb: false, notes: "Not older than 1 year." },
  { id: "24", name: "Valid sale agreement / gift deed / registered or unregistered rent agreement", poi: false, poa: true, por: false, pdb: false, notes: "" },
  { id: "25", name: "Gas bill", poi: false, poa: true, por: false, pdb: false, notes: "Not older than 3 months." },
  { id: "26", name: "Allotment letter of accommodation issued by Central / State Government / PSU", poi: false, poa: true, por: false, pdb: false, notes: "Not older than 1 year." },
  { id: "27", name: "Life or medical insurance policy", poi: false, poa: true, por: false, pdb: false, notes: "Valid up to 1 year from the date of issue." },
  { id: "28", name: "Birth certificate issued under the Registration of Births and Deaths Act, 1969", poi: false, poa: false, por: true, pdb: true, notes: "DOB conditions (#) apply." },
  { id: "29", name: "Prisoner Induction Document (PID) issued by Prison Officer", poi: true, poa: true, por: false, pdb: false, notes: "For prisoners only." },
  { id: "30", name: "Self-declaration from an immediate family member certifying relationship", poi: false, poa: false, por: true, pdb: false, notes: "Valid only for borrowing address. HoF form is valid 3 months." },
  { id: "31", name: "Document proving legal guardianship issued by Central / State Govt or court of law", poi: false, poa: false, por: true, pdb: false, notes: "Counts as Proof of Relationship (PoR) only." },
  { id: "32", name: "OCI cardholders - valid foreign passport (along with OCI card)", poi: true, poa: false, por: false, pdb: true, notes: "DOB conditions (#) apply." },
  { id: "33 a", name: "Nepal / Bhutan nationals - Passport of Nepal / Bhutan", poi: true, poa: false, por: false, pdb: true, notes: "DOB conditions (#) apply." },
  { id: "33 b", name: "Nepal / Bhutan nationals - Citizenship Certificate / Voter ID / Identity Certificate", poi: true, poa: false, por: false, pdb: true, notes: "DOB conditions (#) apply." },
  { id: "34", name: "Long Term Visa (LTV) holders - valid LTV", poi: true, poa: true, por: false, pdb: true, notes: "DOB conditions (#) apply." },
  { id: "35", name: "Other foreign nationals - valid foreign passport (along with valid visa)", poi: true, poa: false, por: false, pdb: true, notes: "DOB conditions (#) apply." },
  { id: "36", name: "Valid Registration Certificate or Residential permit issued by FRRO / FRO", poi: true, poa: true, por: false, pdb: true, notes: "DOB conditions (#) apply." },
];


// =====================================================================
// 2. LOGIC FUNCTIONS
// =====================================================================

const normalizeName = (name) => {
  if (!name) return '';
  let clean = name.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  let parts = clean.split(' ');
  while (parts.length > 0 && PREFIXES_TO_DROP.includes(parts[0])) parts.shift();
  return parts.join(' ');
};

const detectNameScenario = (form) => {
  if (form.overrideCode) return form.overrideCode;
  const reason = form.reasonId;
  if (['complete', 'first_new', 'gender', 'marriage'].includes(reason)) return '(o)';
  if (reason === 'baby') return '(h)';

  const oldN = normalizeName(form.oldName);
  const newN = normalizeName(form.newName);
  if (!oldN || !newN) return '';

  const oldParts = oldN.split(' ');
  const newParts = newN.split(' ');

  if (oldParts.length === newParts.length && oldN !== newN) {
    if ([...oldParts].sort().join(' ') === [...newParts].sort().join(' ')) return '(c)';
    return '(d)'; 
  }
  if (newParts.length > oldParts.length || oldParts.length > newParts.length) return '(b)';
  return '(e)';
};

const findProcedure = (mode, form) => {
  const isName = mode === CHANGE_TYPES[0];
  let code = '', scenario = null, check = 'OK', note = '', isMinor = false;

  if (isName) {
    if (!form.oldName || !form.newName) return { check: 'Missing required inputs', code: '', scenario: null };
    isMinor = form.ageGroup === AGE_GROUPS[1];
    code = detectNameScenario(form);
    scenario = SCENARIOS[code] || SCENARIOS['unknown'];
    if (scenario.blocked) check = 'BLOCKED';
  } else {
    if (!form.oldDob || !form.enrolDate || !form.newDob) return { check: 'Missing required dates', code: '', scenario: null };
    isMinor = form.residentType !== 'Indian resident';
    
    if (parseInt(form.prevUpdates) >= 1) {
      check = 'Exception Handling Required - DOB already updated once.';
      code = 'DOB_EXCEPTION';
      scenario = { category: 'DOB Update Exception', description: 'Updating DOB more than once', documents: 'Birth Certificate + Self Declaration + RO Approval', annexure: 'Self Declaration Format', exceptions: 'Must be routed through UIDAI Regional Office.', blocked: true };
    } else {
      code = 'DOB_STANDARD';
      scenario = { category: 'Standard DOB Update', description: 'First time DOB update', documents: 'Birth Certificate / Valid Passport / PAN Card / SSLC Book', annexure: 'None', exceptions: 'Document must match the required DOB exactly.' };
    }
  }

  if (scenario) scenario.annexure = isMinor ? scenario.minorAnnexure : scenario.adultAnnexure;
  return { code, check, note, isMinor, scenario };
};

const findDocuments = (form) => {
  const { updateType, residentType, category } = form;
  if (!updateType || !residentType || !category) return { check: 'Missing inputs', proofNeeded: '', standard: [], hof: [], notes: [] };

  let proofNeeded = '';
  if (updateType === 'Name') proofNeeded = 'Proof of Identity (PoI)';
  else if (updateType === 'Address') proofNeeded = 'Proof of Address (PoA)';
  else if (updateType === 'Date of Birth') proofNeeded = 'Proof of Date of Birth (PDB)';

  let standard = [], hof = [];

  AADHAAR_DOCUMENTS.forEach(doc => {
    let matchesStd = false;
    let matchesHof = false;

    if (updateType === 'Name' && doc.poi) matchesStd = true;
    if (updateType === 'Address' && doc.poa) matchesStd = true;
    if (updateType === 'Date of Birth' && doc.pdb) matchesStd = true;

    if ((updateType === 'Name' || updateType === 'Address') && doc.por && category === 'Minor (under 18)') {
      matchesHof = true;
    }

    if (matchesStd) standard.push(doc);
    if (matchesHof) hof.push(doc);
  });

  return {
    check: 'OK',
    proofNeeded,
    standard,
    hof,
    notes: [{ label: 'Important Note', text: 'Ensure the document is valid and explicitly matches the requested demographic update.' }]
  };
};

// =====================================================================
// 3. UI COMPONENTS
// =====================================================================

const inputCls = 'w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-navy-500 transition-all';

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
  const tones = { plain: 'bg-gray-50 border-gray-100', note: 'bg-navy-50 border-navy-100', warn: 'bg-amber-50 border-amber-200' };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">{label}</p>
      <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-line">{children}</p>
    </div>
  );
};

const DocCard = ({ doc, route }) => (
  <motion.div
    layout
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className={`rounded-2xl border p-5 flex flex-col hover:shadow-lg transition-all ${
      route === 'hof' ? 'bg-navy-50 border-navy-100' : 'bg-white border-gray-200'
    }`}
  >
    <div className="flex items-start gap-3 mb-3">
      <span className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-navy-100 text-navy-700 text-xs font-bold">
        Sl. {doc.id}
      </span>
      <p className="font-bold text-gray-900 text-sm leading-snug">{doc.name}</p>
    </div>
    
    <div className="flex flex-wrap gap-2 mt-auto mb-3">
      {doc.poi && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">PoI</span>}
      {doc.poa && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-100">PoA</span>}
      {doc.por && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100">PoR</span>}
      {doc.pdb && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-100">PDB</span>}
    </div>

    {doc.notes && (
      <div className="flex items-start pt-3 border-t border-gray-100">
        <FiInfo className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
        <p className="ml-2 text-xs text-gray-600 font-medium leading-relaxed">{doc.notes}</p>
      </div>
    )}
  </motion.div>
);

// =====================================================================
// 4. TAB VIEWS
// =====================================================================

const ProcedureFinder = ({ onOpenDocuments }) => {
  const [mode, setMode] = useState(CHANGE_TYPES[0]);
  const [nameForm, setNameForm] = useState({ oldName: '', newName: '', reasonId: '', ageGroup: '', overrideCode: '' });
  const [dobForm, setDobForm] = useState({ oldDob: '', enrolDate: '', newDob: '', dobStatus: '', prevUpdates: '0', residentType: '', operatorError: '' });
  
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
      await navigator.clipboard.writeText(`Procedure details for ${mode}... (Summary copied)`);
      toast.success('Procedure copied');
    } catch {
      toast.error('Could not copy. Please select the text manually.');
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
                <Field label="Reason for change" hint="First name correction (phonetic) vs First name change (different name).">
                  <Select value={nameForm.reasonId} onChange={setN('reasonId')} options={NAME_REASONS.map((r) => ({ value: r.id, label: r.label }))} />
                </Field>
                <Field label="Applicant age group">
                  <Select value={nameForm.ageGroup} onChange={setN('ageGroup')} options={AGE_GROUPS} />
                </Field>
                <Field label="Override detected type (optional)">
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
                <Field label="DOB status in Aadhaar">
                  <Select value={dobForm.dobStatus} onChange={setD('dobStatus')} options={DOB_STATUSES} />
                </Field>
                <Field label="Previous DOB updates since enrollment">
                  <input type="number" min="0" max="20" className={inputCls} value={dobForm.prevUpdates} onChange={(e) => setD('prevUpdates')(e.target.value)} />
                </Field>
                <Field label="Resident type">
                  <Select value={dobForm.residentType} onChange={setD('residentType')} options={DOB_RESIDENT_TYPES} />
                </Field>
                <Field label="Operator error alleged?">
                  <Segmented value={dobForm.operatorError} onChange={setD('operatorError')} options={['Yes', 'No']} />
                </Field>
              </>
            )}
          </div>
          <div className="mt-6 flex items-center justify-between">
            <button type="button" onClick={loadExample} className="text-sm font-medium text-navy-600 hover:text-navy-800">Try an example</button>
            <button type="button" onClick={() => (isName ? setNameForm({ oldName: '', newName: '', reasonId: '', ageGroup: '', overrideCode: '' }) : setDobForm({ oldDob: '', enrolDate: '', newDob: '', dobStatus: '', prevUpdates: '0', residentType: '', operatorError: '' }))} className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-800">
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
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={`${mode}-${result.code}-${result.check}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
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

const DocumentsWizard = ({ preset, presetKey }) => {
  const [f, setF] = useState({ updateType: '', residentType: '', category: '', dobStatus: '' });
  const [query, setQuery] = useState('');
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (preset) setF({ updateType: '', residentType: '', category: '', dobStatus: '', ...preset });
  }, [presetKey, preset]);

  const res = useMemo(() => findDocuments(f), [f]);
  const touched = f.updateType || f.residentType || f.category;
  const q = query.trim().toLowerCase();
  const match = (d) => !q || d.name.toLowerCase().includes(q) || (d.notes || '').toLowerCase().includes(q);
  const std = res.standard.filter(match);
  const hof = res.hof.filter(match);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2">
        <Card title="Select the details" icon={FiUsers} className="lg:sticky lg:top-24">
          <div className="space-y-4">
            <Field label="What do you want to update?">
              <Segmented value={f.updateType} onChange={set('updateType')} options={DOC_UPDATE_TYPES} />
            </Field>
            <Field label="Resident type">
              <Select value={f.residentType} onChange={set('residentType')} options={DOC_RESIDENT_TYPES} />
            </Field>
            <Field label="Applicant category">
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
        <Card title="Contextual Document Results" icon={FiFileText}>
          {!touched ? (
            <div className="text-center py-12 text-gray-500">
              <FiSearch className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Choose what you want to update to see the contextual documents.</p>
            </div>
          ) : res.check !== 'OK' ? (
            <StatusBanner check={res.check} />
          ) : (
            <div className="space-y-5">
              <div className="rounded-xl bg-navy-50 border border-navy-100 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Proof type needed</p>
                <p className="font-semibold text-navy-800 text-sm">{res.proofNeeded}</p>
              </div>

              <div className="relative">
                <FiSearch className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                <input className={`${inputCls} pl-10`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search within these targeted results..." />
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-3">Standard route <span className="text-gray-500 font-medium text-sm">({std.length})</span></h3>
                {std.length === 0 ? (
                  <p className="text-sm text-gray-500">No matching documents for this combination.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {std.map((d) => <DocCard key={d.id} doc={d} route="std" />)}
                  </div>
                )}
              </div>

              {res.hof.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-bold text-gray-900 mb-1">HoF-based route <span className="text-gray-500 font-medium text-sm">({hof.length})</span></h3>
                  <p className="text-xs text-gray-500 mb-3">Relationship proof via the Head of Family.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {hof.map((d) => <DocCard key={`h-${d.id}`} doc={d} route="hof" />)}
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

const DocumentGallery = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDocs = useMemo(() => {
    return AADHAAR_DOCUMENTS.filter((doc) => {
      if (activeTab === 'poi' && !doc.poi) return false;
      if (activeTab === 'poa' && !doc.poa) return false;
      if (activeTab === 'por' && !doc.por) return false;
      if (activeTab === 'pdb' && !doc.pdb) return false;
      
      const q = searchQuery.toLowerCase();
      if (q) return doc.name.toLowerCase().includes(q) || doc.notes.toLowerCase().includes(q);
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
            <input
              type="text"
              placeholder="Search all 43 UIDAI documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-navy-500 focus:outline-none transition-all"
            />
          </div>
          <div className="flex overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 gap-2 scrollbar-hide">
            {GAL_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.id ? 'bg-navy-700 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.id === 'all' && <FiFilter className="inline mr-2 mb-0.5" />}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredDocs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 border-dashed">
          <FiFileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-900">No documents found</h3>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence>
            {filteredDocs.map((doc) => (
              <DocCard key={doc.id} doc={doc} route="gallery" />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};

// =====================================================================
// 5. MAIN PAGE COMPONENT
// =====================================================================

const TABS = [
  { id: 'procedure', label: 'Procedure Finder', icon: FiCalendar, blurb: 'Name or DOB exact procedures' },
  { id: 'wizard', label: 'Requirements Wizard', icon: FiMapPin, blurb: 'Contextual docs for your update' },
  { id: 'gallery', label: 'Full Document Gallery', icon: FiBookOpen, blurb: 'Browse all 43 valid UIDAI documents' },
];

const AadhaarDocu = () => {
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
    setTab('wizard');
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
              <Link to="/login" className="px-5 py-2 bg-gradient-to-r from-navy-600 to-navy-700 text-white rounded-xl hover:shadow-lg transition-all font-medium text-sm">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <header className="pt-16 bg-gradient-to-br from-navy-900 to-navy-700 text-white print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-block px-3 py-1 rounded-full bg-white/15 text-xs font-semibold mb-3">
              UIDAI List of Acceptable Documents (List IV)
            </span>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Aadhaar Document Suite</h1>
            <p className="text-navy-100 max-w-2xl">
              Find exact procedures for demographic changes, run contextual requirement wizards, or browse the complete gallery of acceptable government documents.
            </p>
          </motion.div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 print:hidden">
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
        {tab === 'wizard' && <DocumentsWizard preset={preset} presetKey={presetKey} />}
        {tab === 'gallery' && <DocumentGallery />}

        <div className="mt-8 flex items-start p-4 rounded-xl bg-white border border-gray-200 text-xs text-gray-600 print:hidden">
          <FiInfo className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0 text-navy-600" />
          <p>
            This tool summarises the UIDAI documents it was built from and may not reflect later circulars. Always confirm with the latest UIDAI SoP before submitting a request.
            <a href="https://uidai.gov.in/images/SOP_for_DOB_update.pdf" target="_blank" rel="noreferrer" className="text-navy-600 font-medium inline-flex items-center hover:underline ml-1">DOB SoP <FiExternalLink className="h-3 w-3 ml-1" /></a>
            <span className="mx-1">|</span>
            <a href="https://uidai.gov.in/images/SOP_28.10.2021-Name_And_Gender_UpdateRequest_under_Exception_Handling_Process.pdf" target="_blank" rel="noreferrer" className="text-navy-600 font-medium inline-flex items-center hover:underline">Name &amp; Gender SoP <FiExternalLink className="h-3 w-3 ml-1" /></a>
          </p>
        </div>
      </main>

      <footer className="bg-gradient-to-br from-navy-900 to-navy-800 text-navy-200 text-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>&copy; {new Date().getFullYear()} Akshaya e-Centre Pukayur</p>
          <Link to="/" className="hover:text-white transition-colors">Back to home</Link>
        </div>
      </footer>
      
      <style>{`
        .bg-navy-50 { background-color: #f0f4f8; }
        .text-navy-600 { color: #2c5282; }
        .text-navy-700 { color: #1e3a5f; }
        .bg-navy-700 { background-color: #1e3a5f; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default AadhaarDocu;