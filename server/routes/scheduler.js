import cron from 'node-cron';
import pool from '../db.js';
import generateDailyBalances from './walletDailyBalanceService.js';
import generateRecurringTasks from "../controllers/recurringTaskService.js";

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
  console.log("Running recurring engine...");
  await generateRecurringTasks();
}, {
  timezone: "Asia/Kolkata"
});

export default cron;