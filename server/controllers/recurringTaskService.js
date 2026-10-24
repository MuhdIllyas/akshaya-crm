// controllers/recurringTaskService.js
//
// What changed vs the old version
// 1. Weekly / monthly days are taken from the IST calendar. The cron runs at 00:15 IST,
//    which is still the PREVIOUS day in UTC, so getDay()/getDate() on a UTC server
//    fired weekly and monthly templates one day early.
// 2. Daily templates compared raw milliseconds: if today's run started a few ms earlier
//    than yesterday's, diffDays was 0 and the day was skipped. Now it compares IST dates,
//    and never runs a template twice on the same day.
// 3. Monthly: recurrence_date is a timestamp column, but the old code compared it to a
//    day number, so monthly templates never ran. Now the day of month is read from it
//    (a plain number also works). A "31st" template runs on the last day of short months.
// 4. Due date is an IST date (midnight IST), the same way tasks created from the UI store it.
//    The calendar event gets the same date (the old Date object could land a day early).
// 5. Only ACTIVE staff get tasks. One failing template no longer cancels all the others.
import pool from "../db.js";
import { istParts, addDays, daysBetween, daysInMonth, istMidnight } from "../utils/dates.js";

export default async function generateRecurringTasks() {
  const client = await pool.connect();
  const today = istParts(); // { ymd, year, month, day, weekday }

  try {
    await client.query("BEGIN");

    const templatesRes = await client.query(`
      SELECT *
      FROM task_templates
      WHERE is_active = true
        AND recurrence_type IS NOT NULL
    `);

    for (const template of templatesRes.rows) {
      if (!isTemplateDue(template, today)) continue;

      await client.query("SAVEPOINT tpl");
      try {
        if (template.is_global) {
          await generateForAllCentres(client, template, today);
        } else {
          await generateTasksForCentre(client, template, template.centre_id, today);
        }
        await client.query(`UPDATE task_templates SET last_generated_at = NOW() WHERE id = $1`, [template.id]);
        await client.query("RELEASE SAVEPOINT tpl");
      } catch (err) {
        await client.query("ROLLBACK TO SAVEPOINT tpl");
        console.error(`[Recurring] template ${template.id} failed:`, err.message);
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Recurring engine error:", err);
  } finally {
    client.release();
  }
}

/* ================================= */

function monthlyDay(template) {
  const v = template.recurrence_date;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return istParts(v).day;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
}

function isTemplateDue(template, today) {
  const lastYmd = template.last_generated_at ? istParts(new Date(template.last_generated_at)).ymd : null;

  if (!lastYmd) return true;              // first cycle runs immediately (same as before)
  if (lastYmd === today.ymd) return false; // already generated today

  switch (template.recurrence_type) {
    case "daily": {
      const every = Math.max(1, Number(template.recurrence_interval) || 1);
      return daysBetween(lastYmd, today.ymd) >= every;
    }
    case "weekly":
      return today.weekday === Number(template.recurrence_day);
    case "monthly": {
      const target = monthlyDay(template);
      if (!target) return false;
      return today.day === Math.min(target, daysInMonth(today.year, today.month));
    }
    default:
      return false;
  }
}

/* ================================= */

async function generateForAllCentres(client, template, today) {
  const centres = await client.query(`SELECT id FROM centres`);
  for (const centre of centres.rows) {
    await generateTasksForCentre(client, template, centre.id, today);
  }
}

async function generateTasksForCentre(client, template, centreId, today) {
  let assignees = [];

  if (template.assignment_mode === "specific_staff") {
    if (template.assigned_to) assignees = [template.assigned_to];
  } else if (template.assignment_mode === "centre_admin") {
    const adminRes = await client.query(
      `SELECT id FROM staff WHERE centre_id = $1 AND role = 'admin' AND status = 'Active' LIMIT 1`,
      [centreId]
    );
    if (adminRes.rows.length > 0) assignees = [adminRes.rows[0].id];
  } else if (template.assignment_mode === "all_staff") {
    const staffRes = await client.query(
      `SELECT id FROM staff WHERE centre_id = $1 AND status = 'Active'`,
      [centreId]
    );
    assignees = staffRes.rows.map((s) => s.id);
  }

  const offset = Number(template.due_offset_days);
  const dueYmd = Number.isFinite(offset) ? addDays(today.ymd, offset) : null;

  for (const staffId of assignees) {
    // already created for this staff today (IST day)?
    const duplicateCheck = await client.query(
      `SELECT id FROM tasks
        WHERE template_id = $1
          AND assigned_to = $2
          AND created_at >= ($3::date)::timestamp     AT TIME ZONE 'Asia/Kolkata'
          AND created_at <  ($3::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'`,
      [template.id, staffId, today.ymd]
    );
    if (duplicateCheck.rows.length > 0) continue;

    const taskRes = await client.query(
      `INSERT INTO tasks
         (centre_id, template_id, title, description,
          assigned_to, assigned_by, assigned_by_role,
          priority, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        centreId,
        template.id,
        template.title,
        template.description,
        staffId,
        template.assigned_by,
        template.assigned_by_role,
        template.priority,
        dueYmd ? istMidnight(dueYmd) : null,
      ]
    );

    const task = taskRes.rows[0];

    if (dueYmd) {
      await client.query(
        `INSERT INTO calendar_events
           (date, title, type, event_type, description, centre_id,
            related_task_id, created_by, created_at)
         VALUES ($1::date, $2, 'task', 'task', $3, $4, $5, $6, NOW())`,
        [dueYmd, template.title, template.description, centreId, task.id, template.assigned_by]
      );
    }
  }
}