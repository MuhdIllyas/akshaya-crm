// src/utils/aadhaarLogic.js

// ---------------------------------------------------------------------
// STATIC LISTS & MAPPINGS (Extracted from 'Lists' tab)
// ---------------------------------------------------------------------
export const CHANGE_TYPES = ['Name Change', 'DOB Change'];
export const AGE_GROUPS = ['Adult (18+)', 'Minor (under 18)'];
export const DOB_STATUSES = [
  'Declared / Approximate',
  'Verified - Birth Certificate',
  'Verified - Other PDB document'
];
export const DOB_RESIDENT_TYPES = ['Indian resident', 'NRI', 'Resident foreigner'];

export const DOC_UPDATE_TYPES = ['Name', 'Address', 'Date of Birth'];
export const DOC_RESIDENT_TYPES = [
  'Indian resident',
  'NRI',
  'OCI cardholder',
  'Nepal / Bhutan national',
  'Long Term Visa (LTV) holder',
  'Other foreign national',
  'Foreign national without passport (FRRO/FRO)'
];
export const DOC_CATEGORIES = [
  'Adult (18+)',
  'Minor (under 18)',
  'Child in Child Care Institution (CCI)',
  'Destitute person with disability (18+)',
  'Prisoner'
];

export const NAME_REASONS = [
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

const PREFIXES_TO_DROP = [
  'lt', 'maj', 'brig', 'col', 'sub', 'nb', 'hav', 'nk', 'l', 'justice',
  'dr', 'mr', 'mrs', 'ms', 'shri', 'smt', 'kumari', 'babu', 'prof'
];

// ---------------------------------------------------------------------
// SCENARIO DATA (Combined from 'Data' and 'Rules' tabs)
// ---------------------------------------------------------------------
export const SCENARIOS = {
  '(a)': {
    code: '(a)',
    category: 'Minor Name Change',
    description: 'Expanding the abbreviation or abbreviating the name to initials',
    appliesTo: 'All residents / Minors (<18 yrs for HoF)',
    examples: 'T R D Prasad to Tadi Rama Durga Prasad; Ram Mohan Naidu to RM Naidu or Naidu RM or R M Naidu',
    documents: 'PoI / Applicable PoR in cases of HoF-based name update of children (less than 18 years)',
    exceptions: 'Name shall be updated as per the spelling, sequence, abbreviation etc. mentioned in the submitted document.',
    status: 'Proceed',
    adultAnnexure: 'None listed in the source sheet',
    minorAnnexure: 'None listed in the source sheet',
    source: 'SoP for Name Update dt 18Sep2026.pdf'
  },
  '(b)': {
    code: '(b)',
    category: 'Minor Name Change',
    description: 'Addition or deletion of middle name(s) or last name',
    appliesTo: 'All residents / Minors (<18 yrs for HoF)',
    examples: 'Addition: Himanshu Gupta to Himanshu Chandra Gupta; Deletion: Himanshu Chandra Gupta to Himanshu Gupta',
    documents: 'PoI / Applicable PoR in cases of HoF-based name update of children (less than 18 years)',
    exceptions: 'Name shall be updated as per the spelling, sequence, abbreviation etc. mentioned in the submitted document.',
    status: 'Proceed',
    adultAnnexure: 'None listed in the source sheet',
    minorAnnexure: 'None listed in the source sheet',
    source: 'SoP for Name Update dt 18Sep2026.pdf'
  },
  '(c)': {
    code: '(c)',
    category: 'Minor Name Change',
    description: 'Change in sequential order',
    appliesTo: 'All residents / Minors (<18 yrs for HoF)',
    examples: 'Divakar Anand to Anand Divakar; Ravi Kishan to Kishan Ravi',
    documents: 'PoI / Applicable PoR in cases of HoF-based name update of children (less than 18 years)',
    exceptions: 'Name shall be updated as per the spelling, sequence, abbreviation etc. mentioned in the submitted document.',
    status: 'Proceed',
    adultAnnexure: 'None listed in the source sheet',
    minorAnnexure: 'None listed in the source sheet',
    source: 'SoP for Name Update dt 18Sep2026.pdf'
  },
  '(d)': {
    code: '(d)',
    category: 'Minor Name Change',
    description: 'Minor correction in English spelling, however names are phonetically similar',
    appliesTo: 'All residents / Minors (<18 yrs for HoF)',
    examples: 'Ram to Rama; Sitaram to Sita Ram; Somya to Saumya',
    documents: 'PoI / Applicable PoR in cases of HoF-based name update of children (less than 18 years)',
    exceptions: 'Name shall be updated as per the spelling, sequence, abbreviation etc. mentioned in the submitted document.',
    status: 'Proceed',
    adultAnnexure: 'None listed in the source sheet',
    minorAnnexure: 'None listed in the source sheet',
    source: 'SoP for Name Update dt 18Sep2026.pdf'
  },
  '(e)': {
    code: '(e)',
    category: 'Minor Name Change',
    description: 'Any combination of (a), (b), (c) and (d)',
    appliesTo: 'All residents / Minors (<18 yrs for HoF)',
    examples: 'Not in source',
    documents: 'PoI / Applicable PoR in cases of HoF-based name update of children (less than 18 years)',
    exceptions: 'Name shall be updated as per the spelling, sequence, abbreviation etc. mentioned in the submitted document.',
    status: 'Proceed',
    adultAnnexure: 'None listed in the source sheet',
    minorAnnexure: 'None listed in the source sheet',
    source: 'SoP for Name Update dt 18Sep2026.pdf'
  },
  '(h)': {
    code: '(h)',
    category: 'Name Change (Baby)',
    description: 'Baby of (Name) to Actual Name',
    appliesTo: 'Minors enrolled before giving a name',
    examples: 'Baby of Kavita to Shweta',
    documents: 'Birth Certificate (mandatory) + applicable PoR document',
    exceptions: 'Must be done before age 5, or requires exception handling.',
    status: 'Proceed',
    adultAnnexure: 'Annexure D',
    minorAnnexure: 'Annexure D',
    source: 'SoP for Name Update dt 18Sep2026.pdf'
  },
  '(o)': {
    code: '(o)',
    category: 'Major Name Change',
    description: 'Complete change of name / change of identity',
    appliesTo: 'Not specified in the source sheet',
    examples: 'Ram Gupta to Shyam Gupta; Amisha Patel to Ameesha Kumar Singh',
    documents: 'PoI (only Gazette Notification for name change)',
    exceptions: 'Complete change in name / change of identity is liable to be rejected if not accompanied by a Gazette Notification.',
    status: 'Proceed',
    adultAnnexure: 'None listed in the source sheet',
    minorAnnexure: 'None listed in the source sheet',
    source: 'SoP for Name Update dt 18Sep2026.pdf'
  },
  // Default fallback for unknown cases
  'unknown': {
    code: 'unknown',
    category: 'Manual Review Required',
    description: 'This specific change combination does not match a standard automated rule.',
    appliesTo: 'N/A',
    examples: 'N/A',
    documents: 'Standard PoI/PoR based on the update type.',
    exceptions: 'Check with UIDAI RO / standard SoP circulars.',
    status: 'Review Required',
    adultAnnexure: 'Check current SoP',
    minorAnnexure: 'Check current SoP',
    source: 'N/A',
    blocked: true
  }
};

export const getScenario = (code) => SCENARIOS[code] || SCENARIOS['unknown'];

// ---------------------------------------------------------------------
// LOGIC FUNCTIONS
// ---------------------------------------------------------------------

/**
 * Normalizes a name string by removing extra spaces, dots, and common prefixes.
 */
const normalizeName = (name) => {
  if (!name) return '';
  let clean = name.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Remove prefixes
  let parts = clean.split(' ');
  while (parts.length > 0 && PREFIXES_TO_DROP.includes(parts[0])) {
    parts.shift();
  }
  return parts.join(' ');
};

/**
 * Detects the applicable name scenario code based on the old and new name.
 */
export const detectNameScenario = (form) => {
  if (form.overrideCode) return form.overrideCode;
  
  const reason = form.reasonId;
  if (reason === 'complete' || reason === 'first_new' || reason === 'gender' || reason === 'marriage') {
    return '(o)';
  }
  if (reason === 'baby') {
    return '(h)';
  }

  const oldN = normalizeName(form.oldName);
  const newN = normalizeName(form.newName);
  
  if (!oldN || !newN) return '';

  const oldParts = oldN.split(' ');
  const newParts = newN.split(' ');

  // Very basic detection logic (for a full production app, you'd use a more robust phonetic/distance algo)
  if (oldParts.length === newParts.length && oldN !== newN) {
    // Check if it's just sequential order change
    if ([...oldParts].sort().join(' ') === [...newParts].sort().join(' ')) return '(c)';
    // Otherwise assume minor spelling change (d) or abbreviation expansion (a)
    return '(d)'; 
  }

  if (newParts.length > oldParts.length || oldParts.length > newParts.length) {
    return '(b)'; // Addition or deletion
  }

  return '(e)'; // Fallback combination
};

/**
 * Evaluates the required procedure based on the input form.
 */
export const findProcedure = (mode, form) => {
  const isName = mode === CHANGE_TYPES[0];
  let code = '';
  let scenario = null;
  let check = 'OK';
  let note = '';
  let isMinor = false;

  if (isName) {
    if (!form.oldName || !form.newName) {
      return { check: 'Missing required inputs', code: '', scenario: null };
    }
    isMinor = form.ageGroup === AGE_GROUPS[1];
    code = detectNameScenario(form);
    scenario = getScenario(code);

    if (scenario.blocked) check = 'BLOCKED';

  } else {
    // DOB Logic
    if (!form.oldDob || !form.enrolDate || !form.newDob) {
      return { check: 'Missing required dates', code: '', scenario: null };
    }
    isMinor = form.residentType === 'Indian resident' ? false : true; // Simplify based on form if needed
    
    // Calculate ages (simplified)
    const oldYear = parseInt(form.oldDob.split('-')[0]);
    const enrolYear = parseInt(form.enrolDate.split('-')[0]);
    const ageAtEnrolment = enrolYear - oldYear;

    if (parseInt(form.prevUpdates) >= 1) {
      check = 'Exception Handling Required - DOB already updated once.';
      code = 'DOB_EXCEPTION';
      scenario = {
        category: 'DOB Update Exception',
        description: 'Updating DOB more than once',
        documents: 'Birth Certificate + Self Declaration + RO Approval',
        annexure: 'Self Declaration Format',
        exceptions: 'Must be routed through UIDAI Regional Office.',
        blocked: true
      };
    } else {
      code = 'DOB_STANDARD';
      scenario = {
        category: 'Standard DOB Update',
        description: 'First time DOB update',
        documents: 'Birth Certificate / Valid Passport / PAN Card / SSLC Book',
        annexure: 'None',
        exceptions: 'Document must match the required DOB exactly.',
      };
    }
  }

  if (scenario) {
    scenario.annexure = isMinor ? scenario.minorAnnexure : scenario.adultAnnexure;
  }

  return {
    code,
    check,
    note,
    isMinor,
    scenario
  };
};

/**
 * Simplified document lookup based on the DocList tab.
 */
export const findDocuments = (form) => {
  const { updateType, residentType, category, dobStatus } = form;
  
  if (!updateType || !residentType || !category) {
    return { check: 'Missing inputs', proofNeeded: '', standard: [], hof: [], notes: [] };
  }

  let proofNeeded = '';
  if (updateType === 'Name') proofNeeded = 'Proof of Identity (PoI)';
  else if (updateType === 'Address') proofNeeded = 'Proof of Address (PoA)';
  else if (updateType === 'Date of Birth') proofNeeded = 'Proof of Date of Birth (PDB)';

  // Static mock subset of documents from DocList
  const allDocs = [
    { sl: 1, name: 'Valid Indian Passport', poi: true, poa: true, por: true, pdb: true, displayNote: 'Valid Indian passport. DOB conditions apply.' },
    { sl: 2, name: 'Ration / PDS Photograph Card', poi: true, poa: true, por: true, pdb: false, displayNote: '' },
    { sl: 3, name: 'Voter Identity Card', poi: true, poa: true, por: false, pdb: false, displayNote: 'Must be displayed online on ECI website.' },
    { sl: 4, name: 'Driving licence', poi: true, poa: false, por: false, pdb: false, displayNote: '' },
    { sl: 5, name: 'Birth Certificate', poi: false, poa: false, por: true, pdb: true, displayNote: 'Issued by Registrar of Births and Deaths.' },
    { sl: 6, name: 'PAN Card / e-PAN Card', poi: true, poa: false, por: false, pdb: false, displayNote: '' },
  ];

  let standard = [];
  let hof = [];

  allDocs.forEach(doc => {
    let matchesStd = false;
    let matchesHof = false;

    if (updateType === 'Name' && doc.poi) matchesStd = true;
    if (updateType === 'Address' && doc.poa) matchesStd = true;
    if (updateType === 'Date of Birth' && doc.pdb) matchesStd = true;

    // HoF route applies mostly to PoR (Proof of Relationship)
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
    notes: [
      { label: 'Important Note', text: 'Ensure the document is valid and explicitly matches the requested demographic update.' }
    ]
  };
};