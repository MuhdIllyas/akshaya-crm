// Customer self-service printing page (opened from the centre QR code: /print?centre_id=8)
import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  FiPrinter, FiUploadCloud, FiFileText, FiX, FiMinus, FiPlus, FiAlertCircle, FiCheck,
  FiClock, FiRefreshCw, FiWifiOff, FiChevronLeft, FiLoader,
} from 'react-icons/fi';

const API = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/printing`;
const MAX_MB = 50;
const JOB_KEY = 'sahayi_print_job';

const params = new URLSearchParams(window.location.search);
const centreId = params.get('centre_id') || localStorage.getItem('centre_id');
if (params.get('centre_id')) localStorage.setItem('centre_id', params.get('centre_id'));

const money = v => `₹${Number(v || 0).toFixed(2)}`;
const fileSize = b => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const readJob = () => { try { return JSON.parse(sessionStorage.getItem(JOB_KEY)); } catch { return null; } };
const saveJob = j => { try { j ? sessionStorage.setItem(JOB_KEY, JSON.stringify(j)) : sessionStorage.removeItem(JOB_KEY); } catch { /* ignore */ } };

/* ---------- small UI pieces ---------- */
function Segmented({ options, value, onChange }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(o => (
        <button
          key={String(o.value)}
          type="button"
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={`py-2.5 px-2 rounded-lg text-sm font-medium border transition-colors ${
            value === o.value
              ? 'bg-navy-700 border-navy-700 text-white'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const Field = ({ label, hint, children }) => (
  <div>
    <div className="flex items-baseline justify-between mb-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
    </div>
    {children}
  </div>
);

const ErrorBox = ({ children }) => (
  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
    <FiAlertCircle className="mt-0.5 shrink-0" /> <span>{children}</span>
  </div>
);

const Spinner = ({ className = '' }) => <FiLoader className={`animate-spin ${className}`} />;

function Steps({ step }) {
  const items = ['Upload', 'Review', 'Print'];
  return (
    <div className="flex items-center justify-center gap-2 text-xs font-medium">
      {items.map((t, i) => (
        <div key={t} className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full ${
            i < step ? 'bg-green-600 text-white' : i === step ? 'bg-white text-navy-700' : 'bg-white/20 text-white'
          }`}>
            {i < step ? <FiCheck /> : i + 1}
          </span>
          <span className={i === step ? 'text-white' : 'text-white/70'}>{t}</span>
          {i < items.length - 1 && <span className="w-6 h-px bg-white/40" />}
        </div>
      ))}
    </div>
  );
}

function Shell({ centre, online, step, children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-navy-700 text-white px-4 pt-5 pb-6">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center"><FiPrinter size={20} /></div>
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-lg leading-tight">Akshaya Sahayi</h1>
              <p className="text-sm text-white/80 truncate">Self-service printing{centre?.name ? ` · ${centre.name}` : ''}</p>
            </div>
            {online !== null && online !== undefined && (
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${online ? 'bg-green-500/20 text-green-100' : 'bg-amber-400/20 text-amber-100'}`}>
                {online ? '● Printer ready' : '● Printer offline'}
              </span>
            )}
          </div>
          <div className="mt-5"><Steps step={step} /></div>
        </div>
      </header>
      <main className="max-w-md mx-auto px-4 -mt-3 pb-10">{children}</main>
    </div>
  );
}

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-5 ${className}`}>{children}</div>
);

/* ---------- page ---------- */
export default function SelfServicePrint() {
  const [info, setInfo] = useState(null);           // centre, options, prices, online
  const [infoError, setInfoError] = useState('');

  const [file, setFile] = useState(null);
  const [copies, setCopies] = useState(1);
  const [color, setColor] = useState(false);
  const [paperSize, setPaperSize] = useState('A4');
  const [duplex, setDuplex] = useState(false);
  const [rangeMode, setRangeMode] = useState('ALL');
  const [pageRange, setPageRange] = useState('');

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [job, setJob] = useState(readJob); // { jobId, token, status, pages, pageRange, totalPrice, summary }
  const fileInput = useRef(null);

  const maxCopies = info?.options?.max_copies || 50;

  // load centre options
  useEffect(() => {
    if (!centreId) return;
    axios.get(`${API}/public/centre/${centreId}`)
      .then(({ data }) => {
        setInfo(data);
        const sizes = data.options.paper_sizes;
        if (sizes.length && !sizes.includes('A4')) setPaperSize(sizes[0]);
      })
      .catch(e => setInfoError(e.response?.data?.error || 'Could not load printing options. Please check your internet and try again.'));
  }, []);

  // keep job across refresh
  useEffect(() => { saveJob(job); }, [job]);

  // poll status while queued / printing
  useEffect(() => {
    if (!job || !['WAITING', 'PRINTING'].includes(job.status)) return undefined;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const { data } = await axios.get(`${API}/status/${job.jobId}`, { params: { token: job.token } });
        if (alive) setJob(j => (j ? { ...j, status: data.status, queueAhead: data.queueAhead, message: data.message } : j));
      } catch { if (alive) setJob(j => (j ? { ...j } : j)); } // retry on next tick
    }, 3000);
    return () => { alive = false; clearTimeout(t); };
  }, [job]);

  const unitPrice = useMemo(() => {
    const row = info?.prices?.find(p => String(p.paper_size).toUpperCase() === paperSize && Boolean(p.color) === color);
    if (!row) return null;
    return duplex ? (row.duplex_price ? `${money(row.duplex_price)} per sheet (2 sides)` : null) : `${money(row.price_per_page)} per page`;
  }, [info, paperSize, color, duplex]);

  const pickFile = f => {
    setError('');
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) return setError('Please choose a PDF file.');
    if (f.size > MAX_MB * 1048576) return setError(`File is larger than ${MAX_MB} MB.`);
    setFile(f);
  };

  const calculate = async e => {
    e.preventDefault();
    if (!file) return setError('Please choose a PDF file first.');
    if (rangeMode === 'CUSTOM' && !pageRange.trim()) return setError('Enter the pages to print, e.g. 1-3, 5');
    setError('');
    setUploading(true);
    setProgress(0);

    const fd = new FormData();
    fd.append('document', file);
    fd.append('centre_id', centreId);
    fd.append('copies', copies);
    fd.append('color', color);
    fd.append('paper_size', paperSize);
    fd.append('duplex', duplex);
    fd.append('page_range', rangeMode === 'CUSTOM' ? pageRange : 'ALL');

    try {
      const { data } = await axios.post(`${API}/upload`, fd, {
        onUploadProgress: p => p.total && setProgress(Math.round((p.loaded / p.total) * 100)),
      });
      setJob({
        jobId: data.jobId,
        token: data.token,
        status: data.status,
        pages: data.pages,
        totalPages: data.totalPages,
        pageRange: data.pageRange,
        totalPrice: data.totalPrice,
        summary: { fileName: file.name, copies, color, paperSize, duplex },
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await axios.post(`${API}/confirm`, { jobId: job.jobId, token: job.token });
      setJob(j => ({ ...j, status: data.status, queueAhead: null }));
    } catch (err) {
      const st = err.response?.data?.status;
      if (st) setJob(j => ({ ...j, status: st }));
      else setError(err.response?.data?.error || 'Could not send to printer. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const backToSettings = async () => {
    if (job?.status === 'DRAFT') axios.post(`${API}/cancel`, { jobId: job.jobId, token: job.token }).catch(() => {});
    setJob(null);
    setError('');
  };

  const startOver = () => {
    setJob(null);
    setFile(null);
    setCopies(1);
    setRangeMode('ALL');
    setPageRange('');
    setError('');
  };

  /* ----- no centre / load error ----- */
  if (!centreId || infoError) {
    return (
      <Shell step={0}>
        <Card className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center"><FiAlertCircle size={22} /></div>
          <h2 className="font-bold text-gray-800">{!centreId ? 'Scan the QR code at the counter' : 'Something went wrong'}</h2>
          <p className="text-sm text-gray-500 mt-1">{!centreId ? 'This page needs to be opened from the Akshaya centre QR code.' : infoError}</p>
          {centreId && (
            <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2.5 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors">
              Try again
            </button>
          )}
        </Card>
      </Shell>
    );
  }

  const offlineBanner = info?.online === false && (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
      <FiWifiOff className="mt-0.5 shrink-0" />
      <span>The printer is offline right now. You can still send your file — it will print as soon as staff switch it on.</span>
    </div>
  );

  /* ----- REVIEW + STATUS ----- */
  if (job) {
    const s = job.summary || {};
    const isDraft = job.status === 'DRAFT';
    const stage = { WAITING: 0, PRINTING: 1, COMPLETED: 2 }[job.status];

    return (
      <Shell centre={info?.centre} online={info?.online} step={isDraft ? 1 : 2}>
        <Card>
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="h-10 w-10 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center shrink-0"><FiFileText /></div>
            <div className="min-w-0">
              <p className="font-medium text-gray-800 truncate">{s.fileName || 'Your document'}</p>
              <p className="text-xs text-gray-500">Job #{job.jobId}</p>
            </div>
          </div>

          <dl className="divide-y divide-gray-100 text-sm">
            <div className="flex justify-between py-2.5">
              <dt className="text-gray-500">Pages</dt>
              <dd className="font-medium text-gray-800">
                {job.pages}{job.pageRange && job.pageRange !== 'ALL' ? <span className="text-gray-500 font-normal"> (pages {job.pageRange})</span> : ''}
              </dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-gray-500">Copies</dt><dd className="font-medium text-gray-800">{s.copies}</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-gray-500">Print</dt>
              <dd className="font-medium text-gray-800">{s.paperSize} · {s.color ? 'Colour' : 'Black & white'} · {s.duplex ? 'Both sides' : 'One side'}</dd>
            </div>
          </dl>

          <div className="mt-2 flex items-end justify-between rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
            <span className="text-sm text-gray-600">Total to pay</span>
            <span className="text-2xl font-bold text-navy-700">{money(job.totalPrice)}</span>
          </div>
        </Card>

        <div className="mt-4 space-y-3">
          {isDraft && (
            <>
              {offlineBanner}
              {error && <ErrorBox>{error}</ErrorBox>}
              <button onClick={confirm} disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-navy-700 text-white font-semibold rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50">
                {busy ? <><Spinner /> Sending…</> : <><FiPrinter /> Confirm & print</>}
              </button>
              <button onClick={backToSettings} disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50">
                <FiChevronLeft /> Change settings
              </button>
              <p className="text-xs text-center text-gray-500">You pay at the counter when you collect your prints.</p>
            </>
          )}

          {stage !== undefined && (
            <Card>
              <ol className="space-y-4">
                {[
                  { t: 'Sent to printer queue', d: job.queueAhead ? `${job.queueAhead} job${job.queueAhead > 1 ? 's' : ''} ahead of you` : 'Waiting for the printer' },
                  { t: 'Printing', d: 'Your pages are coming out' },
                  { t: 'Ready to collect', d: `Please pay ${money(job.totalPrice)} at the counter` },
                ].map((row, i) => (
                  <li key={row.t} className="flex gap-3">
                    <span className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-sm ${
                      i < stage || stage === 2 ? 'bg-green-600 text-white' : i === stage ? 'bg-navy-700 text-white' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {i < stage || stage === 2 ? <FiCheck /> : i === stage ? <Spinner /> : i + 1}
                    </span>
                    <div>
                      <p className={`font-medium ${i <= stage ? 'text-gray-800' : 'text-gray-400'}`}>{row.t}</p>
                      {i === stage && <p className="text-sm text-gray-500">{row.d}</p>}
                    </div>
                  </li>
                ))}
              </ol>
              {stage < 2 && info?.online === false && <div className="mt-4">{offlineBanner}</div>}
            </Card>
          )}

          {job.status === 'FAILED' && (
            <Card className="text-center">
              <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center"><FiAlertCircle size={22} /></div>
              <h2 className="font-bold text-gray-800">Printing didn't finish</h2>
              <p className="text-sm text-gray-500 mt-1">{job.message || 'Please show this screen to the staff.'}</p>
              <p className="mt-3 inline-block rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-mono text-gray-700">Job #{job.jobId}</p>
              <p className="text-xs text-gray-500 mt-2">You have not been charged for this job.</p>
            </Card>
          )}

          {job.status === 'CANCELLED' && <ErrorBox>This job expired. Please upload your file again.</ErrorBox>}

          {['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status) && (
            <button onClick={startOver}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-navy-700 text-white font-semibold rounded-lg hover:bg-navy-800 transition-colors">
              <FiRefreshCw /> Print another document
            </button>
          )}
        </div>
      </Shell>
    );
  }

  /* ----- UPLOAD FORM ----- */
  const opts = info?.options;
  const sizes = opts?.paper_sizes?.length ? opts.paper_sizes : ['A4'];

  return (
    <Shell centre={info?.centre} online={info?.online} step={0}>
      <form onSubmit={calculate} className="space-y-4">
        {info && !info.available && <ErrorBox>Self-service printing is not available at this centre right now. Please ask the staff.</ErrorBox>}

        <Card>
          <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden"
            onChange={e => { pickFile(e.target.files[0]); e.target.value = ''; }} />
          {!file ? (
            <button type="button" onClick={() => fileInput.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); pickFile(e.dataTransfer.files[0]); }}
              className="w-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center hover:border-navy-500 transition-colors">
              <FiUploadCloud className="mx-auto text-navy-700" size={30} />
              <p className="mt-2 font-medium text-gray-800">Choose PDF to print</p>
              <p className="text-xs text-gray-500 mt-1">PDF only · up to {MAX_MB} MB</p>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0"><FiFileText size={20} /></div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-800 truncate">{file.name}</p>
                <p className="text-xs text-gray-500">{fileSize(file.size)}</p>
              </div>
              <button type="button" onClick={() => setFile(null)} disabled={uploading}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Remove file"><FiX /></button>
            </div>
          )}
        </Card>

        <Card className="space-y-5">
          <Field label="Colour">
            <Segmented value={color} onChange={setColor}
              options={[{ value: false, label: 'Black & white' }, { value: true, label: 'Colour', disabled: opts && !opts.color }]} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Paper">
              <Segmented value={paperSize} onChange={setPaperSize} options={sizes.map(sz => ({ value: sz, label: sz }))} />
            </Field>
            <Field label="Copies">
              <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden">
                <button type="button" onClick={() => setCopies(c => Math.max(1, c - 1))} className="px-3 py-2.5 text-gray-600 hover:bg-gray-50" aria-label="Fewer copies"><FiMinus /></button>
                <input type="number" min="1" max={maxCopies} value={copies}
                  onChange={e => setCopies(Math.min(maxCopies, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                  className="w-full text-center py-2.5 border-x border-gray-300 focus:outline-none" />
                <button type="button" onClick={() => setCopies(c => Math.min(maxCopies, c + 1))} className="px-3 py-2.5 text-gray-600 hover:bg-gray-50" aria-label="More copies"><FiPlus /></button>
              </div>
            </Field>
          </div>

          <Field label="Sides">
            <Segmented value={duplex} onChange={setDuplex}
              options={[{ value: false, label: 'One side' }, { value: true, label: 'Both sides', disabled: opts && !opts.duplex }]} />
          </Field>

          <Field label="Pages" hint={rangeMode === 'CUSTOM' ? 'e.g. 1-3, 5, 8' : null}>
            <Segmented value={rangeMode} onChange={setRangeMode}
              options={[{ value: 'ALL', label: 'All pages' }, { value: 'CUSTOM', label: 'Choose pages' }]} />
            {rangeMode === 'CUSTOM' && (
              <input type="text" inputMode="numeric" value={pageRange} onChange={e => setPageRange(e.target.value)}
                placeholder="1-3, 5"
                className="mt-2 w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent" />
            )}
          </Field>

          {unitPrice && (
            <p className="text-sm text-gray-600 flex items-center gap-1.5"><FiClock className="text-gray-400" /> {unitPrice}</p>
          )}
        </Card>

        {error && <ErrorBox>{error}</ErrorBox>}

        <div className="sticky bottom-0 -mx-4 px-4 pb-4 pt-2 bg-gradient-to-t from-gray-50 via-gray-50">
          <button type="submit" disabled={uploading || !info?.available}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-navy-700 text-white font-semibold rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50">
            {uploading ? <><Spinner /> {progress < 100 ? `Uploading ${progress}%` : 'Counting pages…'}</> : 'See price'}
          </button>
          {uploading && (
            <div className="mt-2 h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full bg-navy-700 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      </form>
    </Shell>
  );
}
