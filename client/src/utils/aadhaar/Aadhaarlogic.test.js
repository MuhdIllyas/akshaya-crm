// Run with:  node src/utils/aadhaarLogic.test.js
// Same scenarios that were checked against the Excel workbook.
import assert from 'node:assert/strict';
import {
  findProcedure, findDocuments, DOC_CATEGORIES as C, DOB_STATUSES as S,
} from './Aadhaarlogic.js';

let pass = 0;
const ok = (name, fn) => { fn(); pass += 1; console.log('PASS', name); };

const nameCase = (o, n, reasonId = 'spelling', ageGroup = 'Adult (18+)') =>
  findProcedure('Name Change', { oldName: o, newName: n, reasonId, ageGroup, overrideCode: '' });
const dobCase = (oldDob, enrolDate, newDob, o = {}) =>
  findProcedure('DOB Change', {
    oldDob, enrolDate, newDob, dobStatus: S[0], prevUpdates: 0,
    residentType: 'Indian resident', operatorError: 'No', ...o,
  });

// ---- Name (same 13 cases as the Excel tests) ----
const names = [
  ['dots', 'R.V.N Srinivas', 'RVN Srinivas', 'spelling', '(m)'],
  ['dots2', 'R P Singh.', 'R P Singh', 'spelling', '(m)'],
  ['caps', 'RaMesh', 'Ramesh', 'spelling', '(l)'],
  ['urf', 'Jagdish Singh urf Jagga', 'Jagdish Singh', 'spelling', '(n)'],
  ['prefix', 'Dr Ramesh Kumar', 'Ramesh Kumar', 'spelling', '(k)'],
  ['reorder', 'Divakar Anand', 'Anand Divakar', 'spelling', '(c)'],
  ['add middle', 'Himanshu Gupta', 'Himanshu Chandra Gupta', 'spelling', '(b)'],
  ['drop first', 'Lakshmi Jyoti Swaroopini', 'Jyoti Swaroopini', 'spelling', '(b)'],
  ['phonetic', 'Pooja Singh', 'Puja Singh', 'spelling', '(e)'],
  ['abbreviation', 'Ram Mohan Naidu', 'RM Naidu', 'spelling', '(e)'],
  ['marriage', 'Amisha Patel', 'Amisha Singh', 'marriage', '(h)'],
  ['complete', 'Ram Gupta', 'Shyam Gupta', 'complete', '(o)'],
  ['first correction', 'Somya Sharma', 'Saumya Sharma', 'firstCorrection', '(d)'],
  ['first change', 'Ramesh Kumar', 'Suresh Kumar', 'firstChange', '(o)'],
];
names.forEach(([n, o, nw, r, code]) => ok(`name ${n}`, () => assert.equal(nameCase(o, nw, r).code, code)));
ok('name identical -> check message', () => assert.notEqual(nameCase('Ram Gupta', 'Ram Gupta').check, 'OK'));
ok('first-name correction with another word changed -> check message',
  () => assert.match(nameCase('Somya Sharma', 'Saumya Verma', 'firstCorrection').check, /only the first name/));
ok('first name check note shown for (e)', () =>
  assert.match(nameCase('Pooja Singh', 'Puja Singh').note, /FIRST NAME CHECK/));

// ---- DOB (same cases as the Excel tests) ----
const dobs = [
  ['op error first-time', ['2012-05-12', '2014-01-15', '2011-09-03', { operatorError: 'Yes' }], 'Case 1 c)'],
  ['op error repeat', ['2012-05-12', '2014-01-15', '2011-09-03', { operatorError: 'Yes', prevUpdates: 1 }], 'Case 2 b)'],
  ['foreigner op error', ['1990-05-12', '2014-01-15', '1991-09-03', { operatorError: 'Yes', residentType: 'Resident foreigner' }], 'Case 5 a)'],
  ['3a', ['2007-01-01', '2010-01-01', '2000-01-01', { prevUpdates: 1 }], 'Case 3 a)'],
  ['3b', ['2007-01-01', '2010-01-01', '1985-01-01', { prevUpdates: 1 }], 'Case 3 b)'],
  ['4a', ['2000-01-01', '2010-01-01', '1985-01-01', { prevUpdates: 1 }], 'Case 4 a)'],
  ['2a', ['1990-01-01', '2012-01-01', '1991-01-01', { prevUpdates: 1 }], 'Case 2 a)'],
  ['1a', ['2012-05-12', '2014-01-15', '2011-09-03', {}], 'Case 1 a)'],
  ['1b i', ['1990-01-01', '2012-01-01', '1991-01-01', { dobStatus: S[1] }], 'Case 1 b) i)'],
  ['1b ii', ['1990-01-01', '2012-01-01', '1991-01-01', { dobStatus: S[2] }], 'Case 1 b) ii)'],
];
dobs.forEach(([n, a, code]) => ok(`dob ${n}`, () => assert.equal(dobCase(...a).code, code)));
ok('dob NRI first-time -> not covered', () =>
  assert.match(dobCase('1990-01-01', '2012-01-01', '1991-01-01', { residentType: 'NRI' }).check, /^Not covered/));
ok('dob enrolment before birth -> check message', () =>
  assert.notEqual(dobCase('1990-01-01', '1980-01-01', '1991-01-01').check, 'OK'));
ok('blocked flag + annexure', () => {
  assert.equal(dobCase('2007-01-01', '2010-01-01', '2000-01-01', { prevUpdates: 1 }).scenario.blocked, true);
  assert.equal(nameCase('Amisha Patel', 'Amisha Singh', 'marriage').scenario.annexure, 'Annexure D');
});

// ---- Documents (same 17 cases as the Excel tests) ----
const A = C[0]; const M = C[1]; const CCI = C[2]; const DST = C[3]; const PR = C[4];
const DEC = S[0];
const docs = [
  ['name adult', ['Name', 'Indian resident', A, DEC], 16, 0],
  ['name minor', ['Name', 'Indian resident', M, DEC], 16, 2],
  ['name destitute', ['Name', 'Indian resident', DST, DEC], 17, 0],
  ['name CCI', ['Name', 'Indian resident', CCI, DEC], 17, 2],
  ['name prisoner NRI', ['Name', 'NRI', PR, DEC], 17, 0],
  ['address adult', ['Address', 'Indian resident', A, DEC], 26, 4],
  ['address OCI', ['Address', 'OCI cardholder', A, DEC], 26, 0],
  ['address LTV', ['Address', 'Long Term Visa (LTV) holder', A, DEC], 27, 0],
  ['address FRRO minor', ['Address', 'Foreign national without passport (FRRO/FRO)', M, DEC], 27, 0],
  ['dob Indian minor declared', ['Date of Birth', 'Indian resident', M, DEC], 1, 0],
  ['dob NRI minor declared', ['Date of Birth', 'NRI', M, DEC], 2, 0],
  ['dob adult declared', ['Date of Birth', 'Indian resident', A, DEC], 6, 0],
  ['dob earlier BC', ['Date of Birth', 'Indian resident', A, S[1]], 1, 0],
  ['dob earlier other, minor', ['Date of Birth', 'Indian resident', M, S[2]], 6, 0],
  ['dob OCI', ['Date of Birth', 'OCI cardholder', A, DEC], 1, 0],
  ['dob Nepal', ['Date of Birth', 'Nepal / Bhutan national', A, DEC], 2, 0],
];
docs.forEach(([n, [u, r, c, d], std, hof]) => ok(`docs ${n}`, () => {
  const res = findDocuments({ updateType: u, residentType: r, category: c, dobStatus: d });
  assert.equal(res.check, 'OK');
  assert.equal(res.standard.length, std);
  assert.equal(res.hof.length, hof);
}));
ok('docs foreigner + prisoner -> not covered', () =>
  assert.match(findDocuments({ updateType: 'Name', residentType: 'OCI cardholder', category: PR, dobStatus: DEC }).check, /^Not covered/));

console.log(`\n${pass} checks passed`);