// src/utils/pdf/centrePdf.js
// Shared centre letterhead for every PDF the app prints (invoice, document checklist, ...).
// Same data and layout as the invoice in ServiceEntry.jsx, pulled out so it can be reused.

import axios from 'axios';

export const NAVY = '#0F172A';
export const SLATE = '#475569';
export const MUTED = '#94A3B8';
export const PAGE_LEFT = 14;
export const PAGE_RIGHT = 196; // A4 width 210mm - 14mm margin

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const DEFAULT_CENTRE = {
  name: 'Akshaya e Centre',
  address: '', district: '', state: '', pincode: '',
  phone: '', email: '', working_hours: '', logo: '',
};

const centreCache = new Map(); // centreId -> centre details
const logoCache = new Map();   // url -> Promise<{dataUrl,width,height} | null>

export const resolveAssetUrl = (path) => {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  return `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

/** Centre of the logged-in staff (cached for the session). Never throws. */
export const fetchCentreDetails = async (centreId = localStorage.getItem('centre_id')) => {
  const id = centreId ? String(centreId).trim() : '';
  if (!id) return { ...DEFAULT_CENTRE };
  if (centreCache.has(id)) return centreCache.get(id);

  try {
    const { data: c = {} } = await axios.get(`${API_URL}/api/centres/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const centre = {
      name: c.name || DEFAULT_CENTRE.name,
      address: c.address || '',
      district: c.district || '',
      state: c.state || '',
      pincode: c.pincode || '',
      phone: c.phone || '',
      email: c.email || '',
      working_hours: c.working_hours || '',
      logo: c.logo || '',
    };
    centreCache.set(id, centre);
    return centre;
  } catch (err) {
    console.warn('centrePdf: could not load centre details', err.response?.data || err.message);
    return { ...DEFAULT_CENTRE };
  }
};

/** Loads the logo as a PNG data URL with its size. Returns null if it can't be loaded. */
export const loadLogo = async (logoPath) => {
  const url = resolveAssetUrl(logoPath);
  if (!url) return null;
  if (logoCache.has(url)) return logoCache.get(url);

  const promise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve({ dataUrl: canvas.toDataURL('image/png'), width: img.naturalWidth, height: img.naturalHeight });
      } catch {
        resolve(null); // canvas tainted (server sent no CORS header)
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });

  logoCache.set(url, promise);
  const result = await promise;
  if (!result) logoCache.delete(url); // retry next time
  return result;
};

/** Draws logo (left) + centre name/address/contact (right) and a divider. Returns the divider's y. */
export const drawCentreHeader = (doc, centre, logo) => {
  const name = centre?.name || DEFAULT_CENTRE.name;

  if (logo) {
    const box = 26;
    const ratio = logo.width / logo.height || 1;
    const w = ratio >= 1 ? box : box * ratio;
    const h = ratio >= 1 ? box / ratio : box;
    doc.addImage(logo.dataUrl, 'PNG', PAGE_LEFT, 10 + (box - h) / 2, w, h);
  } else {
    doc.setTextColor(NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(doc.splitTextToSize(name, 78), PAGE_LEFT, 22);
  }

  doc.setTextColor(NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(name, PAGE_RIGHT, 16, { align: 'right' });

  doc.setTextColor(SLATE);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const lines = [];
  const addr = [centre?.address, centre?.district].filter(Boolean).join(', ');
  if (addr) lines.push(...doc.splitTextToSize(addr, 100));
  const statePin = [centre?.state, centre?.pincode ? `Pin - ${centre.pincode}` : null].filter(Boolean).join(', ');
  if (statePin) lines.push(statePin);
  const contact = [centre?.phone ? `Phone: ${centre.phone}` : null, centre?.email].filter(Boolean).join('  |  ');
  if (contact) lines.push(contact);

  let y = 22;
  lines.forEach((line) => {
    doc.text(line, PAGE_RIGHT, y, { align: 'right' });
    y += 5;
  });

  const lineY = Math.max(42, y);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(PAGE_LEFT, lineY, PAGE_RIGHT, lineY);
  return lineY;
};

/** Footer on every page: centre name + working hours, page x of y. Call after all content. */
export const drawFooter = (doc, centre) => {
  const pages = doc.internal.getNumberOfPages();
  const h = doc.internal.pageSize.getHeight();
  const left = [centre?.name, centre?.working_hours ? `Hours: ${centre.working_hours}` : null]
    .filter(Boolean)
    .join('  |  ');

  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(PAGE_LEFT, h - 16, PAGE_RIGHT, h - 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(MUTED);
    if (left) doc.text(left, PAGE_LEFT, h - 10);
    doc.text(`Page ${i} of ${pages}`, PAGE_RIGHT, h - 10, { align: 'right' });
  }
};

export const formatDateIST = (date = new Date()) =>
  date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

/** Opens the print dialog for a jsPDF doc without a popup (hidden iframe). */
export const printPdf = (doc) => {
  const url = URL.createObjectURL(doc.output('blob'));
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  iframe.src = url;
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch {
        window.open(url, '_blank'); // fallback: open the PDF, user prints from there
      }
    }, 150);
    // keep it around long enough for the print dialog, then clean up
    setTimeout(() => {
      iframe.remove();
      URL.revokeObjectURL(url);
    }, 60000);
  };
  document.body.appendChild(iframe);
};