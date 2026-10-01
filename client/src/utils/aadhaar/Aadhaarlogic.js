// Logic for the Aadhaar Docu Finder page.
// This is a direct port of the formulas in Aadhaar_Update_Procedure_Finder.xlsx
// (Lookup, Calc, DocList and DocCalc tabs). Keep the two in step if a rule changes.
import { SCENARIOS } from '../aadhaar/Aadhaarscenarios.js';
import { DOCUMENTS, DOC_NOTES } from '../aadhaar/Aadhaardocuments.js';

// ---------------------------------------------------------------------
// Option lists (same values as the Lists tab)
// ---------------------------------------------------------------------
export const CHANGE_TYPES = ['Name Change', 'DOB Change'];

export const AGE_GROUPS = ['Adult (18+)', 'Minor (under 18)'];

// reason.code = scenario code, or null = work it out from the old / new name
export const NAME_REASONS = [
  { id: 'spelling', label: 'Spelling / format correction', code: null },
  { id: 'firstCorrection', label: 'First name correction (spelling / phonetic variant)', code: '(d)' },
  { id: 'firstChange', label: 'First name change (a different name)', code: '(o)' },
  { id: 'marriage', label: 'Surname change after marriage or divorce', code: '(h)' },
  { id: 'gender', label: 'Change of name due to change of gender', code: '(i)' },
  { id: 'wrongRecord', label: 'Name recorded wrongly (earlier document has the correct name)', code: '(f)' },
  { id: 'regional', label: 'Regional-language spelling error only', code: '(g)' },
  { id: 'complete', label: 'Complete change of name / identity', code: '(o)' },
  { id: 'baby', label: 'Baby of (name) changed to actual name', code: '(j)' },
];

export const DOB_STATUSES = [
  'Declared / Approximate',
  'Verified - Birth Certificate',
  'Verified - Other PDB document',
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
  'Foreign national without passport (FRRO/FRO)',
];
export const DOC_CATEGORIES = [
  'Adult (18+)',
  'Minor (under 18)',
  'Child in Child Care Institution (CCI)',
  'Destitute person with disability (18+)',
  'Prisoner',
];

// Ranks / titles named in scenario (k) of the source
const TITLES = ['lt', 'maj', 'brig', 'col', 'sub', 'nb', 'hav', 'nk', 'l', 'justice', 'prof', 'retd',
  'dr', 'learned', 'ld', 'shri', 'smt', 'ms', 'mr'];

const SCENARIO_BY_CODE = Object.fromEntries(SCENARIOS.map((s) => [s.code, s]));
export const getScenario = (code) => SCENARIO_BY_CODE[code] || null;

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
const squash = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');            // Excel TRIM
const norm = (s) => squash(String(s ?? '').replace(/\./g, '')).toLowerCase(); // lowercase, no dots

const parseDate = (v) => {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
};

// whole years between two dates (same as DATEDIF(...,"Y"))
export const completedYears = (from, to) => {
  let y = to.getFullYear() - from.getFullYear();
  if (to.getMonth() < from.getMonth() ||
      (to.getMonth() === from.getMonth() && to.getDate() < from.getDate())) y -= 1;
  return y;
};

const startOfToday = () => {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
};

const NONE = 'None listed in the source sheet';
const NOT_SPECIFIED = 'Not specified in the source sheet';

// ---------------------------------------------------------------------
// Name change
// ---------------------------------------------------------------------
export function analyseName(oldName, newName) {
  const oldRaw = squash(oldName);
  const newRaw = squash(newName);
  const oldWordsRaw = oldRaw ? oldRaw.split(' ').slice(0, 8) : [];
  const newWordsRaw = newRaw ? newRaw.split(' ').slice(0, 8) : [];
  const oldWords = oldWordsRaw.map((w) => w.replace(/\./g, '').toLowerCase()).filter(Boolean);
  const newWords = newWordsRaw.map((w) => w.replace(/\./g, '').toLowerCase()).filter(Boolean);
  const oldNorm = norm(oldName);
  const newNorm = norm(newName);
  const nOld = oldWords.length;
  const nNew = newWords.length;
  const oldInNew = oldWords.filter((w) => newWords.includes(w)).length;
  const newInOld = newWords.filter((w) => oldWords.includes(w)).length;
  const firstOld = oldWords[0] || '';
  const firstNew = newWords[0] || '';

  const flags = {
    urf: ` ${oldNorm} `.includes(' urf ') || ` ${oldNorm} `.includes(' alias '),
    prefix: nOld > nNew && nNew > 0 && newInOld === nNew && firstOld !== '' && TITLES.includes(firstOld),
    dots: oldRaw.includes('.') && oldNorm.replace(/ /g, '') === newNorm.replace(/ /g, ''),
    caps: oldRaw.toLowerCase() === newRaw.toLowerCase() && oldRaw !== newRaw,
    reorder: nOld === nNew && nOld > 0 && oldInNew === nOld && oldNorm !== newNorm,
    subset: nOld !== nNew && nOld > 0 && nNew > 0 && (oldInNew === nOld || newInOld === nNew),
  };
  return {
    flags,
    firstOldRaw: oldWordsRaw[0] || '',
    firstNewRaw: newWordsRaw[0] || '',
    firstNameDiffers: firstOld !== '' && firstNew !== '' && firstOld !== firstNew,
    restOld: oldNorm.slice(firstOld.length).trim(),
    restNew: newNorm.slice(firstNew.length).trim(),
  };
}

export function detectNameScenario({ oldName, newName, reasonId }) {
  const reason = NAME_REASONS.find((r) => r.id === reasonId);
  if (!reason) return '';
  if (reason.code) return reason.code;
  const { flags } = analyseName(oldName, newName);
  if (flags.urf) return '(n)';
  if (flags.prefix) return '(k)';
  if (flags.dots) return '(m)';
  if (flags.caps) return '(l)';
  if (flags.reorder) return '(c)';
  if (flags.subset) return '(b)';
  return '(e)';
}

export function checkNameInput({ oldName, newName, reasonId, ageGroup }) {
  if (!squash(oldName) || !squash(newName)) return 'Enter the old name and the required name';
  if (squash(oldName) === squash(newName)) return 'Old and required names are identical - nothing to change';
  if (!reasonId) return 'Select the reason for the change';
  if (!ageGroup) return 'Select the applicant age group';
  if (reasonId === 'firstCorrection') {
    const a = analyseName(oldName, newName);
    if (a.restOld !== a.restNew) {
      return 'For a first-name correction only the first name should differ. Use Spelling / format correction for other changes.';
    }
  }
  return 'OK';
}

// ---------------------------------------------------------------------
// DOB change
// ---------------------------------------------------------------------
export function dobAges({ oldDob, enrolDate, newDob }) {
  const o = parseDate(oldDob);
  const e = parseDate(enrolDate);
  const n = parseDate(newDob);
  return {
    ageAtEnrolment: o && e && e >= o ? completedYears(o, e) : null,
    requestedAge: n && e && e >= n ? completedYears(n, e) : null,
    currentAge: o ? completedYears(o, startOfToday()) : null,
  };
}

export function checkDobInput(f) {
  const o = parseDate(f.oldDob);
  const e = parseDate(f.enrolDate);
  const n = parseDate(f.newDob);
  if (!f.oldDob || !f.enrolDate || !f.newDob) return 'Enter the old DOB, enrollment date and required DOB';
  if (!o || !e || !n) return 'Dates must be real dates, e.g. 12-May-2012';
  if (e < o) return 'Enrollment date is before the old DOB';
  if (n > e) return 'Required DOB is after the enrollment date';
  if (n > startOfToday()) return 'Required DOB is in the future';
  if (!f.dobStatus) return 'Select the DOB status recorded in Aadhaar';
  if (f.prevUpdates === '' || f.prevUpdates == null || !f.residentType || !f.operatorError) {
    return 'Fill in previous updates, resident type and operator-error fields';
  }
  if (f.residentType === 'Resident foreigner' && f.operatorError === 'No') {
    return 'Not covered: the source sheet lists resident-foreigner DOB rules only for operator-error cases (Case 5 a)';
  }
  if (f.residentType === 'NRI' && Number(f.prevUpdates) === 0 && f.operatorError === 'No') {
    return "Not covered: the source sheet's first-time DOB rules (Case 1) are for Indian residents only";
  }
  return 'OK';
}

export function detectDobScenario(f) {
  const { ageAtEnrolment: a, requestedAge: r } = dobAges(f);
  const prev = Number(f.prevUpdates);
  if (f.operatorError === 'Yes') {
    if (f.residentType === 'Resident foreigner') return 'Case 5 a)';
    return prev === 0 ? 'Case 1 c)' : 'Case 2 b)';
  }
  if (prev >= 1) {
    if (a >= 5 && a < 18 && r >= 18) return 'Case 4 a)';
    if (a < 5 && r > 5 && r < 18) return 'Case 3 a)';
    if (a < 5 && r >= 18) return 'Case 3 b)';
    return 'Case 2 a)';
  }
  if (f.dobStatus === 'Declared / Approximate') return 'Case 1 a)';
  if (f.dobStatus === 'Verified - Birth Certificate') return 'Case 1 b) i)';
  return 'Case 1 b) ii)';
}

// ---------------------------------------------------------------------
// Procedure finder (Lookup tab)
// ---------------------------------------------------------------------
export function findProcedure(mode, f) {
  const isName = mode === 'Name Change';
  const check = isName ? checkNameInput(f) : checkDobInput(f);
  const empty = { check, code: '', scenario: null };
  if (check !== 'OK') return empty;

  const detected = isName ? detectNameScenario(f) : detectDobScenario(f);
  const code = isName && f.overrideCode ? f.overrideCode : detected;
  const scenario = getScenario(code);
  if (!scenario) return { ...empty, check: `No scenario found for code ${code}` };

  const ages = isName ? null : dobAges(f);
  const isMinor = isName ? f.ageGroup === AGE_GROUPS[1] : ages.currentAge < 18;

  // note for this applicant
  let note = '';
  if (code === 'Case 1 a)') {
    note = isMinor
      ? `Applicant is under 18 (current age ${ages.currentAge}): a Birth Certificate is mandatory.`
      : `Applicant is 18 or above (current age ${ages.currentAge}): any permitted PDB document from List-IV can be used.`;
  } else if (code === 'Case 1 b) ii)') {
    if (isMinor) note = 'The source says this case does not apply to children below 18. Re-check the DOB status selected.';
  } else if (['(a)', '(b)', '(c)', '(d)', '(e)'].includes(code)) {
    if (['(a)', '(d)', '(e)'].includes(code)) {
      const a = analyseName(f.oldName, f.newName);
      if (a.firstNameDiffers) {
        note += `FIRST NAME CHECK: it changes from ${a.firstOldRaw} to ${a.firstNewRaw}. Only spelling, abbreviation or phonetic variants qualify as a minor change. If the new first name is really a different name, choose 'Complete change of name / identity' instead (Gazette Notification needed). `;
      }
    }
    note += isMinor
      ? 'Applicant is a minor: this is a HoF-based update, so the applicable PoR is needed along with PoI.'
      : 'Applicant is an adult: PoI is needed. PoR applies only to HoF-based updates of children under 18.';
  }

  return {
    check,
    code,
    detectedCode: detected,
    isMinor,
    currentAge: ages ? ages.currentAge : null,
    scenario: {
      ...scenario,
      annexure: (isMinor ? scenario.annexureMinor : scenario.annexureAdult) || NONE,
      documents: scenario.documents || NOT_SPECIFIED,
      description: scenario.description || NOT_SPECIFIED,
      appliesTo: scenario.appliesTo || NOT_SPECIFIED,
      exceptions: scenario.exceptions || NOT_SPECIFIED,
      examples: scenario.examples || 'None given in the source sheet',
    },
    note: note.trim(),
  };
}

// ---------------------------------------------------------------------
// Documents finder (Documents / DocList / DocCalc tabs)
// ---------------------------------------------------------------------
export function checkDocInput({ updateType, residentType, category, dobStatus }) {
  if (!updateType || !residentType || !category) return 'Select the update type, resident type and applicant category';
  if (updateType === 'Date of Birth' && !dobStatus) return 'Select the DOB status recorded in Aadhaar';
  const indNri = residentType === 'Indian resident' || residentType === 'NRI';
  if (!indNri && category !== DOC_CATEGORIES[0] && category !== DOC_CATEGORIES[1]) {
    return 'Not covered: the source lists the special-category certificates (CCI child, destitute person with disability, prisoner) for Indian residents / NRIs only';
  }
  return 'OK';
}

export function findDocuments(input) {
  const { updateType, residentType, category, dobStatus } = input;
  const check = checkDocInput(input);
  if (check !== 'OK') return { check, standard: [], hof: [], notes: [], proofNeeded: '' };

  const isMinor = category === DOC_CATEGORIES[1] || category === DOC_CATEGORIES[2];
  const indNri = residentType === 'Indian resident' || residentType === 'NRI';
  const catOk = (d) => d.categories.length === 0 || d.categories.includes(category);
  const proofKey = updateType === 'Name' ? 'poi' : updateType === 'Address' ? 'poa' : 'pdb';

  const dobOk = (d) => {
    if (updateType !== 'Date of Birth') return true;
    if (dobStatus === DOB_STATUSES[1] && indNri) return d.dobBcOnly;
    if (dobStatus === DOB_STATUSES[0] && isMinor && residentType === 'Indian resident') return d.dobBcOnly;
    if (dobStatus === DOB_STATUSES[0] && isMinor && residentType === 'NRI') return d.dobBcOrPassport;
    return true;
  };

  const standard = DOCUMENTS.filter((d) => {
    const applies = updateType === 'Address' ? d.appliesPoa : d.appliesMain;
    return d[proofKey] && applies.includes(residentType) && catOk(d) && dobOk(d);
  });

  let hof = [];
  if (updateType === 'Name' && isMinor) {
    hof = DOCUMENTS.filter((d) => d.minorNameHof && d.appliesMain.includes(residentType) && catOk(d));
  } else if (updateType === 'Address') {
    hof = DOCUMENTS.filter((d) => d.por && !d.poa && d.appliesMain.includes(residentType) && catOk(d));
  }

  // notes (keys as on the DocCalc tab)
  let main;
  let related = '';
  let sop;
  if (updateType === 'Name') {
    main = isMinor ? 'NAME_MINOR' : 'NAME_ADULT';
    related = isMinor ? 'NAME_BABY' : '';
    sop = 'SOP_NAME';
  } else if (updateType === 'Address') {
    main = 'ADDR_PLAIN';
    related = indNri ? 'ADDR_HOF' : 'ADDR_FOREIGN';
    sop = 'ADDR_FORMS';
  } else {
    if (!indNri) main = 'DOB_FOREIGN';
    else if (dobStatus === DOB_STATUSES[1]) main = 'DOB_EARLIER_BC';
    else if (dobStatus === DOB_STATUSES[2]) main = 'DOB_EARLIER_OTHER';
    else if (isMinor) main = residentType === 'Indian resident' ? 'DOB_IND_MINOR' : 'DOB_NRI_MINOR';
    else main = 'DOB_ADULT';
    related = 'DOB_MARRIAGE';
    sop = 'SOP_DOB';
  }
  const notes = [
    { label: 'Main rule', text: DOC_NOTES[main] },
    related && { label: 'Related rule', text: DOC_NOTES[related] },
    { label: 'SoP / form reference', text: DOC_NOTES[sop] },
    { label: 'General conditions', text: DOC_NOTES.GEN },
  ].filter(Boolean);

  let proofNeeded;
  if (updateType === 'Name') {
    proofNeeded = 'Proof of Identity (PoI) showing the new name and photograph' +
      (isMinor ? '; minors can also use the Head of Family (HoF) route with Proof of Relationship (PoR) documents' : '');
  } else if (updateType === 'Address') {
    proofNeeded = 'Proof of Address (PoA)' +
      (indNri ? '; if no PoA document is available, the Head of Family (HoF) route with Proof of Relationship (PoR) is possible' : '');
  } else {
    proofNeeded = 'Proof of Date of Birth (PDB)';
  }

  // the "display note" column of DocList
  const noteFor = (d) => {
    const nameUse = updateType === 'Name' && d.nameUse ? `${d.nameUse}. ` : '';
    const cond = updateType === 'Date of Birth'
      ? d.conditions
      : d.conditions.replace(' DOB conditions (#) apply.', '').replace('DOB conditions (#) apply.', '').trim();
    return `${nameUse}${cond}`.trim();
  };

  return {
    check,
    isMinor,
    proofNeeded,
    notes,
    standard: standard.map((d) => ({ ...d, displayNote: noteFor(d) })),
    hof: hof.map((d) => ({ ...d, displayNote: noteFor(d) })),
  };
}