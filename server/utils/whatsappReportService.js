// Sends a scheduled report PDF on WhatsApp.
//
// A report goes out at a fixed time, usually outside the 24-hour window, so it
// has to be a Meta-approved template: event key 'scheduled_report', mapped per
// WhatsApp account in Communication Settings. The template needs a DOCUMENT
// header and a body with three variables: {{1}} name, {{2}} report, {{3}} date.
//
// Meta downloads the document from a link, so the PDF is saved under
// uploads/reports with a random name and deleted after REPORT_FILE_DAYS.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pool from '../db.js';
import { orgUploadPath } from '../tenancy/uploads.js';
import { apiBaseUrl } from '../tenancy/links.js';
import { triggerNotification } from './communication/notificationEngine.js';

export const REPORT_EVENT_KEY = 'scheduled_report';
const REPORT_FILE_DAYS = 7;

/** "+91 98470-12345", "919847012345" → "9847012345". Null if it isn't a phone number. */
export const normalizePhone = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : null;
};

/** Saves the PDF where Meta can download it. Returns the public link. */
export const saveReportPdf = (pdfBuffer) => {
    const { dir, url } = orgUploadPath('reports');
    const file = `${crypto.randomUUID()}.pdf`;
    fs.writeFileSync(path.join(dir, file), pdfBuffer);
    return `${apiBaseUrl()}${url}/${file}`;
};

/** Deletes report PDFs older than REPORT_FILE_DAYS (for the current organization). */
export const cleanupOldReportPdfs = () => {
    const { dir } = orgUploadPath('reports');
    const cutoff = Date.now() - REPORT_FILE_DAYS * 24 * 60 * 60 * 1000;
    let deleted = 0;
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        try {
            if (fs.statSync(full).mtimeMs < cutoff) {
                fs.unlinkSync(full);
                deleted++;
            }
        } catch (err) {
            console.error(`[Reports] Could not delete old report ${name}:`, err.message);
        }
    }
    return deleted;
};

/**
 * Which centre's WhatsApp number a report goes out from.
 * The schedule's centre, else the recipient's own centre, else any centre
 * with an active WhatsApp account. Null if the organization has none.
 */
const pickSenderCentre = async (preferredCentreIds) => {
    const candidates = preferredCentreIds.map(Number).filter(Number.isInteger);
    const res = await pool.query(`
        SELECT c.id
        FROM centres c
        JOIN communication_accounts ca ON ca.id = c.communication_account_id AND ca.is_active = true
        ORDER BY (c.id = ANY($1::int[])) DESC, array_position($1::int[], c.id), c.id
        LIMIT 1
    `, [candidates]);
    return res.rows[0]?.id ?? null;
};

/**
 * Sends the report to each recipient.
 * @param {{ phone: string, name?: string, centre_id?: number }[]} recipients
 * @param {{ link: string, fileName: string, reportName: string, date: string, scheduleCentreId?: number }} report
 */
export const sendReportWhatsApp = async (recipients, { link, fileName, reportName, date, scheduleCentreId }) => {
    let sent = 0;
    for (const r of recipients) {
        const centreId = await pickSenderCentre([scheduleCentreId, r.centre_id]);
        if (!centreId) {
            console.warn(`[Reports] ⚠️ No active WhatsApp account in this organization; "${reportName}" not sent on WhatsApp.`);
            return sent;
        }

        const result = await triggerNotification({
            eventKey: REPORT_EVENT_KEY,
            centreId,
            customerPhone: r.phone,
            customComponents: [
                {
                    type: 'header',
                    parameters: [{ type: 'document', document: { link, filename: fileName } }]
                },
                {
                    type: 'body',
                    parameters: [r.name || 'Team', reportName, date].map(text => ({ type: 'text', text: String(text) }))
                }
            ]
        });
        if (result?.success) sent++;
    }
    console.log(`[Reports] 📱 "${reportName}" sent on WhatsApp to ${sent}/${recipients.length} recipients`);
    return sent;
};
