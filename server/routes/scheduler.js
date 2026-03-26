import cron from 'node-cron';
import pool from '../db.js';
import generateDailyBalances from './walletDailyBalanceService.js';
import generateRecurringTasks from "../controllers/recurringTaskService.js";

// Run every day at 00:05 AM
cron.schedule("5 0 * * *", async () => {
  try {
    // 1. Get the current time
    const now = new Date();
    
    // 2. Subtract 1 day to get 'Yesterday'
    now.setDate(now.getDate() - 1);

    // 3. Format 'Yesterday' as YYYY-MM-DD for the database
    const date = now.toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    console.log(`[CRON] Generating wallet balances for CLOSED DAY: ${date}`);
    
    // 4. Run the service for Yesterday
    await generateDailyBalances(date);
    
  } catch (err) {
    console.error("[CRON] Wallet daily balance job failed", err);
  }
});

// Run every day at 00:10 AM - Cleanup pending normal tokens
cron.schedule("10 0 * * *", async () => {
  try {
    const result = await pool.query(`
      DELETE FROM tokens
      WHERE type = 'normal'
      AND status = 'pending'
      AND created_at::date < CURRENT_DATE
    `);

    console.log(`[CRON] Deleted ${result.rowCount} pending tokens`);
  } catch (err) {
    console.error("[CRON] Token cleanup failed", err);
  }
});

//for recurring tasks
cron.schedule("15 0 * * *", async () => {
  console.log("Running recurring engine...");
  await generateRecurringTasks();
});

export default cron;