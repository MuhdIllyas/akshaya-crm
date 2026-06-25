import pool from "../db.js";

export default async function generateRecurringTasks() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const templatesRes = await client.query(`
      SELECT *
      FROM task_templates
      WHERE is_active = true
      AND recurrence_type IS NOT NULL
    `);

    const now = new Date();

    for (const template of templatesRes.rows) {

      if (!isTemplateDue(template, now)) continue;

      if (template.is_global) {
        await generateForAllCentres(client, template, now);
      } else {
        await generateForSingleCentre(client, template, now);
      }

      await client.query(
        `UPDATE task_templates
         SET last_generated_at = NOW()
         WHERE id = $1`,
        [template.id]
      );
    }

    await client.query("COMMIT");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Recurring engine error:", err);
  } finally {
    client.release();
  }
}

/* ================================= */

function isTemplateDue(template, now) {

  if (!template.last_generated_at) {
    return true; // First cycle runs immediately
  }

  const last = new Date(template.last_generated_at);
  const diffDays = Math.floor(
    (now - last) / (1000 * 60 * 60 * 24)
  );

  switch (template.recurrence_type) {

    case "daily":
      return diffDays >= template.recurrence_interval;

    case "weekly":
      return now.getDay() === template.recurrence_day;

    case "monthly":
      return now.getDate() === template.recurrence_date;

    default:
      return false;
  }
}

/* ================================= */

async function generateForSingleCentre(client, template, now) {
  await generateTasksForCentre(client, template, template.centre_id, now);
}

async function generateForAllCentres(client, template, now) {
  const centres = await client.query(`SELECT id FROM centres`);
  for (const centre of centres.rows) {
    await generateTasksForCentre(client, template, centre.id, now);
  }
}

/* ================================= */

async function generateTasksForCentre(client, template, centreId, now) {

  let assignees = [];

  // ✅ specific staff
  if (template.assignment_mode === "specific_staff") {
    if (template.assigned_to) {
      assignees = [template.assigned_to];
    }
  }

  // ✅ centre admin
  else if (template.assignment_mode === "centre_admin") {

    const adminRes = await client.query(
      `SELECT id FROM staff
       WHERE centre_id=$1 AND role='admin'
       LIMIT 1`,
      [centreId]
    );

    if (adminRes.rows.length > 0) {
      assignees = [adminRes.rows[0].id];
    }
  }

  // ✅ all staff
  else if (template.assignment_mode === "all_staff") {

    const staffRes = await client.query(
      `SELECT id FROM staff
       WHERE centre_id=$1`,
      [centreId]
    );

    assignees = staffRes.rows.map(s => s.id);
  }

  for (const staffId of assignees) {

    const duplicateCheck = await client.query(
      `SELECT id FROM tasks
       WHERE template_id=$1
       AND assigned_to=$2
       AND DATE(created_at)=CURRENT_DATE`,
      [template.id, staffId]
    );

    if (duplicateCheck.rows.length > 0) continue;

    const dueDate = calculateDueDate(now, template.due_offset_days);

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
        dueDate
      ]
    );

    const task = taskRes.rows[0];

    if (dueDate) {
      await client.query(
        `INSERT INTO calendar_events
         (date, title, type, event_type,
          description, centre_id,
          related_task_id, created_by, created_at)
         VALUES ($1,$2,'task','task',$3,$4,$5,$6,NOW())`,
        [
          dueDate,
          template.title,
          template.description,
          centreId,
          task.id,
          template.assigned_by
        ]
      );
    }
  }
}

function calculateDueDate(now, offsetDays) {
  const due = new Date(now);
  due.setDate(due.getDate() + offsetDays);
  return due;
}