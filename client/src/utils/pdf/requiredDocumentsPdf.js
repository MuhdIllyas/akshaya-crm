// src/utils/pdf/requiredDocumentsPdf.js
// "Document checklist" PDF for customers: centre letterhead + required documents per service.

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  NAVY, SLATE, PAGE_LEFT, PAGE_RIGHT,
  fetchCentreDetails, loadLogo, drawCentreHeader, drawFooter, formatDateIST, printPdf,
} from './centrePdf';

export const DEFAULT_CHECKLIST_NOTE =
  'Please bring the original documents along with one self-attested photocopy of each. ' +
  'The department may ask for additional documents depending on your case.';

const money = (n) =>
  `Rs. ${(parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Category-level docs (no sub_category_id) + the sub-category's own docs, de-duplicated. */
export const collectRequiredDocuments = (category, subcategory) => {
  const catDocs = (category?.required_documents || []).filter((d) => !d.sub_category_id);
  const subDocs = subcategory?.required_documents || [];
  const seen = new Set();
  const out = [];
  [...catDocs, ...subDocs].forEach((d) => {
    const name = String(d?.document_name || '').trim();
    const key = name.toLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      out.push(name);
    }
  });
  return out;
};

const chargesOf = (category, subcategory) => {
  const src = subcategory || category || {};
  const service = parseFloat(src.service_charges) || 0;
  const dept = parseFloat(src.department_charges) || 0;
  return { service, dept, total: service + dept };
};

/**
 * items: [{ category, subcategory }]  (category/subcategory objects as returned by getCategories())
 */
export const buildRequiredDocumentsPdf = ({
  centre, logo, items, customerName = '', phone = '', showCharges = false, notes = '', staffName = '',
}) => {
  const doc = new jsPDF();
  const pageH = doc.internal.pageSize.getHeight();
  const bottomLimit = pageH - 24;
  const contentW = PAGE_RIGHT - PAGE_LEFT;

  let y = drawCentreHeader(doc, centre, logo) + 10;

  // Left: who it's for
  if (customerName || phone) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor('#666666');
    doc.text('PREPARED FOR:', PAGE_LEFT, y);
    doc.setTextColor('#333333');
    doc.setFontSize(12);
    doc.text(customerName || '-', PAGE_LEFT, y + 6);
    if (phone) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Phone: ${phone}`, PAGE_LEFT, y + 12);
    }
  }

  // Right: title + date
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(NAVY);
  doc.text('DOCUMENT CHECKLIST', PAGE_RIGHT, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor('#333333');
  doc.text(`Date: ${formatDateIST()}`, PAGE_RIGHT, y + 8, { align: 'right' });
  if (staffName) doc.text(`Prepared by: ${staffName}`, PAGE_RIGHT, y + 14, { align: 'right' });

  y += 24;

  items.forEach(({ category, subcategory }, idx) => {
    if (y > bottomLimit - 30) {
      doc.addPage();
      y = 20;
    }

    // Service heading band
    const title = [category?.name, subcategory?.name].filter(Boolean).join(' - ');
    const charges = chargesOf(category, subcategory);
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(PAGE_LEFT, y, contentW, 9, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(NAVY);
    doc.text(doc.splitTextToSize(`${idx + 1}. ${title}`, showCharges ? 135 : contentW - 6)[0], PAGE_LEFT + 3, y + 6.2);
    if (showCharges) {
      doc.text(`Total: ${money(charges.total)}`, PAGE_RIGHT - 3, y + 6.2, { align: 'right' });
    }
    y += 13;

    if (showCharges) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(SLATE);
      doc.text(`Service charge ${money(charges.service)}  +  Department charge ${money(charges.dept)}`, PAGE_LEFT + 3, y);
      y += 5;
    }

    const docs = collectRequiredDocuments(category, subcategory);
    if (docs.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(SLATE);
      doc.text('No specific documents are listed for this service. Please check with the centre staff.', PAGE_LEFT + 3, y + 2);
      y += 12;
      return;
    }

    autoTable(doc, {
      startY: y,
      margin: { left: PAGE_LEFT, right: 210 - PAGE_RIGHT, top: 20, bottom: 24 },
      head: [['#', 'Document', 'Ready']],
      body: docs.map((d, i) => [i + 1, d, '']),
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 3.5, textColor: '#333333', lineColor: [226, 232, 240], lineWidth: 0.2 },
      headStyles: { fillColor: NAVY, textColor: '#FFFFFF', fontStyle: 'bold' },
      alternateRowStyles: { fillColor: '#F8FAFC' },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        2: { cellWidth: 18, halign: 'center' },
      },
      // empty tick box the customer can mark
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          const s = 4;
          doc.setDrawColor(100, 116, 139);
          doc.setLineWidth(0.3);
          doc.rect(data.cell.x + (data.cell.width - s) / 2, data.cell.y + (data.cell.height - s) / 2, s, s);
        }
      },
    });
    y = doc.lastAutoTable.finalY + 10;
  });

  // Important note box
  if (notes && notes.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(notes.trim(), contentW - 8);
    const boxH = lines.length * 4.4 + 12;
    if (y + boxH > bottomLimit) {
      doc.addPage();
      y = 20;
    }
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(253, 230, 138);
    doc.setLineWidth(0.3);
    doc.roundedRect(PAGE_LEFT, y, contentW, boxH, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor('#92400E');
    doc.text('Important', PAGE_LEFT + 4, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor('#78350F');
    doc.text(lines, PAGE_LEFT + 4, y + 11.5);
    y += boxH + 8;
  }

  if (y > bottomLimit - 6) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(8);
  doc.setTextColor('#94A3B8');
  doc.text(`Thank you for choosing ${centre?.name || 'Akshaya e Centre'}`, 105, y + 4, { align: 'center' });

  drawFooter(doc, centre);
  return doc;
};

/**
 * One call for any screen.
 * mode: 'print' (opens print dialog) | 'download' (saves file) | 'preview' (returns a blob URL)
 */
export const printServiceChecklist = async ({
  items,
  customerName = '',
  phone = '',
  showCharges = false,
  notes = DEFAULT_CHECKLIST_NOTE,
  mode = 'print',
}) => {
  const valid = (items || []).filter((i) => i?.category);
  if (valid.length === 0) throw new Error('Select at least one service to print.');

  const centre = await fetchCentreDetails();
  const logo = await loadLogo(centre.logo);
  const doc = buildRequiredDocumentsPdf({
    centre, logo, items: valid, customerName: customerName.trim(), phone: phone.trim(),
    showCharges, notes, staffName: localStorage.getItem('name') || '',
  });

  if (mode === 'preview') return URL.createObjectURL(doc.output('blob'));

  if (mode === 'download') {
    const slug = (valid[0].subcategory?.name || valid[0].category?.name || 'service')
      .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    doc.save(`documents_${slug}${valid.length > 1 ? `_and_${valid.length - 1}_more` : ''}.pdf`);
  } else {
    printPdf(doc);
  }
  return null;
};