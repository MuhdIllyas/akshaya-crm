import express from "express";
import jwt from "jsonwebtoken";
import pool from "../db.js";

const router = express.Router();

/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        error: "Invalid token",
      });
    }

    req.user = user;
    next();
  });
};

router.use(authenticateToken);

/* =========================================================
   HELPERS
========================================================= */

const isAdmin = (role) => {
  return ["admin", "superadmin"].includes(role);
};

const isSuperAdmin = (role) => {
  return role === "superadmin";
};

/* =========================================================
   GET TEAMS
========================================================= */

router.get("/", async (req, res) => {
  const client = await pool.connect();

  try {
    let query = `
      SELECT
        t.*,

        (
          SELECT COUNT(*)
          FROM team_members tm
          WHERE tm.team_id = t.id
          AND tm.is_active = true
        ) AS member_count

      FROM teams t
    `;

    const values = [];

    // STAFF
    if (req.user.role === "staff") {
      query += `
        JOIN team_members stm
          ON stm.team_id = t.id
      `;

      query += `
        WHERE stm.staff_id = $1
        AND stm.is_active = true
      `;

      values.push(req.user.id);
    }

    // ADMIN
    else if (req.user.role === "admin") {
      query += `
        WHERE (
          t.centre_id = $1
          AND t.is_global = false
        )
      `;

      values.push(req.user.centre_id);
    }

    // SUPERADMIN
    else if (req.user.role === "superadmin") {
      query += `
        ORDER BY t.created_at DESC
      `;
    }

    const result = await client.query(query, values);

    res.json(result.rows);

  } catch (err) {
    console.error("Get teams error:", err);

    res.status(500).json({
      error: "Failed to fetch teams",
    });

  } finally {
    client.release();
  }
});

/* =========================================================
   SHARED HELPERS (service charges + targets)

   Everything here measures SERVICE CHARGES: the sum of
   service_entries.service_charges on COMPLETED services.
   This is the same definition the staff targets, the staff
   dashboard and the admin/superadmin dashboards use.
========================================================= */

const num = (v) => parseFloat(v) || 0;

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const cleanDate = (v) => (typeof v === "string" && YMD.test(v) ? v : null);

// Admin: own centre's (non-global) teams. Staff: teams they belong to. Superadmin: all.
const checkTeamAccess = async (client, user, teamId) => {
  if (!/^\d+$/.test(String(teamId))) {
    return { ok: false, status: 400, error: "Invalid team id" };
  }

  const { rows } = await client.query(
    `SELECT id, centre_id, is_global FROM teams WHERE id = $1`,
    [teamId]
  );

  const team = rows[0];

  if (!team) return { ok: false, status: 404, error: "Team not found" };
  if (user.role === "superadmin") return { ok: true, team };

  if (user.role === "admin") {
    if (team.is_global || team.centre_id !== user.centre_id) {
      return { ok: false, status: 403, error: "Access denied" };
    }
    return { ok: true, team };
  }

  const member = await client.query(
    `SELECT 1 FROM team_members
     WHERE team_id = $1 AND staff_id = $2 AND is_active = true`,
    [teamId, user.id]
  );

  if (member.rows.length === 0) {
    return { ok: false, status: 403, error: "Access denied" };
  }

  return { ok: true, team };
};

/* ---------------------------------------------------------
   TEAM TARGETS

   Two ways to set a team's monthly target (team_targets.target_mode):

   'staff'  (default) the sum of its members' individual targets,
            measured on those members' completed service charges
   'manual' a figure typed in for the team (team_targets.monthly_target),
            measured on the completed service charges of the services
            done for this team this month

   Needs: ALTER TABLE team_targets
            ADD COLUMN IF NOT EXISTS target_mode VARCHAR(10) NOT NULL DEFAULT 'staff';
   Until that is run every team simply behaves as 'staff'.

   The 'staff' maths:

   - monthly target  = SUM(staff_monthly_targets.target_amount)
                       for the current month, members with a target
   - achieved        = those members' completed service charges
                       this month (exactly what each staff sees)
   - daily target    = SUM of each member's ROUND(monthly / days)
   Members without a target this month are listed but add nothing
   to the target or to the achieved amount, so progress stays fair.
   Works for global teams: it goes through staff, not centre.
--------------------------------------------------------- */
const fetchTeamTargets = async (client, teamIds, { photos = false } = {}) => {
  const out = new Map();
  if (!teamIds.length) return out;

  const { rows } = await client.query(
    `
    WITH cal AS (
      SELECT
        date_trunc('month', CURRENT_DATE)::date AS month_start,
        EXTRACT(DAY FROM CURRENT_DATE)::int AS day_of_month,
        EXTRACT(DAY FROM (
          date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day'
        ))::int AS days_in_month
    ),
    roster AS (
      SELECT tm.team_id, tm.staff_id, tm.is_primary
      FROM team_members tm
      WHERE tm.team_id = ANY($1::bigint[])
        AND tm.is_active = true
    ),
    daily AS (
      SELECT se.staff_id, se.created_at::date AS day, SUM(se.service_charges) AS sc
      FROM service_entries se
      WHERE se.status = 'completed'
        AND se.created_at >= date_trunc('month', CURRENT_DATE)
        AND se.staff_id IN (SELECT staff_id FROM roster)
      GROUP BY se.staff_id, se.created_at::date
    )
    SELECT
      r.team_id,
      r.is_primary,
      s.id   AS staff_id,
      s.name AS staff_name,
      s.role AS staff_role,
      CASE WHEN $2::boolean THEN s.photo END AS staff_photo,
      c.name AS centre_name,
      COALESCE(t.target_amount, 0) AS target_amount,
      cal.day_of_month,
      cal.days_in_month,
      ROUND(COALESCE(t.target_amount, 0) / cal.days_in_month) AS daily_target,
      COALESCE((SELECT SUM(d.sc) FROM daily d WHERE d.staff_id = s.id), 0) AS month_achieved,
      COALESCE((SELECT SUM(d.sc) FROM daily d
                WHERE d.staff_id = s.id AND d.day = CURRENT_DATE), 0) AS today_achieved,
      (SELECT COUNT(*) FROM daily d
        WHERE d.staff_id = s.id
          AND d.day < CURRENT_DATE
          AND COALESCE(t.target_amount, 0) > 0
          AND d.sc >= ROUND(t.target_amount / cal.days_in_month))::int AS days_met
    FROM roster r
    CROSS JOIN cal
    JOIN staff s ON s.id = r.staff_id
    LEFT JOIN centres c ON c.id = s.centre_id
    LEFT JOIN staff_monthly_targets t
      ON t.staff_id = s.id AND t.month = cal.month_start
    ORDER BY s.name
    `,
    [teamIds, photos]
  );

  for (const id of teamIds) {
    out.set(Number(id), {
      dayOfMonth: null,
      daysInMonth: null,
      memberCount: 0,
      membersWithTarget: 0,
      target: 0,
      achieved: 0,
      progress: 0,
      dailyTarget: 0,
      today: 0,
      metToday: 0,
      onPace: false,
      mode: "staff",
      staffTarget: 0,
      manualTarget: 0,
      members: [],
    });
  }

  for (const r of rows) {
    const t = out.get(Number(r.team_id));
    if (!t) continue;

    t.dayOfMonth = r.day_of_month;
    t.daysInMonth = r.days_in_month;

    const target = num(r.target_amount);
    const achieved = num(r.month_achieved);
    const dailyTarget = num(r.daily_target);
    const today = num(r.today_achieved);
    const hasTarget = target > 0;
    const expected = hasTarget ? target * (r.day_of_month / r.days_in_month) : 0;

    t.memberCount += 1;

    if (hasTarget) {
      t.membersWithTarget += 1;
      t.target += target;
      t.achieved += achieved;
      t.dailyTarget += dailyTarget;
      t.today += today;
      if (today >= dailyTarget && dailyTarget > 0) t.metToday += 1;
    }

    t.members.push({
      staff_id: r.staff_id,
      name: r.staff_name,
      role: r.staff_role,
      photo: r.staff_photo || null,
      centre_name: r.centre_name,
      is_primary: r.is_primary,
      has_target: hasTarget,
      target,
      achieved,
      progress: hasTarget ? (achieved / target) * 100 : 0,
      daily_target: dailyTarget,
      today,
      today_met: hasTarget && dailyTarget > 0 && today >= dailyTarget,
      days_met: r.days_met || 0,
      complete_days: Math.max(r.day_of_month - 1, 0),
      on_pace: hasTarget && achieved >= expected,
    });
  }

  for (const t of out.values()) {
    t.staffTarget = t.target;
  }

  // Teams whose target is typed in instead of summed from staff
  let manual = [];

  try {
    const settings = await client.query(
      `SELECT team_id, target_mode, monthly_target
       FROM team_targets
       WHERE team_id = ANY($1::bigint[])`,
      [teamIds]
    );
    manual = settings.rows.filter(
      (r) => r.target_mode === "manual" && num(r.monthly_target) > 0
    );
  } catch (err) {
    console.warn("team_targets.target_mode missing? Run the migration. ", err.message);
  }

  if (manual.length) {
    const done = await client.query(
      `
      SELECT se.team_id,
             COALESCE(SUM(se.service_charges), 0) AS month_sc,
             COALESCE(SUM(CASE WHEN se.created_at::date = CURRENT_DATE
                               THEN se.service_charges ELSE 0 END), 0) AS today_sc
      FROM service_entries se
      WHERE se.team_id = ANY($1::bigint[])
        AND se.status = 'completed'
        AND se.created_at >= date_trunc('month', CURRENT_DATE)
      GROUP BY se.team_id
      `,
      [manual.map((r) => r.team_id)]
    );

    const doneBy = new Map(done.rows.map((r) => [Number(r.team_id), r]));

    for (const r of manual) {
      const t = out.get(Number(r.team_id));
      if (!t) continue;

      const d = doneBy.get(Number(r.team_id));
      const target = num(r.monthly_target);
      const days = t.daysInMonth || 30;

      t.mode = "manual";
      t.manualTarget = target;
      t.target = target;
      t.achieved = d ? num(d.month_sc) : 0;
      t.dailyTarget = Math.round(target / days);
      t.today = d ? num(d.today_sc) : 0;
    }
  }

  for (const t of out.values()) {
    t.progress = t.target > 0 ? (t.achieved / t.target) * 100 : 0;
    t.onPace =
      t.target > 0 &&
      t.dayOfMonth !== null &&
      t.achieved >= t.target * (t.dayOfMonth / t.daysInMonth);
  }

  return out;
};

/* ---------------------------------------------------------
   PER-TEAM SERIES for the sparklines on the Teams screen
   Daily buckets up to 60 days, monthly beyond that.
   Empty buckets are filled with zero so the line is honest.
--------------------------------------------------------- */
const fetchTeamSeries = async (client, teamIds, from, to) => {
  const out = new Map();
  if (!teamIds.length || !from || !to) return out;

  const DAY = 86400000;
  const start = Date.parse(from);
  const end = Date.parse(to);

  if (!(end >= start) || (end - start) / DAY > 800) return out;

  const days = Math.round((end - start) / DAY) + 1;
  const monthly = days > 60;
  const fmt = monthly ? "YYYY-MM" : "YYYY-MM-DD";

  const labels = [];

  if (monthly) {
    const d = new Date(start);
    d.setUTCDate(1);
    while (d.getTime() <= end) {
      labels.push(d.toISOString().slice(0, 7));
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
  } else {
    for (let t = start; t <= end; t += DAY) {
      labels.push(new Date(t).toISOString().slice(0, 10));
    }
  }

  const [svc, exp] = await Promise.all([
    client.query(
      `
      SELECT se.team_id, TO_CHAR(se.created_at, '${fmt}') AS bucket,
             SUM(se.service_charges) AS total
      FROM service_entries se
      WHERE se.team_id = ANY($1::bigint[])
        AND se.status = 'completed'
        AND se.created_at >= $2::date
        AND se.created_at < ($3::date + INTERVAL '1 day')
      GROUP BY se.team_id, TO_CHAR(se.created_at, '${fmt}')
      `,
      [teamIds, from, to]
    ),
    client.query(
      `
      SELECT e.team_id, TO_CHAR(e.expense_date, '${fmt}') AS bucket,
             SUM(e.amount) AS total
      FROM expenses e
      WHERE e.team_id = ANY($1::bigint[])
        AND e.status IN ('approved', 'auto_approved')
        AND COALESCE(e.is_reversal, FALSE) = FALSE
        AND e.expense_date >= $2::date
        AND e.expense_date <= $3::date
      GROUP BY e.team_id, TO_CHAR(e.expense_date, '${fmt}')
      `,
      [teamIds, from, to]
    ),
  ]);

  const sc = new Map(svc.rows.map((r) => [`${r.team_id}|${r.bucket}`, num(r.total)]));
  const ex = new Map(exp.rows.map((r) => [`${r.team_id}|${r.bucket}`, num(r.total)]));

  for (const id of teamIds) {
    out.set(
      Number(id),
      labels.map((label) => ({
        label,
        service_charges: sc.get(`${id}|${label}`) || 0,
        expense: ex.get(`${id}|${label}`) || 0,
      }))
    );
  }

  return out;
};

/* =========================================================
   TEAM FINANCIAL SUMMARY
========================================================= */

router.get("/analytics/summary", async (req, res) => {
  const client = await pool.connect();

  try {
    const { team_id } = req.query;
    const from = cleanDate(req.query.from);
    const to = cleanDate(req.query.to);

    let params = [];
    let paramIndex = 1;

    let teamWhere = "";
    let serviceDateFilter = "";
    let paymentDateFilter = "";
    let expenseDateFilter = "";

    /* TEAM FILTER */

    if (team_id) {
      if (!/^\d+$/.test(String(team_id))) {
        return res.status(400).json({ error: "Invalid team id" });
      }

      teamWhere += `
        AND t.id = $${paramIndex}
      `;

      params.push(team_id);
      paramIndex++;
    }

    /* ROLE FILTERS */

    if (req.user.role === "admin") {
      teamWhere += `
        AND t.centre_id = $${paramIndex}
        AND t.is_global = false
      `;

      params.push(req.user.centre_id);
      paramIndex++;
    }

    if (req.user.role === "staff") {
      teamWhere += `
        AND EXISTS (
          SELECT 1
          FROM team_members stm
          WHERE stm.team_id = t.id
          AND stm.staff_id = $${paramIndex}
        )
      `;

      params.push(req.user.id);
      paramIndex++;
    }

    /* DATE FILTERS (inclusive of both days) */

    if (from) {
      serviceDateFilter += `
        AND se.created_at >= $${paramIndex}::date
      `;

      paymentDateFilter += `
        AND p.created_at >= $${paramIndex}::date
      `;

      expenseDateFilter += `
        AND e.expense_date >= $${paramIndex}::date
      `;

      params.push(from);
      paramIndex++;
    }

    if (to) {
      serviceDateFilter += `
        AND se.created_at < ($${paramIndex}::date + INTERVAL '1 day')
      `;

      paymentDateFilter += `
        AND p.created_at < ($${paramIndex}::date + INTERVAL '1 day')
      `;

      expenseDateFilter += `
        AND e.expense_date <= $${paramIndex}::date
      `;

      params.push(to);
      paramIndex++;
    }

    const result = await client.query(
      `
      SELECT

        t.id,
        t.name,
        t.description,
        t.is_global,
        t.centre_id,
        t.status,

        (
          SELECT COUNT(*)
          FROM team_members tm
          WHERE tm.team_id = t.id
          AND tm.is_active = true
        ) AS member_count,

        /* SERVICE CHARGES (completed services) - the headline number */

        COALESCE((
          SELECT SUM(se.service_charges)
          FROM service_entries se
          WHERE se.team_id = t.id
            AND se.status = 'completed'
          ${serviceDateFilter}
        ), 0) AS service_charges,

        COALESCE((
          SELECT COUNT(*)
          FROM service_entries se
          WHERE se.team_id = t.id
            AND se.status = 'completed'
          ${serviceDateFilter}
        ), 0) AS services_completed,

        /* BILLED to customers (completed services) */

        COALESCE((
          SELECT SUM(se.total_charges)
          FROM service_entries se
          WHERE se.team_id = t.id
            AND se.status = 'completed'
          ${serviceDateFilter}
        ), 0) AS revenue_billed,

        /* EXPENSES (approved, not reversals) */

        COALESCE((
          SELECT SUM(e.amount)
          FROM expenses e
          WHERE e.team_id = t.id
            AND e.status IN ('approved', 'auto_approved')
            AND COALESCE(e.is_reversal, FALSE) = FALSE
          ${expenseDateFilter}
        ), 0) AS expense,

        /* LEGACY FIELDS - still returned for any other screen using them */

        COALESCE((
          SELECT SUM(se.total_charges)
          FROM service_entries se
          WHERE se.team_id = t.id
          ${serviceDateFilter}
        ), 0) AS expected_revenue,

        COALESCE((
          SELECT SUM(p.amount)
          FROM payments p
          JOIN service_entries se
            ON se.id = p.service_entry_id
          WHERE se.team_id = t.id
            AND p.status = 'received'
            AND COALESCE(p.is_reversal, FALSE) = FALSE
            AND NOT EXISTS (
              SELECT 1
              FROM wallet_transactions wt
              WHERE wt.reference_payment_id = p.id
              AND COALESCE(wt.is_reversal, FALSE) = TRUE
            )
            ${paymentDateFilter}
        ), 0) AS collected_revenue,

        COALESCE((
          SELECT SUM(se.department_charges)
          FROM service_entries se
          WHERE se.team_id = t.id
          ${serviceDateFilter}
        ), 0) AS department_charges,

        COALESCE((
          SELECT SUM(se.service_charges)
          FROM service_entries se
          WHERE se.team_id = t.id
          ${serviceDateFilter}
        ), 0) AS service_profit

      FROM teams t

      WHERE 1=1

      ${teamWhere}

      ORDER BY service_charges DESC, t.name
      `,
      params
    );

    const targetMap = await fetchTeamTargets(
      client,
      result.rows.map((r) => r.id)
    );

    const seriesMap = await fetchTeamSeries(
      client,
      result.rows.map((r) => r.id),
      from,
      to
    );

    const teams = result.rows.map((team) => {
      const serviceCharges = num(team.service_charges);
      const expense = num(team.expense);
      const expectedRevenue = num(team.expected_revenue);
      const collectedRevenue = num(team.collected_revenue);

      // targets: strip the member list, the list screen only needs the totals
      const { members, ...targets } = targetMap.get(Number(team.id)) || {};

      return {
        ...team,

        service_charges: serviceCharges,
        services_completed: Number(team.services_completed || 0),
        revenue_billed: num(team.revenue_billed),
        expense,

        // net profit = service charges earned less approved expenses
        net_profit: serviceCharges - expense,

        targets,
        series: seriesMap.get(Number(team.id)) || [],

        expected_revenue: expectedRevenue,
        collected_revenue: collectedRevenue,
        pending_revenue: expectedRevenue - collectedRevenue,
        department_charges: num(team.department_charges),
        service_profit: num(team.service_profit),
      };
    });

    const totals = teams.reduce(
      (acc, row) => {
        acc.service_charges += row.service_charges;
        acc.services_completed += row.services_completed;
        acc.revenue_billed += row.revenue_billed;
        acc.expense += row.expense;
        acc.net_profit += row.net_profit;
        acc.target += row.targets.target || 0;
        acc.target_achieved += row.targets.achieved || 0;

        acc.expected_revenue += row.expected_revenue;
        acc.collected_revenue += row.collected_revenue;
        acc.pending_revenue += row.pending_revenue;
        acc.department_charges += row.department_charges;
        acc.service_profit += row.service_profit;

        return acc;
      },
      {
        service_charges: 0,
        services_completed: 0,
        revenue_billed: 0,
        expense: 0,
        net_profit: 0,
        target: 0,
        target_achieved: 0,
        expected_revenue: 0,
        collected_revenue: 0,
        pending_revenue: 0,
        department_charges: 0,
        service_profit: 0,
      }
    );

    res.json({
      totals,
      teams,
    });

  } catch (err) {

    console.error("Team analytics error:", err);

    res.status(500).json({
      error: "Failed to load team analytics",
    });

  } finally {

    client.release();

  }
});

/* =========================================================
   TEAM TARGETS (sum of members' individual targets)
========================================================= */

router.get("/:id/targets", async (req, res) => {
  const client = await pool.connect();

  try {
    const access = await checkTeamAccess(client, req.user, req.params.id);

    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const map = await fetchTeamTargets(client, [Number(req.params.id)], {
      photos: req.query.photos === "1",
    });

    res.json(map.get(Number(req.params.id)));

  } catch (err) {

    console.error("Team targets error:", err);

    res.status(500).json({
      error: "Failed to load team targets",
    });

  } finally {

    client.release();

  }
});

/* =========================================================
   TEAM MEMBER CONTRIBUTION (service charges per member)
   Optional ?from=YYYY-MM-DD&to=YYYY-MM-DD
========================================================= */

router.get("/:teamId/contribution", async (req, res) => {
  const client = await pool.connect();

  try {
    const { teamId } = req.params;

    const access = await checkTeamAccess(client, req.user, teamId);

    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const from = cleanDate(req.query.from);
    const to = cleanDate(req.query.to);

    const params = [teamId];
    let seDates = "";
    let expDates = "";

    if (from) {
      params.push(from);
      seDates += ` AND se.created_at >= $${params.length}::date`;
      expDates += ` AND e.expense_date >= $${params.length}::date`;
    }

    if (to) {
      params.push(to);
      seDates += ` AND se.created_at < ($${params.length}::date + INTERVAL '1 day')`;
      expDates += ` AND e.expense_date <= $${params.length}::date`;
    }

    const result = await client.query(
      `
      SELECT

        s.id,
        s.name,
        s.role,
        s.photo,
        c.name AS centre_name,

        tm.is_primary,

        COALESCE((
          SELECT SUM(se.service_charges)
          FROM service_entries se
          WHERE se.staff_id = s.id
            AND se.team_id = $1
            AND se.status = 'completed'
            ${seDates}
        ), 0) AS service_charges,

        COALESCE((
          SELECT COUNT(*)
          FROM service_entries se
          WHERE se.staff_id = s.id
            AND se.team_id = $1
            AND se.status = 'completed'
            ${seDates}
        ), 0) AS services_completed,

        COALESCE((
          SELECT SUM(e.amount)
          FROM expenses e
          WHERE e.staff_id = s.id
            AND e.team_id = $1
            AND e.status IN ('approved', 'auto_approved')
            AND COALESCE(e.is_reversal, FALSE) = FALSE
            ${expDates}
        ), 0) AS expense

      FROM team_members tm

      JOIN staff s
        ON s.id = tm.staff_id

      LEFT JOIN centres c
        ON c.id = s.centre_id

      WHERE tm.team_id = $1

      ORDER BY service_charges DESC, s.name
      `,
      params
    );

    const targets = await fetchTeamTargets(client, [Number(teamId)]);
    const byStaff = new Map(
      (targets.get(Number(teamId))?.members || []).map((m) => [Number(m.staff_id), m])
    );

    const rows = result.rows.map((member) => {
      const serviceCharges = num(member.service_charges);
      const expense = num(member.expense);
      const tgt = byStaff.get(Number(member.id));

      return {
        ...member,

        service_charges: serviceCharges,
        services_completed: Number(member.services_completed || 0),
        expense,
        net_profit: serviceCharges - expense,

        // this month's individual target (independent of the date range above)
        target: tgt ? tgt.target : 0,
        month_achieved: tgt ? tgt.achieved : 0,
        target_progress: tgt ? tgt.progress : 0,
        has_target: tgt ? tgt.has_target : false,
        on_pace: tgt ? tgt.on_pace : false,
      };
    });

    res.json(rows);

  } catch (err) {

    console.error("Contribution error:", err);

    res.status(500).json({
      error: "Failed to load contribution",
    });

  } finally {

    client.release();

  }
});

/* =========================================================
   TEAM MONTHLY TREND (service charges by month)
========================================================= */

router.get("/:teamId/trend", async (req, res) => {
  const client = await pool.connect();

  try {
    const { teamId } = req.params;

    const access = await checkTeamAccess(client, req.user, teamId);

    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const year = Number(req.query.year) || new Date().getFullYear();

    const result = await client.query(
      `
      WITH months AS (
        SELECT generate_series(1, 12) AS month
      )

      SELECT

        m.month,

        COALESCE((
          SELECT SUM(se.service_charges)
          FROM service_entries se
          WHERE se.team_id = $1
            AND se.status = 'completed'
            AND EXTRACT(MONTH FROM se.created_at) = m.month
            AND EXTRACT(YEAR FROM se.created_at) = $2
        ), 0) AS service_charges,

        COALESCE((
          SELECT COUNT(*)
          FROM service_entries se
          WHERE se.team_id = $1
            AND se.status = 'completed'
            AND EXTRACT(MONTH FROM se.created_at) = m.month
            AND EXTRACT(YEAR FROM se.created_at) = $2
        ), 0) AS services_completed,

        COALESCE((
          SELECT SUM(e.amount)
          FROM expenses e
          WHERE e.team_id = $1
            AND e.status IN ('approved', 'auto_approved')
            AND COALESCE(e.is_reversal, FALSE) = FALSE
            AND EXTRACT(MONTH FROM e.expense_date) = m.month
            AND EXTRACT(YEAR FROM e.expense_date) = $2
        ), 0) AS expense

      FROM months m

      ORDER BY m.month
      `,
      [teamId, year]
    );

    const rows = result.rows.map((row) => {
      const serviceCharges = num(row.service_charges);
      const expense = num(row.expense);

      return {
        month: Number(row.month),
        service_charges: serviceCharges,
        services_completed: Number(row.services_completed || 0),
        expense,
        net_profit: serviceCharges - expense,
      };
    });

    res.json(rows);

  } catch (err) {

    console.error("Trend analytics error:", err);

    res.status(500).json({
      error: "Failed to load trend analytics",
    });

  } finally {

    client.release();

  }
});

/* =========================================================
   CREATE TEAM
========================================================= */

router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    if (!isAdmin(req.user.role)) {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    const {
      name,
      description,
      is_global = false,
      centre_id = null,
      members = [],
    } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({
        error: "Team name is required",
      });
    }

    // ADMIN CANNOT CREATE GLOBAL TEAMS
    if (
      req.user.role === "admin" &&
      is_global
    ) {
      return res.status(403).json({
        error: "Admins cannot create global teams",
      });
    }

    let finalCentreId = centre_id;

    // ADMIN -> FORCE OWN CENTRE
    if (req.user.role === "admin") {
      finalCentreId = req.user.centre_id;
    }

    // GLOBAL TEAM
    if (is_global) {
      finalCentreId = null;
    }

    await client.query("BEGIN");

    const teamResult = await client.query(
      `
      INSERT INTO teams (
        centre_id,
        name,
        description,
        is_global,
        status,
        created_by,
        created_by_role
      )
      VALUES ($1, $2, $3, $4, 'active', $5, $6)
      RETURNING *
      `,
      [
        finalCentreId,
        name.trim(),
        description || null,
        is_global,
        req.user.id,
        req.user.role,
      ]
    );

    const team = teamResult.rows[0];

    // ADD MEMBERS
    for (const member of members) {

      // verify staff exists
      const staffCheck = await client.query(
        `
        SELECT id, centre_id
        FROM staff
        WHERE id = $1
        `,
        [member.staff_id]
      );

      if (staffCheck.rows.length === 0) {
        continue;
      }

      const staff = staffCheck.rows[0];

      // ADMIN CAN ONLY ADD OWN CENTRE STAFF
      if (
        req.user.role === "admin" &&
        staff.centre_id !== req.user.centre_id
      ) {
        continue;
      }

      // enforce only one primary team
      if (member.is_primary) {
        await client.query(
          `
          UPDATE team_members
          SET is_primary = false
          WHERE staff_id = $1
          `,
          [member.staff_id]
        );
      }

      await client.query(
        `
        INSERT INTO team_members (
          team_id,
          staff_id,
          is_primary,
          is_active
        )
        VALUES ($1, $2, $3, true)
        `,
        [
          team.id,
          member.staff_id,
          member.is_primary || false,
        ]
      );
    }

    // AUDIT LOG
    await client.query(
      `
      INSERT INTO audit_logs (
        action,
        performed_by,
        details,
        centre_id,
        created_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      `,
      [
        "Team Created",
        req.user.username,
        `Created team ${team.name}`,
        finalCentreId,
      ]
    );

    await client.query("COMMIT");

    res.status(201).json(team);

  } catch (err) {

    await client.query("ROLLBACK");

    console.error("Create team error:", err);

    res.status(500).json({
      error: "Failed to create team",
    });

  } finally {
    client.release();
  }
});

/* =========================================================
   GET TEAM MEMBERS
========================================================= */

router.get("/:id/members", async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const result = await client.query(
      `
      SELECT
        tm.*,

        s.name,
        s.role,
        s.photo,
        s.centre_id,

        c.name AS centre_name

      FROM team_members tm
      JOIN staff s ON s.id = tm.staff_id
      LEFT JOIN centres c ON c.id = s.centre_id

      WHERE tm.team_id = $1

      ORDER BY tm.is_primary DESC, s.name ASC
      `,
      [id]
    );

    res.json(result.rows);

  } catch (err) {

    console.error("Get team members error:", err);

    res.status(500).json({
      error: "Failed to fetch members",
    });

  } finally {
    client.release();
  }
});

/* =========================================================
   ADD MEMBER
========================================================= */

router.post("/:id/members", async (req, res) => {
  const client = await pool.connect();

  try {
    if (!isAdmin(req.user.role)) {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    const { id } = req.params;

    const {
      staff_id,
      is_primary = false,
    } = req.body;

    // TEAM CHECK
    const teamResult = await client.query(
      `
      SELECT *
      FROM teams
      WHERE id = $1
      `,
      [id]
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({
        error: "Team not found",
      });
    }

    const team = teamResult.rows[0];

    // ADMIN RESTRICTION
    if (
      req.user.role === "admin" &&
      (
        team.is_global ||
        team.centre_id !== req.user.centre_id
      )
    ) {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    // STAFF CHECK
    const staffResult = await client.query(
      `
      SELECT *
      FROM staff
      WHERE id = $1
      `,
      [staff_id]
    );

    if (staffResult.rows.length === 0) {
      return res.status(404).json({
        error: "Staff not found",
      });
    }

    const staff = staffResult.rows[0];

    // ADMIN CANNOT ADD OTHER CENTRE STAFF
    if (
      req.user.role === "admin" &&
      staff.centre_id !== req.user.centre_id
    ) {
      return res.status(403).json({
        error: "Cannot add external centre staff",
      });
    }

    await client.query("BEGIN");

    // remove previous primary
    if (is_primary) {
      await client.query(
        `
        UPDATE team_members
        SET is_primary = false
        WHERE staff_id = $1
        `,
        [staff_id]
      );
    }

    const result = await client.query(
      `
      INSERT INTO team_members (
        team_id,
        staff_id,
        is_primary,
        is_active
      )
      VALUES ($1, $2, $3, true)
      RETURNING *
      `,
      [
        id,
        staff_id,
        is_primary,
      ]
    );

    await client.query("COMMIT");

    res.status(201).json(result.rows[0]);

  } catch (err) {

    await client.query("ROLLBACK");

    console.error("Add member error:", err);

    res.status(500).json({
      error: "Failed to add member",
    });

  } finally {
    client.release();
  }
});

/* =========================================================
   REMOVE MEMBER
========================================================= */

router.delete("/:id/members/:staffId", async (req, res) => {
  const client = await pool.connect();

  try {
    if (!isAdmin(req.user.role)) {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    const { id, staffId } = req.params;

    await client.query(
      `
      DELETE FROM team_members
      WHERE team_id = $1
      AND staff_id = $2
      `,
      [id, staffId]
    );

    res.json({
      success: true,
    });

  } catch (err) {

    console.error("Remove member error:", err);

    res.status(500).json({
      error: "Failed to remove member",
    });

  } finally {
    client.release();
  }
});

/* =========================================================
   UPDATE PRIMARY TEAM
========================================================= */

router.put("/member/:memberId/primary", async (req, res) => {
  const client = await pool.connect();

  try {
    if (!isAdmin(req.user.role)) {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    const { memberId } = req.params;

    await client.query("BEGIN");

    const memberResult = await client.query(
      `
      SELECT *
      FROM team_members
      WHERE id = $1
      `,
      [memberId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({
        error: "Member not found",
      });
    }

    const member = memberResult.rows[0];

    // remove old primary
    await client.query(
      `
      UPDATE team_members
      SET is_primary = false
      WHERE staff_id = $1
      `,
      [member.staff_id]
    );

    // set new primary
    await client.query(
      `
      UPDATE team_members
      SET is_primary = true
      WHERE id = $1
      `,
      [memberId]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
    });

  } catch (err) {

    await client.query("ROLLBACK");

    console.error("Primary update error:", err);

    res.status(500).json({
      error: "Failed to update primary team",
    });

  } finally {
    client.release();
  }
});

/* =========================================================
   DELETE TEAM
========================================================= */

router.delete("/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    if (!isAdmin(req.user.role)) {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    const { id } = req.params;

    const teamResult = await client.query(
      `
      SELECT *
      FROM teams
      WHERE id = $1
      `,
      [id]
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({
        error: "Team not found",
      });
    }

    const team = teamResult.rows[0];

    // ADMIN RESTRICTION
    if (
      req.user.role === "admin" &&
      (
        team.is_global ||
        team.centre_id !== req.user.centre_id
      )
    ) {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    await client.query("BEGIN");

    await client.query(
      `
      DELETE FROM team_members
      WHERE team_id = $1
      `,
      [id]
    );

    await client.query(
      `
      UPDATE expenses
      SET team_id = NULL
      WHERE team_id = $1
      `,
      [id]
    );

    await client.query(
      `
      DELETE FROM teams
      WHERE id = $1
      `,
      [id]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
    });

  } catch (err) {

    await client.query("ROLLBACK");

    console.error("Delete team error:", err);

    res.status(500).json({
      error: "Failed to delete team",
    });

  } finally {
    client.release();
  }
});

/* =========================================================
   TEAM SETTINGS

   targets_enabled  whether the team is measured against targets
   target_mode      'staff' = sum of members' targets (default)
                    'manual' = monthly_target typed in for the team
========================================================= */

// GET Team Settings
router.get("/:id/settings", async (req, res) => {
  const client = await pool.connect();
  try {
    const access = await checkTeamAccess(client, req.user, req.params.id);

    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    let row = null;

    try {
      const result = await client.query(
        `SELECT targets_enabled, target_mode, monthly_target
         FROM team_targets WHERE team_id = $1`,
        [req.params.id]
      );
      row = result.rows[0] || null;
    } catch (err) {
      // target_mode column not added yet: fall back to the old shape
      console.warn("team_targets.target_mode missing? Run the migration. ", err.message);
      const result = await client.query(
        `SELECT targets_enabled, monthly_target FROM team_targets WHERE team_id = $1`,
        [req.params.id]
      );
      row = result.rows[0] || null;
    }

    res.json({
      targets_enabled: row ? !!row.targets_enabled : false,
      target_mode: row && row.target_mode === "manual" ? "manual" : "staff",
      monthly_target: row ? num(row.monthly_target) : 0,
    });
  } catch (error) {
    console.error("Error fetching team settings:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  } finally {
    client.release();
  }
});

// UPDATE Team Settings
router.post("/:id/settings", async (req, res) => {
  const client = await pool.connect();
  try {
    if (!isAdmin(req.user.role)) return res.status(403).json({ error: "Access denied" });

    const access = await checkTeamAccess(client, req.user, req.params.id);

    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const { id } = req.params;
    const targetsEnabled = !!req.body.targets_enabled;
    const mode = req.body.target_mode === "manual" ? "manual" : "staff";
    const monthly = Number(req.body.monthly_target);

    if (mode === "manual" && !(Number.isFinite(monthly) && monthly > 0)) {
      return res.status(400).json({
        error: "Enter a monthly target above 0, or switch to the sum of staff targets",
      });
    }

    // In 'staff' mode a previously typed amount is kept on the row, untouched,
    // so switching back and forth does not lose it.
    await client.query(
      `INSERT INTO team_targets (team_id, targets_enabled, monthly_target, target_mode, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (team_id)
       DO UPDATE SET
         targets_enabled = $2,
         target_mode = $4,
         monthly_target = CASE WHEN $4 = 'manual' THEN $3 ELSE team_targets.monthly_target END,
         updated_at = NOW()`,
      [id, targetsEnabled, mode === "manual" ? monthly : 0, mode]
    );

    res.json({ success: true, message: "Settings saved successfully" });
  } catch (error) {
    console.error("Error saving team settings:", error);
    res.status(500).json({
      error:
        error.code === "42703"
          ? "Run the team_targets.target_mode migration first"
          : "Failed to save settings",
    });
  } finally {
    client.release();
  }
});

/* =========================================================
   SERVICE MIX (for the doughnut): service charges by service
   Optional ?from=YYYY-MM-DD&to=YYYY-MM-DD
========================================================= */

router.get("/:id/service-mix", async (req, res) => {
  const client = await pool.connect();
  try {
    const access = await checkTeamAccess(client, req.user, req.params.id);

    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const params = [req.params.id];
    let dates = "";

    const from = cleanDate(req.query.from);
    const to = cleanDate(req.query.to);

    if (from) {
      params.push(from);
      dates += ` AND se.created_at >= $${params.length}::date`;
    }

    if (to) {
      params.push(to);
      dates += ` AND se.created_at < ($${params.length}::date + INTERVAL '1 day')`;
    }

    // Every service with charges in the period; the chart groups the small ones itself
    const result = await client.query(
      `SELECT s2.name AS service_type,
              SUM(se.service_charges) AS total,
              COUNT(*)::int AS count
       FROM service_entries se
       JOIN services s2 ON se.category_id = s2.id
       WHERE se.team_id = $1 AND se.status = 'completed'
       ${dates}
       GROUP BY s2.name
       HAVING SUM(se.service_charges) > 0
       ORDER BY total DESC`,
      params
    );

    res.json(
      result.rows.map((r) => ({
        service_type: r.service_type,
        total: num(r.total),
        count: r.count,
      }))
    );
  } catch (error) {
    console.error("Error fetching service mix:", error);
    res.status(500).json({ error: "Failed to load service mix" });
  } finally {
    client.release();
  }
});

export default router;