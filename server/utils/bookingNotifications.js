// utils/bookingNotifications.js
// A customer submitted an online booking → tell the people who can take it.
//   Booked with a centre (its link/QR, the centre they picked, or the
//   per-centre portal) → that centre's admin, staff and supervisors.
//   Booked for any centre → every active admin, staff member and supervisor.
// Never throws: a failed notification must not break the booking.

import pool from "../db.js";
import notificationService from "./notificationService.js";
import { notificationTemplates } from "./notificationTemplates.js";

export async function notifyNewBooking({ bookingId, customerId, centreId = null, serviceName, applicationNumber, missingDocuments = [] }) {
  try {
    const { rows: [customer] } = await pool.query(
      `SELECT name, primary_phone FROM customers WHERE id = $1`,
      [customerId]
    );
    let centreName = null;
    if (centreId) {
      const { rows } = await pool.query(`SELECT name FROM centres WHERE id = $1`, [centreId]);
      centreName = rows[0]?.name || null;
    }

    const { rows: recipients } = await pool.query(
      `SELECT DISTINCT s.id
         FROM staff s
        WHERE s.status = 'Active'
          AND (
            ${centreId
              ? `(s.centre_id = $1 AND COALESCE(LOWER(s.role), 'staff') IN ('admin', 'staff', 'supervisor'))
                 OR s.id = (SELECT admin_id FROM centres WHERE id = $1)`
              : `COALESCE(LOWER(s.role), 'staff') IN ('admin', 'staff', 'supervisor')`}
          )`,
      centreId ? [centreId] : []
    );
    if (!recipients.length) return 0;

    await notificationService.createBulkNotifications({
      recipientStaffIds: recipients.map((r) => r.id),
      senderStaffId: null,
      centreId: centreId || null,
      // the customer: staff open their dashboard's online bookings list,
      // admins open this customer's profile (the booking shows as waiting)
      relatedEntityType: "customer_booking",
      relatedEntityId: customerId,
      ...notificationTemplates.bookingNew({
        customerName: customer?.name || "A customer",
        phone: customer?.primary_phone ? `+91 ${customer.primary_phone}` : "—",
        serviceName: serviceName || "a service",
        applicationNumber: applicationNumber || `#${bookingId}`,
        centreName,
        missingDocuments: missingDocuments.length ? missingDocuments.join(", ") : null,
      }),
    });
    return recipients.length;
  } catch (e) {
    console.error("[bookings] new-booking notifications failed:", e.message);
    return 0;
  }
}
