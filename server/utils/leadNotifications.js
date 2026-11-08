// utils/leadNotifications.js
// Decides WHO gets a lead notification. The wording lives in
// notificationTemplates.js (leadNew / leadAssigned / leadEnquiry) and
// sending goes through notificationService, like every other module.
// Never throws: a failed notification must not break the lead.

import pool from "../db.js";
import notificationService from "./notificationService.js";
import { notificationTemplates } from "./notificationTemplates.js";

const leadName = (lead) =>
  String(lead.customer_details || lead.whatsapp_name || "Customer")
    .replace(/\s*(?:\\n|\r?\n)+\s*/g, ", ")
    .split(",")[0]
    .trim() || "Customer";

const leadData = (lead) => ({
  customerName: leadName(lead),
  serviceName: lead.service_needed || "a service",
  phone: `+91 ${lead.phone}`,
  docsReady: lead.docs_ready || null,
  fromBot: lead.source === "whatsapp_bot",
});

const base = (lead, senderId) => ({
  senderStaffId: senderId || null,
  centreId: lead.centre_id,
  relatedEntityType: "lead",
  relatedEntityId: lead.id,
});

/**
 * New lead → the centre's admin(s) and its active staff, so anyone can take it.
 * Customer asks again (repeat = true) → only the lead's owner; nobody if it's still unassigned.
 */
export async function notifyNewLead(lead, { repeat = false, senderId = null } = {}) {
  try {
    if (!lead?.centre_id) return;

    if (repeat) {
      if (!lead.assigned_to) return; // still unassigned: the team was told when it came in
      // Several messages in a row refresh one unread notification instead of piling up
      await notificationService.createOrBumpBulkNotifications({
        recipientStaffIds: [lead.assigned_to],
        ...base(lead, null),
        ...notificationTemplates.leadEnquiry(leadData(lead)),
      });
      return;
    }

    const { rows } = await pool.query(
      `SELECT DISTINCT s.id, COALESCE(LOWER(s.role), 'staff') AS role
         FROM staff s
        WHERE s.status = 'Active'
          AND (
            (s.centre_id = $1 AND COALESCE(LOWER(s.role), 'staff') IN ('admin', 'staff', 'supervisor'))
            OR s.id = (SELECT admin_id FROM centres WHERE id = $1)
          )`,
      [lead.centre_id]
    );
    const others = rows.filter((r) => !senderId || r.id !== Number(senderId));
    const admins = others.filter((r) => r.role === "admin").map((r) => r.id);
    const staff = others.filter((r) => r.role !== "admin").map((r) => r.id);

    // Admins are asked to assign it; staff are asked to take it
    if (admins.length) {
      await notificationService.createBulkNotifications({
        recipientStaffIds: admins,
        ...base(lead, senderId),
        ...notificationTemplates.leadNew({ ...leadData(lead), forAdmin: true }),
      });
    }
    if (staff.length) {
      await notificationService.createBulkNotifications({
        recipientStaffIds: staff,
        ...base(lead, senderId),
        ...notificationTemplates.leadNew({ ...leadData(lead), forAdmin: false }),
      });
    }
  } catch (e) {
    console.error("[leads] new-lead notifications failed:", e.message);
  }
}

/** Lead given to a staff member by someone else (admin assign / reassign). */
export async function notifyLeadAssigned(lead, assigneeId, byStaffId) {
  try {
    if (!assigneeId || Number(assigneeId) === Number(byStaffId)) return;
    const by = byStaffId
      ? (await pool.query(`SELECT name FROM staff WHERE id = $1`, [byStaffId])).rows[0]?.name
      : null;
    await notificationService.createNotification({
      recipientStaffId: Number(assigneeId),
      ...base(lead, byStaffId),
      ...notificationTemplates.leadAssigned({ ...leadData(lead), assignedByName: by }),
    });
  } catch (e) {
    console.error("[leads] assignment notification failed:", e.message);
  }
}