// suggestionDiff.js
// Compares two versions of a document block-by-block (matched by block_key).
// Returns entries in reading order:
//   { kind: 'added' | 'removed' | 'changed' | 'same', before, after }
import { parseContent } from './knowledgeBlocks';

const stable = (v) => {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
};
const fingerprint = (b) => stable({ t: b.block_type, c: parseContent(b.content) });

export const diffBlocks = (base = [], proposed = []) => {
  const baseByKey = new Map(base.map((b, i) => [String(b.block_key), { block: b, index: i }]));
  const proposedKeys = new Set(proposed.map(b => String(b.block_key)));

  const entries = proposed.map(after => {
    const match = baseByKey.get(String(after.block_key));
    if (!match) return { kind: 'added', before: null, after, baseIndex: null };
    const before = match.block;
    return {
      kind: fingerprint(before) === fingerprint(after) ? 'same' : 'changed',
      before, after, baseIndex: match.index,
    };
  });

  // Put each removed block right after the nearest earlier block that still exists
  base.forEach((before, i) => {
    if (proposedKeys.has(String(before.block_key))) return;
    let insertAt = 0;
    for (let j = entries.length - 1; j >= 0; j--) {
      if (entries[j].baseIndex !== null && entries[j].baseIndex < i) { insertAt = j + 1; break; }
    }
    entries.splice(insertAt, 0, { kind: 'removed', before, after: null, baseIndex: i });
  });

  return entries;
};

export const diffSummary = (entries) => ({
  added: entries.filter(e => e.kind === 'added').length,
  removed: entries.filter(e => e.kind === 'removed').length,
  changed: entries.filter(e => e.kind === 'changed').length,
});