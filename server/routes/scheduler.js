import cron from 'node-cron';
import pool from '../db.js';
import generateDailyBalances from './walletDailyBalanceService.js';
import generateRecurringTasks from "../controllers/recurringTaskService.js";

// 👇 NEW: Automated Reports 👇
import { getReportData } from '../routes/reports/analyticsService.js';
import { buildPDF } from '../utils/exportBuilder.js';
import { sendReportEmail } from '../utils/emailService.js';

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
                    `Hello,\n\nPlease find attached the automated ${schedule.name} for ${yesterdayStr}.\n\n- Akshaya CRM System`, 
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

export default cron;