// src/components/files/PdfFormFiller.jsx
// Full-screen PDF filler for a File Repository form. Staff can type anywhere on the page, tick boxes,
// fill the PDF's own form fields (when it has them) and drop in the customer's details with one click,
// then print or download the filled copy. The original file in the repository is never changed.
// Text can be English or Malayalam (Malayalam uses Noto Sans Malayalam, see malayalamFont.js).
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, PDFTextField, PDFCheckBox, StandardFonts, rgb, degrees } from 'pdf-lib';
import {
  FiX, FiType, FiCheck, FiMousePointer, FiPrinter, FiDownload, FiZoomIn, FiZoomOut, FiTrash2, FiMove, FiCalendar,
} from 'react-icons/fi';
import {
  MALAYALAM_FONT_CSS, MALAYALAM_BASELINE, hasMalayalam, loadMalayalamForScreen,
} from './malayalamFont';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const API_BASE_URL = import.meta.env.VITE_API_URL;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

// Text is drawn with Helvetica in the PDF; Arial has the same metrics, so the on-screen box matches.
const FONT_CSS = 'Helvetica, Arial, sans-serif';
const LINE_HEIGHT = 1.2;
const BASELINE = 0.95;          // first baseline, as a fraction of font size from the top of the box (Arial, line-height 1.2)
// A box with any Malayalam in it is drawn wholly in Noto Sans Malayalam (it has Latin too); otherwise Helvetica.
const fontCssFor = (text) => (hasMalayalam(text) ? MALAYALAM_FONT_CSS : FONT_CSS);
const baselineFor = (text) => (hasMalayalam(text) ? MALAYALAM_BASELINE : BASELINE);
// What the Malayalam font can draw: Latin, Malayalam, joiners and common punctuation (incl. ₹)
const MALAYALAM_FONT_RANGES = [[0x0A, 0x0A], [0x20, 0x7E], [0xA0, 0xFF], [0x0D00, 0x0D7F], [0x200B, 0x200D], [0x2013, 0x2014], [0x2018, 0x201D], [0x2022, 0x2022], [0x20B9, 0x20B9]];
// Malayalam letters (with zero-width joiners) vs everything else, e.g. "Village: " | "ജില്ല"
const MALAYALAM_RUN_RE = /([\u0D00-\u0D7F\u200C\u200D]+)/;
const splitMalayalamRuns = (line) => line.split(MALAYALAM_RUN_RE).filter(Boolean);
const malayalamFontCanDraw = (text) => [...text].every(ch => {
  const c = ch.codePointAt(0);
  return MALAYALAM_FONT_RANGES.some(([a, b]) => c >= a && c <= b);
});
const DEFAULT_TEXT_SIZE = 11;   // PDF points
const DEFAULT_TICK_SIZE = 12;
const MIN_SIZE = 6, MAX_SIZE = 36;

const todayText = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

let measureCtx = null;
const measureWidth = (text, px, family = FONT_CSS) => {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = `${px}px ${family}`;
  return measureCtx.measureText(text).width;
};

let nextId = 1;
const newId = () => `i${nextId++}`;

// ---------- One rendered page: canvas + overlay ----------
const PdfPage = ({ index, info, proxy, scale, tool, items, fieldValues, selectedId, onPlace, onSelect, onItemChange, onFieldChange, onDragStart, registerInput }) => {
  const canvasRef = useRef(null);
  const w = info.width * scale;
  const h = info.height * scale;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !proxy) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vp = proxy.getViewport({ scale: scale * dpr });
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    const task = proxy.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
    task.promise.catch(() => {}); // cancelled renders reject; that's fine
    return () => task.cancel();
  }, [proxy, scale]);

  const handlePointerDown = (e) => {
    if (e.target !== e.currentTarget) return; // clicks on items/fields are handled by them
    // Stop the browser's own mousedown focus handling, which would pull focus off the new text box onto <body>.
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    onPlace(index, (e.clientX - r.left) / scale, (e.clientY - r.top) / scale);
  };

  const cursor = tool === 'select' ? 'default' : 'crosshair';

  return (
    <div className="relative mx-auto bg-white shadow-md" style={{ width: w, height: h }}>
      <canvas ref={canvasRef} style={{ width: w, height: h, display: 'block' }} />
      <div className="absolute inset-0" style={{ cursor }} onPointerDown={handlePointerDown}>
        {/* The PDF's own fillable fields */}
        {info.fields.map(f => {
          const style = { left: f.left * scale, top: f.top * scale, width: f.width * scale, height: f.height * scale };
          if (f.kind === 'check') {
            return (
              <input key={f.key} type="checkbox" title={f.name}
                checked={!!fieldValues[f.name]}
                onChange={e => onFieldChange(f.name, e.target.checked)}
                className="absolute m-0 accent-navy-700 cursor-pointer bg-sky-100/60"
                style={style} />
            );
          }
          const fs = Math.max(8, Math.min(f.height * 0.7, 12)) * scale;
          const common = {
            title: f.name,
            value: fieldValues[f.name] ?? '',
            onChange: e => onFieldChange(f.name, e.target.value),
            onFocus: e => registerInput({ el: e.target, field: f.name }),
            className: 'absolute m-0 px-0.5 py-0 border-0 bg-sky-100/60 focus:bg-sky-100/90 outline-none focus:ring-1 focus:ring-navy-500 text-slate-900 resize-none',
            style: { ...style, fontSize: fs, fontFamily: fontCssFor(fieldValues[f.name]), lineHeight: 1.15 },
          };
          return f.multiline ? <textarea key={f.key} {...common} /> : <input key={f.key} type="text" {...common} />;
        })}

        {/* Text and ticks staff added */}
        {items.map(it => {
          const selected = it.id === selectedId;
          if (it.type === 'tick') {
            const s = it.size * scale;
            return (
              <div key={it.id}
                onPointerDown={e => { e.stopPropagation(); onSelect(it.id); onDragStart(e, it, scale); }}
                className={`absolute cursor-move rounded-sm ${selected ? 'ring-1 ring-navy-500 ring-offset-1' : ''}`}
                style={{ left: it.x * scale, top: it.y * scale, width: s, height: s, touchAction: 'none' }}>
                <svg viewBox="0 0 1 1" width={s} height={s}>
                  <polyline points="0.15,0.55 0.4,0.8 0.85,0.2" fill="none" stroke="#000" strokeWidth="0.12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            );
          }
          const px = it.size * scale;
          const lines = (it.text || '').split('\n');
          const family = fontCssFor(it.text);
          const width = Math.max(px * 2, ...lines.map(l => measureWidth(l, px, family))) + 6;
          const height = lines.length * px * LINE_HEIGHT;
          return (
            <div key={it.id} className="absolute" style={{ left: it.x * scale, top: it.y * scale }}
              onPointerDown={e => { e.stopPropagation(); onSelect(it.id); }}>
              {selected && (
                <span
                  onPointerDown={e => { e.stopPropagation(); onDragStart(e, it, scale); }}
                  title="Drag to move"
                  className="absolute -left-5 top-0 h-5 w-5 flex items-center justify-center rounded bg-navy-700 text-white cursor-move shadow"
                  style={{ touchAction: 'none' }}>
                  <FiMove className="h-3 w-3" />
                </span>
              )}
              <textarea
                ref={el => {
                  if (el && it.autoFocus) {
                    onItemChange(it.id, { autoFocus: false });
                    // Focus right away, so even a keystroke straight after the click lands here (the page's
                    // pointerdown cancels the browser's own focus change). Re-check once the click is over.
                    el.focus();
                    setTimeout(() => { if (document.activeElement !== el) el.focus(); }, 0);
                  }
                }}
                value={it.text}
                onChange={e => onItemChange(it.id, { text: e.target.value })}
                onFocus={e => { onSelect(it.id); registerInput({ el: e.target, item: it.id }); }}
                spellCheck={false}
                rows={1}
                className={`block m-0 p-0 border-0 bg-transparent resize-none overflow-hidden text-black ${
                  selected ? 'outline-1 outline-dashed outline-navy-500 bg-sky-50/40' : 'outline-none hover:outline-1 hover:outline-dashed hover:outline-slate-300'}`}
                style={{ width, height, fontSize: px, lineHeight: LINE_HEIGHT, fontFamily: family, whiteSpace: 'pre' }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------- The filler ----------
const PdfFormFiller = ({ file, fillValues = [], onClose }) => {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [loadError, setLoadError] = useState('');
  const [pages, setPages] = useState([]);          // [{ width, height, rotation, fields }]
  const [items, setItems] = useState([]);          // [{ id, page, type, x, y, size, text }]
  const [fieldValues, setFieldValues] = useState({});
  const [tool, setTool] = useState('text');        // text | tick | select
  const [armedText, setArmedText] = useState(null);// a customer detail waiting to be placed
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const [, setFontLoaded] = useState(false); // re-render (and re-measure boxes) once the Malayalam font is in

  const bytesRef = useRef(null);
  const proxiesRef = useRef([]);
  const viewportsRef = useRef([]);
  const initialFieldsRef = useRef({});
  const lastInputRef = useRef(null);
  const scrollRef = useRef(null);
  const dragRef = useRef(null);

  const scale = fitScale * zoom;
  const fieldCount = useMemo(() => pages.reduce((n, p) => n + p.fields.length, 0), [pages]);
  const chips = useMemo(
    () => [...fillValues.filter(v => v && String(v.value || '').trim()), { label: 'Date', value: todayText(), icon: FiCalendar }],
    [fillValues]
  );

  useEffect(() => {
    let alive = true;
    loadMalayalamForScreen().then(ok => { if (alive && ok) setFontLoaded(true); });
    return () => { alive = false; };
  }, []);

  // ----- load the PDF -----
  useEffect(() => {
    let alive = true;
    let pdf = null;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/files/version/${file.version_id}`, { headers: authHeaders() });
        if (!res.ok) throw new Error(res.status === 403 ? "You don't have access to this file." : "Couldn't download this file.");
        const bytes = new Uint8Array(await res.arrayBuffer());
        bytesRef.current = bytes;
        pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise; // pdf.js takes ownership of its copy
        const infos = [], proxies = [], vps = [], initial = {};
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          const annots = await page.getAnnotations().catch(() => []);
          const fields = annots
            .filter(a => a.subtype === 'Widget' && a.fieldName && !a.readOnly
              && (a.fieldType === 'Tx' || (a.fieldType === 'Btn' && a.checkBox)))
            .map((a, k) => {
              const [x1, y1, x2, y2] = vp.convertToViewportRectangle(a.rect);
              const kind = a.fieldType === 'Tx' ? 'text' : 'check';
              if (!(a.fieldName in initial)) {
                initial[a.fieldName] = kind === 'text'
                  ? (typeof a.fieldValue === 'string' ? a.fieldValue : '')
                  : !!a.fieldValue && a.fieldValue !== 'Off';
              }
              return {
                key: `${a.id || k}`, name: a.fieldName, kind, multiline: !!a.multiLine,
                left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1),
              };
            });
          infos.push({ width: vp.width, height: vp.height, rotation: vp.rotation, fields });
          proxies.push(page);
          vps.push(vp);
        }
        if (!alive) return;
        proxiesRef.current = proxies;
        viewportsRef.current = vps;
        initialFieldsRef.current = initial;
        setFieldValues(initial);
        setPages(infos);
        setStatus('ready');
      } catch (e) {
        if (!alive) return;
        setLoadError(e?.name === 'PasswordException' ? 'This PDF is password protected.' : (e?.message || "Couldn't open this PDF."));
        setStatus('error');
      }
    })();
    return () => { alive = false; pdf?.destroy(); };
  }, [file.version_id]);

  // ----- fit the widest page to the window -----
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !pages.length) return;
    const maxW = Math.max(...pages.map(p => p.width));
    const fit = () => setFitScale(Math.min(1.6, Math.max(0.3, (el.clientWidth - 48) / maxW)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pages]);

  // ----- closing -----
  const requestClose = useCallback(() => {
    if (dirty && !window.confirm('Close the form? What you filled in will be lost.')) return;
    onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { if (armedText) setArmedText(null); else requestClose(); }
      const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !typing) {
        e.preventDefault();
        setItems(list => list.filter(i => i.id !== selectedId));
        setSelectedId(null);
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [armedText, requestClose, selectedId]);

  // ----- editing -----
  const pruneEmpty = (list, keepId) => list.filter(i => i.type !== 'text' || i.id === keepId || (i.text || '').trim());

  const select = (id) => {
    setSelectedId(id);
    setItems(list => pruneEmpty(list, id));
  };

  const place = (page, x, y) => {
    setMessage('');
    if (tool === 'select' && !armedText) { select(null); return; }
    const id = newId();
    let item;
    if (armedText != null) {
      item = { id, page, type: 'text', x, y: y - DEFAULT_TEXT_SIZE * 0.7, size: DEFAULT_TEXT_SIZE, text: armedText };
      setArmedText(null);
    } else if (tool === 'tick') {
      item = { id, page, type: 'tick', x: x - DEFAULT_TICK_SIZE / 2, y: y - DEFAULT_TICK_SIZE / 2, size: DEFAULT_TICK_SIZE };
    } else {
      item = { id, page, type: 'text', x, y: y - DEFAULT_TEXT_SIZE * 0.7, size: DEFAULT_TEXT_SIZE, text: '', autoFocus: true };
    }
    setItems(list => [...pruneEmpty(list, null), item]);
    setSelectedId(id);
    setDirty(true);
  };

  const changeItem = (id, patch) => {
    setItems(list => list.map(i => (i.id === id ? { ...i, ...patch } : i)));
    if ('text' in patch) setDirty(true);
  };

  const changeField = (name, value) => {
    setFieldValues(v => ({ ...v, [name]: value }));
    setDirty(true);
  };

  const resizeSelected = (delta) => {
    setItems(list => list.map(i => (i.id === selectedId
      ? { ...i, size: Math.max(MIN_SIZE, Math.min(MAX_SIZE, i.size + delta)) } : i)));
  };

  const deleteSelected = () => {
    setItems(list => list.filter(i => i.id !== selectedId));
    setSelectedId(null);
  };

  // Dragging an item (pointer events, works for mouse and touch)
  const startDrag = (e, item, s) => {
    e.preventDefault();
    dragRef.current = { id: item.id, startX: e.clientX, startY: e.clientY, x: item.x, y: item.y, s };
    const move = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      changeItem(d.id, { x: d.x + (ev.clientX - d.startX) / d.s, y: d.y + (ev.clientY - d.startY) / d.s });
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // A customer detail chip: goes into the box being typed in, otherwise waits for a click on the page.
  const insertChip = (value) => {
    const target = lastInputRef.current;
    if (target && document.activeElement === target.el) {
      const el = target.el;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const next = el.value.slice(0, start) + value + el.value.slice(end);
      if (target.item) changeItem(target.item, { text: next });
      else changeField(target.field, next);
      requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + value.length, start + value.length); });
      return;
    }
    setArmedText(value);
    setMessage('');
  };

  // ----- build the filled PDF -----
  const buildPdf = async () => {
    const doc = await PDFDocument.load(bytesRef.current, { ignoreEncryption: true });
    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
    // The Malayalam font is only embedded (subset, a few KB) when some text needs it.
    let malayalam = null;
    const anyMalayalam = items.some(i => hasMalayalam(i.text))
      || Object.values(fieldValues).some(v => typeof v === 'string' && hasMalayalam(v));
    if (anyMalayalam) {
      const { embedMalayalamFont } = await import('./malayalamPdfFont');
      malayalam = await embedMalayalamFont(doc);
    }
    const fontFor = (text) => (hasMalayalam(text) ? malayalam : helvetica);
    const unsupported = new Set();
    const canWrite = (text) => {
      if (hasMalayalam(text)) {
        if (malayalamFontCanDraw(text)) return true;
        unsupported.add(text);
        return false;
      }
      try { helvetica.encodeText(text); return true; } catch { unsupported.add(text); return false; }
    };

    // The PDF's own fields
    const changed = Object.keys(fieldValues).filter(n => fieldValues[n] !== initialFieldsRef.current[n]);
    if (changed.length) {
      const form = doc.getForm();
      for (const name of changed) {
        try {
          const field = form.getField(name);
          const value = fieldValues[name];
          if (field instanceof PDFTextField) {
            if (canWrite(value || '')) {
              const max = field.getMaxLength();
              const text = String(value || '');
              field.setText(max ? text.slice(0, max) : text);
              try { field.updateAppearances(fontFor(text)); } catch { /* the form-wide update below retries */ }
            }
          } else if (field instanceof PDFCheckBox) {
            value ? field.check() : field.uncheck();
          }
        } catch { /* a field pdf-lib can't handle: skip it */ }
      }
      try { form.updateFieldAppearances(helvetica); } catch { /* keep the values even if appearances fail */ }
    }

    // Added text and ticks
    const pdfPages = doc.getPages();
    for (const it of items) {
      const page = pdfPages[it.page];
      const vp = viewportsRef.current[it.page];
      if (!page || !vp) continue;
      const rotate = degrees(vp.rotation || 0);
      if (it.type === 'tick') {
        const s = it.size;
        const pt = (fx, fy) => { const [x, y] = vp.convertToPdfPoint(it.x + fx * s, it.y + fy * s); return { x, y }; };
        const opts = { thickness: s * 0.12, color: rgb(0, 0, 0) };
        page.drawLine({ start: pt(0.15, 0.55), end: pt(0.4, 0.8), ...opts });
        page.drawLine({ start: pt(0.4, 0.8), end: pt(0.85, 0.2), ...opts });
        continue;
      }
      // One font for the whole box, the same one the box uses on screen
      const font = fontFor(it.text);
      const baseline = baselineFor(it.text);
      (it.text || '').split('\n').forEach((line, i) => {
        if (!line.trim() || !canWrite(line)) return;
        const lineY = it.y + it.size * (baseline + LINE_HEIGHT * i);
        // fontkit shapes a whole string as one script (taken from its first letter), so a line like
        // "Village: ജില്ല" would lose its Malayalam conjuncts. Draw Malayalam and other text as separate runs.
        let runX = it.x;
        for (const run of font === helvetica ? [line] : splitMalayalamRuns(line)) {
          const [x, y] = vp.convertToPdfPoint(runX, lineY);
          page.drawText(run, { x, y, size: it.size, font, color: rgb(0, 0, 0), rotate });
          runX += font.widthOfTextAtSize(run, it.size);
        }
      });
    }

    const bytes = await doc.save();
    return { blob: new Blob([bytes], { type: 'application/pdf' }), unsupported: [...unsupported] };
  };

  const outputName = () => {
    const base = (file.name || 'form').replace(/\.pdf$/i, '');
    const who = (fillValues.find(v => v.label === 'Name')?.value || '').trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    return `${base}${who ? `-${who}` : ''}.pdf`;
  };

  const run = async (kind) => {
    setBusy(kind);
    setMessage('');
    try {
      const { blob, unsupported } = await buildPdf();
      if (unsupported.length) {
        setMessage(`Left out (only English and Malayalam can be printed): ${unsupported.slice(0, 3).join(', ')}${unsupported.length > 3 ? '…' : ''}`);
      }
      const url = URL.createObjectURL(blob);
      if (kind === 'download') {
        const a = document.createElement('a');
        a.href = url;
        a.download = outputName();
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        const frame = document.createElement('iframe');
        frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
        frame.src = url;
        frame.onload = () => {
          try { frame.contentWindow.focus(); frame.contentWindow.print(); }
          catch { window.open(url, '_blank'); }
        };
        document.body.appendChild(frame);
        setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 120000);
      }
      setDirty(false);
    } catch (e) {
      console.error('PDF fill failed:', e);
      setMessage("Couldn't create the filled PDF. Try again, or download the blank form.");
    } finally {
      setBusy('');
    }
  };

  const selectedItem = items.find(i => i.id === selectedId);

  const toolBtn = (id, Icon, label) => (
    <button type="button" onClick={() => { setTool(id); setArmedText(null); }}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
        tool === id && armedText == null ? 'bg-navy-700 text-white border-navy-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
      <Icon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-100" role="dialog" aria-modal="true" aria-label={`Fill ${file.name}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-3 sm:px-4 py-2.5 bg-white border-b border-slate-200">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-800 truncate">{file.name}</div>
          <div className="text-[11px] text-slate-500">
            {status === 'ready'
              ? (fieldCount ? `${fieldCount} fillable field${fieldCount > 1 ? 's' : ''} · click anywhere to add more text` : 'Click anywhere on the form to type')
              : 'Fill form'}
          </div>
        </div>
        <button type="button" onClick={() => run('print')} disabled={status !== 'ready' || !!busy}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-navy-700 text-white text-xs font-semibold hover:bg-navy-800 disabled:opacity-50">
          {busy === 'print' ? <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FiPrinter className="h-3.5 w-3.5" />}
          Print
        </button>
        <button type="button" onClick={() => run('download')} disabled={status !== 'ready' || !!busy}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50">
          {busy === 'download' ? <span className="h-3.5 w-3.5 border-2 border-navy-500 border-t-transparent rounded-full animate-spin" /> : <FiDownload className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">Download</span>
        </button>
        <button type="button" onClick={requestClose} title="Close" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100">
          <FiX className="h-5 w-5" />
        </button>
      </div>

      {/* Toolbar */}
      {status === 'ready' && (
        <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-2 bg-white/90 border-b border-slate-200">
          {toolBtn('text', FiType, 'Text')}
          {toolBtn('tick', FiCheck, 'Tick')}
          {toolBtn('select', FiMousePointer, 'Select')}
          <span className="w-px h-6 bg-slate-200 mx-1" />
          <div className="flex flex-wrap items-center gap-1.5">
            {chips.map(c => (
              <button key={c.label} type="button"
                onMouseDown={e => e.preventDefault()} /* keep focus in the box being typed in */
                onClick={() => insertChip(String(c.value))}
                title={`Insert ${c.label}: ${c.value}`}
                className={`max-w-[180px] truncate px-2 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  armedText === String(c.value) ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100'}`}>
                + {c.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 ml-auto">
            {selectedItem && (
              <>
                <button type="button" onClick={() => resizeSelected(-1)} title="Smaller" className="px-2 py-1 rounded border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50">A−</button>
                <span className="text-[11px] text-slate-500 w-8 text-center">{selectedItem.size}pt</span>
                <button type="button" onClick={() => resizeSelected(1)} title="Bigger" className="px-2 py-1 rounded border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50">A+</button>
                <button type="button" onClick={deleteSelected} title="Remove" className="p-1.5 rounded text-rose-600 hover:bg-rose-50"><FiTrash2 className="h-4 w-4" /></button>
                <span className="w-px h-6 bg-slate-200 mx-1" />
              </>
            )}
            <button type="button" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.15).toFixed(2)))} title="Zoom out" className="p-1.5 rounded text-slate-600 hover:bg-slate-100"><FiZoomOut className="h-4 w-4" /></button>
            <button type="button" onClick={() => setZoom(1)} className="text-[11px] text-slate-500 w-10 text-center hover:text-slate-800">{Math.round(zoom * 100)}%</button>
            <button type="button" onClick={() => setZoom(z => Math.min(3, +(z + 0.15).toFixed(2)))} title="Zoom in" className="p-1.5 rounded text-slate-600 hover:bg-slate-100"><FiZoomIn className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {/* Pages. The hint/message floats over them so the pages don't jump when it appears or goes. */}
      <div className="relative flex-1 min-h-0 flex flex-col">
      {(armedText != null || message) && (
        <div className="pointer-events-none absolute top-2 inset-x-0 z-10 flex justify-center px-4">
          <div className={`pointer-events-auto max-w-full px-3 py-1.5 rounded-lg shadow-md text-xs border ${message ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
            {message || <>Click on the form where “{armedText}” should go. <button type="button" className="underline ml-1" onClick={() => setArmedText(null)}>Cancel</button></>}
          </div>
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-auto py-6 px-6">
        {status === 'loading' && (
          <div className="h-full flex items-center justify-center text-sm text-slate-500 gap-2">
            <span className="h-4 w-4 border-2 border-navy-500 border-t-transparent rounded-full animate-spin" /> Opening form…
          </div>
        )}
        {status === 'error' && (
          <div className="h-full flex items-center justify-center text-sm text-rose-600">{loadError}</div>
        )}
        {status === 'ready' && (
          <div className="flex flex-col gap-6 items-center w-max min-w-full">
            {pages.map((info, i) => (
              <PdfPage key={i} index={i} info={info} proxy={proxiesRef.current[i]} scale={scale}
                tool={armedText != null ? 'text' : tool}
                items={items.filter(it => it.page === i)}
                fieldValues={fieldValues}
                selectedId={selectedId}
                onPlace={place}
                onSelect={select}
                onItemChange={changeItem}
                onFieldChange={changeField}
                onDragStart={startDrag}
                registerInput={t => { lastInputRef.current = t; }} />
            ))}
          </div>
        )}
      </div>
      </div>
    </div>,
    document.body
  );
};

export default PdfFormFiller;
