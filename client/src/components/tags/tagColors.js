// Colours for tags. Full class names so Tailwind keeps them.
export const TAG_COLORS = [
  { key: 'blue', label: 'Blue', dot: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700 ring-blue-200', active: 'bg-blue-600 text-white ring-blue-600' },
  { key: 'green', label: 'Green', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', active: 'bg-emerald-600 text-white ring-emerald-600' },
  { key: 'amber', label: 'Amber', dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-800 ring-amber-200', active: 'bg-amber-500 text-white ring-amber-500' },
  { key: 'rose', label: 'Red', dot: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700 ring-rose-200', active: 'bg-rose-600 text-white ring-rose-600' },
  { key: 'violet', label: 'Purple', dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700 ring-violet-200', active: 'bg-violet-600 text-white ring-violet-600' },
  { key: 'teal', label: 'Teal', dot: 'bg-teal-500', chip: 'bg-teal-50 text-teal-700 ring-teal-200', active: 'bg-teal-600 text-white ring-teal-600' },
  { key: 'orange', label: 'Orange', dot: 'bg-orange-500', chip: 'bg-orange-50 text-orange-700 ring-orange-200', active: 'bg-orange-500 text-white ring-orange-500' },
  { key: 'slate', label: 'Grey', dot: 'bg-slate-500', chip: 'bg-slate-100 text-slate-700 ring-slate-200', active: 'bg-slate-700 text-white ring-slate-700' },
];

export const tagColor = (key) => TAG_COLORS.find((c) => c.key === key) || TAG_COLORS[0];

// The next colour nobody uses yet, so new tags look different from each other.
export const nextTagColor = (tags = []) => {
  const used = new Set(tags.map((l) => l.color));
  return (TAG_COLORS.find((c) => !used.has(c.key)) || TAG_COLORS[tags.length % TAG_COLORS.length]).key;
};
