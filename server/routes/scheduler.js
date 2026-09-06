import cron from 'node-cron';
import pool from '../db.js';
import generateDailyBalances from './walletDailyBalanceService.js';
import generateRecurringTasks from "../controllers/recurringTaskService.js";

// 👇 NEW: Automated Reports 👇
import { getReportData } from '../routes/reports/analyticsService.js';
import { buildPDF } from '../utils/exportBuilder.js';
import { sendReportEmail } from '../utils/emailService.js';
import { calculateHours, recalculateDayDeviation } from './salary.js';

// ==========================================
// 1. END OF DAY OPERATIONS (Midnight)
// ==========================================

// Run every day at 00:05 AM IST
cron.schedule("5 0 * * *", async () => {
  try {
    const now = new Date();
    now.setDate(now.getDate() - 1);

    const date = now.toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    console.log(`[CRON] Generating wallet balances for CLOSED DAY: ${date}`);
    await generateDailyBalances(date);
    
  } catch (err) {
    console.error("[CRON] Wallet daily balance job failed", err);
  }
}, {
  timezone: "Asia/Kolkata" // Forces the cron to run at 00:05 IST
});

// Run every day at 00:10 AM IST - Cleanup ALL old normal tokens
cron.schedule("10 0 * * *", async () => {
  try {
    const result = await pool.query(`
      DELETE FROM tokens
      WHERE type = 'normal'
      AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
    `);

    console.log(`[CRON] Deleted ${result.rowCount} old normal tokens (cleared queue for the new day)`);
  } catch (err) {
    console.error("[CRON] Token cleanup failed", err);
  }
}, {
  timezone: "Asia/Kolkata"
});

// Run every day at 00:15 AM IST for recurring tasks
cron.schedule("15 0 * * *", async () => {
  console.log("[CRON] Running recurring engine...");
  await generateRecurringTasks();
}, {
  timezone: "Asia/Kolkata"
});


// ==========================================
// 2. DYNAMIC REPORT SCHEDULER ENGINE
// ==========================================

const checkAndRunSchedules = async () => {
    const client = await pool.connect();
    try {
        // 1. Get the current exact time in IST (e.g., "08:00:00")
        const now = new Date();
        const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
        const istDate = new Date(istString);
        
        const hours = String(istDate.getHours()).padStart(2, '0');
        const minutes = String(istDate.getMinutes()).padStart(2, '0');
        const currentTime = `${hours}:${minutes}:00`; 
        
        const currentDayOfWeek = istDate.getDay(); // 0-6 (Sun-Sat)
        const currentDayOfMonth = istDate.getDate(); // 1-31

        // 2. Find schedules in the DB that are scheduled for RIGHT NOW
        const res = await client.query(`
            SELECT * FROM report_schedules 
            WHERE is_active = true 
            AND run_time = $1
            AND (
                (frequency = 'daily') OR
                (frequency = 'weekly' AND day_of_week = $2) OR
                (frequency = 'monthly' AND day_of_month = $3)
            )
        `, [currentTime, currentDayOfWeek, currentDayOfMonth]);

        const schedules = res.rows;
        if (schedules.length === 0) return; // Nothing scheduled for this specific minute

        console.log(`[CRON] 🕒 Found ${schedules.length} reports scheduled for ${currentTime}. Generating...`);

        // 3. Execute each schedule
        for (let schedule of schedules) {
            // 👇 NEW: Smart Email Resolution (Supports Specific Emails & Role Broadcasting) 👇
            let emails = [];

            if (schedule.specific_emails && schedule.specific_emails.length > 0) {
                // Mode 1: User typed in specific emails manually
                emails = schedule.specific_emails;
            } else if (schedule.recipient_roles && schedule.recipient_roles.length > 0) {
                // Mode 2: User selected roles. Filter safely by Centre (Superadmins always get it)
                const emailRes = await client.query(
                    `SELECT email FROM staff 
                     WHERE role = ANY($1) 
                     AND status = 'Active' 
                     AND ($2::int IS NULL OR centre_id = $2 OR role = 'superadmin')`,
                    [schedule.recipient_roles, schedule.centre_id]
                );
                emails = emailRes.rows.map(r => r.email).filter(e => e);
            }
            // 👆 END NEW EMAIL RESOLUTION 👆

            if (emails.length > 0) {
                console.log(`[CRON] 📧 Sending "${schedule.name}" to ${emails.length} recipients...`);
                
                // Get yesterday's date string for the report data
                const yest = new Date(istDate);
                yest.setDate(yest.getDate() - 1);
                const yesterdayStr = yest.toISOString().split('T')[0];

                // 👇 BULLETPROOF ARRAY PARSER 👇
                let parsedReportIds = schedule.report_ids;

                if (!parsedReportIds) {
                    parsedReportIds = [];
                } else if (typeof parsedReportIds === 'string') {
                    try {
                        parsedReportIds = JSON.parse(parsedReportIds);
                    } catch (e) {
                        parsedReportIds = parsedReportIds.replace(/[{}[\]"]/g, '').split(',').filter(Boolean).map(Number);
                    }
                } else if (!Array.isArray(parsedReportIds)) {
                    parsedReportIds = [parsedReportIds];
                }

                if (parsedReportIds.length === 0) {
                    console.log(`[CRON] ⚠️ Skipped "${schedule.name}" - No reports selected.`);
                    continue; 
                }

                // 👇 FETCH DATA WITH THE CORRECT OBJECT STRUCTURE 👇
                const data = await getReportData({
                    targetCentreId: schedule.centre_id || 'all',
                    fromDate: yesterdayStr,
                    toDate: yesterdayStr,
                    period: 'daily',
                    staffId: 'all',
                    reportIds: parsedReportIds
                });

                // Build the PDF
                const pdfBuffer = await buildPDF(data, parsedReportIds);

                // Send via Resend/Email Service
                const fileName = `${schedule.name.replace(/\s+/g, '_')}_${yesterdayStr}.pdf`;
                await sendReportEmail(
                    emails, 
                    `${schedule.name} - ${yesterdayStr}`, 
                    `Hello,\n\nPlease find attached the automated ${schedule.name} for ${yesterdayStr}.\n\n- Akshaya Sahayi`, 
                    [{ filename: fileName, content: pdfBuffer }]
                );
            } else {
                console.log(`[CRON] ⚠️ Skipped "${schedule.name}" - No active emails found for roles: ${schedule.recipient_roles}`);
            }
        }
    } catch (error) {
        console.error('[CRON] Dynamic Scheduler Error:', error);
    } finally {
        client.release();
    }
};

// 👉 The "Tick" Engine: Runs every 1 minute to check for scheduled reports
cron.schedule("* * * * *", async () => {
    await checkAndRunSchedules();
}, {
    timezone: "Asia/Kolkata"
});

// Run every day at 00:20 AM IST - Cleanup previous days' chat_messages (OTPs and Notifications)
cron.schedule("20 0 * * *", async () => {
  try {
    // 1. Bulletproof JS Time Calculation
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istDate = new Date(utcTime + (330 * 60000));
    
    // 2. Format today's date in IST (Example: "2026-08-14")
    const todayIST = istDate.toISOString().split('T')[0]; 
    
    // 3. Create a strict Postgres timestamp string for 00:00:00 IST today
    const cutoffTimestamp = `${todayIST} 00:00:00+05:30`;

    // 4. Delete specific OTP & text notification messages strictly older than midnight
    const result = await pool.query(`
      DELETE FROM chat_messages
      WHERE (message LIKE '🚨 OTP RECEIVED 🚨%' OR message LIKE '📩 New Text Message%')
      AND created_at < $1::timestamptz
    `, [cutoffTimestamp]);

    console.log(`[CRON] 🗑️ Deleted ${result.rowCount} old automated chat messages (older than ${cutoffTimestamp})`);
  } catch (err) {
    console.error("[CRON] Automated chat messages cleanup failed", err);
  }
}, {
  timezone: "Asia/Kolkata"
});

// Run every day at 23:55 (11:55 PM) - Auto-mark Absent
cron.schedule('55 23 * * *', async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // This single query finds all active staff on a working day who have NO attendance record
    // for today (whether present, leave, or otherwise) and marks them absent.
    const result = await client.query(`
      INSERT INTO attendance (staff_id, date, status, created_at)
      SELECT s.id, CURRENT_DATE, 'absent', NOW()
      FROM staff s
      WHERE s.status = 'Active'
        -- 1. Ensure today is an official working day for their specific centre
        AND EXISTS (
          SELECT 1 FROM calendar_events ce 
          WHERE ce.centre_id = s.centre_id 
            AND ce.date = CURRENT_DATE 
            AND ce.type = 'working'
        )
        -- 2. Ensure they don't already have an attendance record for today
        AND NOT EXISTS (
          SELECT 1 FROM attendance a 
          WHERE a.staff_id = s.id 
            AND a.date = CURRENT_DATE
        )
      RETURNING id;
    `);

    await client.query('COMMIT');
    console.log(`Auto-marked ${result.rowCount} staff members as absent.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in auto-absent cron job:', err);
  } finally {
    client.release();
  }
});

// ==========================================
// AUTO PUNCH-OUT AT END OF DAY
// Runs every day at 23:59 IST
// ==========================================
cron.schedule('59 23 * * *', async () => {
  const client = await pool.connect();

  try {
    // --------------------------------------------------
    // 1. Get today's date in IST directly from PostgreSQL
    // --------------------------------------------------
    const dateRes = await client.query(`
      SELECT
        (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date AS today
    `);

    const today = dateRes.rows[0].today;

    console.log(
      `[CRON] ========================================`
    );
    console.log(
      `[CRON] Auto punch-out started`
    );
    console.log(
      `[CRON] Date: ${today}`
    );

    // --------------------------------------------------
    // 2. Find ALL open attendance sessions for today
    // --------------------------------------------------
    const openPunches = await client.query(`
      SELECT
        a.id,
        a.staff_id,
        a.punch_in,
        a.punch_out,
        a.breaks,
        a.status,
        a.date,
        s.name AS staff_name,
        s.centre_id
      FROM attendance a
      JOIN staff s
        ON s.id = a.staff_id
      WHERE a.date = $1
        AND a.punch_in IS NOT NULL
        AND a.punch_out IS NULL
      ORDER BY a.staff_id, a.punch_in
    `, [today]);

    console.log(
      `[CRON] Open attendance sessions found: ${openPunches.rows.length}`
    );

    if (openPunches.rows.length === 0) {
      console.log(
        `[CRON] No open punches found. Nothing to auto punch-out.`
      );
      console.log(
        `[CRON] ========================================`
      );
      return;
    }

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // --------------------------------------------------
    // 3. Process every open punch independently
    // --------------------------------------------------
    for (const record of openPunches.rows) {

      try {
        await client.query('BEGIN');

        console.log(
          `[CRON] Processing attendance ${record.id} ` +
          `| Staff: ${record.staff_id} (${record.staff_name}) ` +
          `| Punch-in: ${record.punch_in}`
        );

        // --------------------------------------------------
        // 4. Get the staff member's effective schedule
        // --------------------------------------------------
        const scheduleRes = await client.query(`
          SELECT
            start_time,
            end_time,
            standard_hours
          FROM staff_schedules
          WHERE staff_id = $1
            AND effective_from <= $2::date
            AND (
              effective_to IS NULL
              OR effective_to >= $2::date
            )
          ORDER BY effective_from DESC
          LIMIT 1
        `, [
          record.staff_id,
          today
        ]);

        let endTime;

        if (scheduleRes.rows.length > 0) {
          endTime = scheduleRes.rows[0].end_time;

          console.log(
            `[CRON] Schedule found for staff ${record.staff_id}: ` +
            `start=${scheduleRes.rows[0].start_time}, ` +
            `end=${endTime}`
          );
        } else {
          // Fallback if staff has no schedule
          endTime = '18:00:00';

          console.warn(
            `[CRON] ⚠️ No schedule found for staff ${record.staff_id}. ` +
            `Using fallback end time ${endTime}`
          );
        }

        // --------------------------------------------------
        // 5. Normalize end time
        // PostgreSQL TIME normally comes back as HH:MM:SS
        // calculateHours accepts HH:MM or HH:MM:SS.
        // --------------------------------------------------
        if (endTime instanceof Date) {
          endTime = endTime.toTimeString().substring(0, 8);
        } else {
          endTime = String(endTime).trim();

          // Remove timezone if somehow returned
          if (endTime.includes('+')) {
            endTime = endTime.split('+')[0];
          }

          // Ensure HH:MM:SS
          if (/^\d{2}:\d{2}$/.test(endTime)) {
            endTime = `${endTime}:00`;
          }
        }

        // --------------------------------------------------
        // 6. Normalize punch-in
        // --------------------------------------------------
        let punchIn = record.punch_in;

        if (punchIn instanceof Date) {
          punchIn = punchIn.toTimeString().substring(0, 8);
        } else {
          punchIn = String(punchIn).trim();

          if (punchIn.includes('+')) {
            punchIn = punchIn.split('+')[0];
          }

          if (/^\d{2}:\d{2}$/.test(punchIn)) {
            punchIn = `${punchIn}:00`;
          }
        }

        // --------------------------------------------------
        // 7. Calculate total worked hours
        // --------------------------------------------------
        const hours = calculateHours(
          punchIn,
          endTime,
          record.breaks
        );

        console.log(
          `[CRON] Calculated hours for staff ${record.staff_id}: ` +
          `${hours}`
        );

        // --------------------------------------------------
        // 8. AUTO PUNCH OUT
        //
        // IMPORTANT:
        // Only update the specific open record.
        // If someone manually punched out meanwhile,
        // rowCount will be 0 and we skip it.
        // --------------------------------------------------
        const updateRes = await client.query(`
          UPDATE attendance
          SET
            punch_out = $1::time,
            hours = $2,
            status = 'present',
            updated_at = NOW()
          WHERE id = $3
            AND punch_in IS NOT NULL
            AND punch_out IS NULL
          RETURNING id, staff_id, punch_in, punch_out, hours
        `, [
          endTime,
          hours,
          record.id
        ]);

        // --------------------------------------------------
        // 9. Check whether update actually happened
        // --------------------------------------------------
        if (updateRes.rowCount === 0) {
          await client.query('ROLLBACK');

          skippedCount++;

          console.log(
            `[CRON] ⚠️ Attendance ${record.id} was already closed. ` +
            `Skipping.`
          );

          continue;
        }

        // --------------------------------------------------
        // 10. Recalculate daily late/extra
        // --------------------------------------------------
        await recalculateDayDeviation(
          client,
          record.staff_id,
          today
        );

        // --------------------------------------------------
        // 11. Commit this staff member
        // --------------------------------------------------
        await client.query('COMMIT');

        successCount++;

        console.log(
          `[CRON] ✅ AUTO PUNCH-OUT SUCCESS`
        );
        console.log(
          `[CRON] Staff: ${record.staff_id} (${record.staff_name})`
        );
        console.log(
          `[CRON] Attendance ID: ${record.id}`
        );
        console.log(
          `[CRON] Punch-in: ${punchIn}`
        );
        console.log(
          `[CRON] Punch-out: ${endTime}`
        );
        console.log(
          `[CRON] Hours: ${hours}`
        );

      } catch (staffError) {

        // Roll back only this staff member
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error(
            `[CRON] Rollback failed for attendance ${record.id}:`,
            rollbackError
          );
        }

        errorCount++;

        console.error(
          `[CRON] ❌ AUTO PUNCH-OUT FAILED`
        );
        console.error(
          `[CRON] Attendance ID: ${record.id}`
        );
        console.error(
          `[CRON] Staff ID: ${record.staff_id}`
        );
        console.error(
          `[CRON] Staff name: ${record.staff_name}`
        );
        console.error(
          `[CRON] Error:`,
          staffError
        );

        // Continue with the next staff member
        continue;
      }
    }

    // --------------------------------------------------
    // 12. Final summary
    // --------------------------------------------------
    console.log(
      `[CRON] ========================================`
    );
    console.log(
      `[CRON] Auto punch-out completed`
    );
    console.log(
      `[CRON] Date       : ${today}`
    );
    console.log(
      `[CRON] Found      : ${openPunches.rows.length}`
    );
    console.log(
      `[CRON] Successful : ${successCount}`
    );
    console.log(
      `[CRON] Skipped    : ${skippedCount}`
    );
    console.log(
      `[CRON] Failed     : ${errorCount}`
    );
    console.log(
      `[CRON] ========================================`
    );

  } catch (err) {

    console.error(
      '[CRON] ❌ AUTO PUNCH-OUT JOB FAILED:',
      err
    );

  } finally {
    client.release();
  }

}, {
  timezone: 'Asia/Kolkata'
});

export default cron;
