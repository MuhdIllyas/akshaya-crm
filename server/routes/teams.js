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
   TEAM FINANCIAL SUMMARY
========================================================= */

router.get("/analytics/summary", async (req, res) => {
  const client = await pool.connect();

  try {

    const {
      from,
      to,
      team_id,
    } = req.query;

    let teamWhere = "";
    let params = [];
    let paramIndex = 1;

    /* =====================================================
       TEAM FILTER
    ===================================================== */

    if (team_id) {

      teamWhere += `
        AND t.id = $${paramIndex}
      `;

      params.push(team_id);

      paramIndex++;
    }

    /* =====================================================
       ROLE FILTERS
    ===================================================== */

    if (req.user.role === "admin") {

      teamWhere += `
        AND (
          t.centre_id = $${paramIndex}
          AND t.is_global = false
        )
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

    /* =====================================================
       DATE FILTERS
    ===================================================== */

    let serviceDateFilter = "";
    let expenseDateFilter = "";

    if (from) {

      serviceDateFilter += `
        AND se.created_at >= $${paramIndex}::date
      `;

      expenseDateFilter += `
        AND e.created_at >= $${paramIndex}::date
      `;

      params.push(from);

      paramIndex++;
    }

    if (to) {

      serviceDateFilter += `
        AND se.created_at <
        ($${paramIndex}::date + INTERVAL '1 day')
      `;

      expenseDateFilter += `
        AND e.created_at <
        ($${paramIndex}::date + INTERVAL '1 day')
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

        /* =========================================
           REVENUE (TOTAL CUSTOMER COLLECTION)
        ========================================= */

        COALESCE((
          SELECT SUM(se.total_charges)

          FROM service_entries se

          WHERE se.team_id = t.id

          ${serviceDateFilter}

        ), 0) AS revenue,

        /* =========================================
           DEPARTMENT CHARGES
        ========================================= */

        COALESCE((
          SELECT SUM(se.department_charges)

          FROM service_entries se

          WHERE se.team_id = t.id

          ${serviceDateFilter}

        ), 0) AS department_charges,

        /* =========================================
           SERVICE REVENUE
        ========================================= */

        COALESCE((
          SELECT SUM(se.service_charges)

          FROM service_entries se

          WHERE se.team_id = t.id

          ${serviceDateFilter}

        ), 0) AS service_revenue,

        /* =========================================
           EXPENSE
        ========================================= */

        COALESCE((
          SELECT SUM(e.amount)

          FROM expenses e

          WHERE e.team_id = t.id

          ${expenseDateFilter}

        ), 0) AS expense

      FROM teams t

      WHERE 1=1

      ${teamWhere}

      ORDER BY revenue DESC
      `,
      params
    );

    const teams = result.rows.map((team) => {

      const revenue =
        Number(team.revenue || 0);

      const expense =
        Number(team.expense || 0);

      const departmentCharges =
        Number(team.department_charges || 0);

      const serviceRevenue =
        Number(team.service_revenue || 0);

      return {
        ...team,

        revenue,
        expense,
        department_charges: departmentCharges,
        service_revenue: serviceRevenue,

        profit:
          revenue
          - departmentCharges
          - expense,
      };
    });

    const totals = teams.reduce(
      (acc, row) => {

        acc.revenue += row.revenue;
        acc.expense += row.expense;
        acc.department_charges += row.department_charges;
        acc.service_revenue += row.service_revenue;
        acc.profit += row.profit;

        return acc;

      },
      {
        revenue: 0,
        expense: 0,
        department_charges: 0,
        service_revenue: 0,
        profit: 0,
      }
    );

    res.json({
      totals,
      teams,
    });

  } catch (err) {

    console.error(
      "Team analytics error:",
      err
    );

    res.status(500).json({
      error:
        "Failed to load team analytics",
    });

  } finally {

    client.release();

  }
});

/* =========================================================
   TEAM MEMBER CONTRIBUTION
========================================================= */

router.get(
  "/:teamId/contribution",
  async (req, res) => {

    const client = await pool.connect();

    try {

      const { teamId } = req.params;

      const result = await client.query(
        `
        SELECT

          s.id,
          s.name,
          s.role,

          tm.is_primary,

          /* =====================================
             REVENUE
          ===================================== */

          COALESCE((
            SELECT SUM(se.total_charges)

            FROM service_entries se

            WHERE se.staff_id = s.id
            AND se.team_id = $1
          ), 0) AS revenue,

          /* =====================================
             DEPARTMENT CHARGES
          ===================================== */

          COALESCE((
            SELECT SUM(se.department_charges)

            FROM service_entries se

            WHERE se.staff_id = s.id
            AND se.team_id = $1
          ), 0) AS department_charges,

          /* =====================================
             SERVICE REVENUE
          ===================================== */

          COALESCE((
            SELECT SUM(se.service_charges)

            FROM service_entries se

            WHERE se.staff_id = s.id
            AND se.team_id = $1
          ), 0) AS service_revenue,

          /* =====================================
             EXPENSE
          ===================================== */

        COALESCE((
            SELECT SUM(e.amount)

            FROM expenses e

            WHERE e.staff_id = s.id
            AND e.team_id = $1
        ), 0) AS expense

        FROM team_members tm

        JOIN staff s
          ON s.id = tm.staff_id

        WHERE tm.team_id = $1

        ORDER BY revenue DESC
        `,
        [teamId]
      );

      const rows = result.rows.map((member) => {

        const revenue =
          Number(member.revenue || 0);

        const expense =
          Number(member.expense || 0);

        const departmentCharges =
          Number(member.department_charges || 0);

        const serviceRevenue =
          Number(member.service_revenue || 0);

        return {
          ...member,

          revenue,
          expense,
          department_charges: departmentCharges,
          service_revenue: serviceRevenue,

          profit:
            revenue
            - departmentCharges
            - expense,
        };
      });

      res.json(rows);

    } catch (err) {

      console.error(
        "Contribution error:",
        err
      );

      res.status(500).json({
        error:
          "Failed to load contribution",
      });

    } finally {

      client.release();

    }
  }
);

/* =========================================================
   TEAM MONTHLY TREND
========================================================= */

router.get(
  "/:teamId/trend",
  async (req, res) => {

    const client = await pool.connect();

    try {

      const { teamId } = req.params;

      const year =
        Number(req.query.year) ||
        new Date().getFullYear();

      const result = await client.query(
        `
        WITH months AS (
          SELECT generate_series(1, 12) AS month
        )

        SELECT

          m.month,

          /* =====================================
             REVENUE
          ===================================== */

          COALESCE((
            SELECT SUM(se.total_charges)

            FROM service_entries se

            WHERE se.team_id = $1

            AND EXTRACT(MONTH FROM se.created_at) = m.month
            AND EXTRACT(YEAR FROM se.created_at) = $2
          ), 0) AS revenue,

          /* =====================================
             DEPARTMENT CHARGES
          ===================================== */

          COALESCE((
            SELECT SUM(se.department_charges)

            FROM service_entries se

            WHERE se.team_id = $1

            AND EXTRACT(MONTH FROM se.created_at) = m.month
            AND EXTRACT(YEAR FROM se.created_at) = $2
          ), 0) AS department_charges,

          /* =====================================
             SERVICE REVENUE
          ===================================== */

          COALESCE((
            SELECT SUM(se.service_charges)

            FROM service_entries se

            WHERE se.team_id = $1

            AND EXTRACT(MONTH FROM se.created_at) = m.month
            AND EXTRACT(YEAR FROM se.created_at) = $2
          ), 0) AS service_revenue,

          /* =====================================
             EXPENSE
          ===================================== */

          COALESCE((
            SELECT SUM(e.amount)

            FROM expenses e

            WHERE e.team_id = $1

            AND EXTRACT(MONTH FROM e.created_at) = m.month
            AND EXTRACT(YEAR FROM e.created_at) = $2
          ), 0) AS expense

        FROM months m

        ORDER BY m.month
        `,
        [teamId, year]
      );

      const rows = result.rows.map((row) => {

        const revenue =
          Number(row.revenue || 0);

        const expense =
          Number(row.expense || 0);

        const departmentCharges =
          Number(row.department_charges || 0);

        const serviceRevenue =
          Number(row.service_revenue || 0);

        return {
          month: Number(row.month),

          revenue,
          expense,
          department_charges: departmentCharges,
          service_revenue: serviceRevenue,

          profit:
            revenue
            - departmentCharges
            - expense,
        };
      });

      res.json(rows);

    } catch (err) {

      console.error(
        "Trend analytics error:",
        err
      );

      res.status(500).json({
        error:
          "Failed to load trend analytics",
      });

    } finally {

      client.release();

    }
  }
);

export default router;