import express from "express";
import dotenv from "dotenv";

dotenv.config();

import path from "path";
import cors from "cors";
import jwt from "jsonwebtoken";
import { createServer } from "http";
import { Server } from "socket.io";
import pool from "./db.js";
import { tenantMiddleware } from "./tenancy/middleware.js";
import { runWithTenant } from "./tenancy/context.js";
import { DEFAULT_ORG_SLUG, getOrgBySlug, getDefaultOrg, isMultiTenant, getControlPool } from "./tenancy/registry.js";
import { applyControlSchema } from "./tenancy/provision.js";
import { startBillingJobs } from "./tenancy/billing.js";
import { planMiddleware } from "./tenancy/limits.js";
import platformRoutes from "./routes/platform.js";
import { attachSocketServer, roomFor, orgRoom, io } from "./tenancy/io.js";
import orgRoutes from "./routes/org.js";
import orgSettingsRoutes from "./routes/orgSettings.js";
import portalRoutes from "./routes/portal.js";

/* ================================
   ROUTES
================================ */
import authRoute from "./routes/auth.js";
import centreRoutes from "./routes/centres.js";
import staffRoute from "./routes/staff.js";
import walletRoute from "./routes/wallet.js";
import serviceManagementRoutes from "./routes/servicemanagement.js";
import serviceTrackingRoute from "./routes/servicetracking.js";
import salaryRoute from "./routes/salary.js";
import schedulerroute from "./routes/scheduler.js";
import expenseRoute from "./routes/expense.js";

import walletreportsRoute from "./routes/reports/walletReports.js";
import staffreportsRoute from "./routes/reports/staffReports.js";
import accountingRoute from "./routes/reports/accounting.js";
import transactionRoute from "./routes/reports/transactionReports.js";
import adminAnalyticsRoutes from './routes/reports/adminAnalytics.js';
import superAdminAnalyticsRoutes from './routes/reports/superAdminAnalytics.js';
import reportsRoute from './routes/reports/reports.js';
import reportSchedulesRoute from './routes/reports/reportSchedules.js';
import bankStatementsRouter from './routes/bankStatements.js';

import customerRoute from "./routes/customer.js";
import customerDocumentsRoutes from "./routes/customerDocuments.js";
import customerBookingRoutes from "./routes/customerBooking.js";
import staffCustomerDocumentsRoutes from "./routes/staffCustomerDocuments.js";

import reviewRoutes from "./routes/reviews.js";

import taskRoutes from "./routes/collaboration/tasks.js";
import filesRoutes from "./routes/collaboration/files.js";
import calendarRoutes from "./routes/collaboration/calendar.js";
import activityRoutes from "./routes/collaboration/activity.js";
import chatRoutes from "./routes/collaboration/chat.js";
import serviceCollaborationRoutes from "./routes/collaboration/serviceCollaboration.js";
import webhookRoutes from "./routes/webhook.js";
import libromiWebhookRoutes from "./routes/libromiWebhook.js";
import whatsappRoutes from "./routes/whatsapp.js";

import teamRoutes from "./routes/teams.js";

import staffperformanceRoutes from "./routes/staffPerformance.js";

import eventsRoutes from "./routes/events.js";

import notesRoutes from "./routes/notes.js";

import printingRoutes from "./routes/printing.js"
import printAgentRoutes from "./routes/printAgent.js";

//communication routes
import communicationRoutes from "./routes/communication.js";

//notification routes
import notificationRoutes from "./routes/notifications.js";

//Operation Hub
import knowledgeRoutes from "./routes/knowledge.js";

//Companion Device Routes
import companionRoutes from "./routes/companion.js";

//Public Tracking - documents view
import serviceTrackingDocumentsRoutes from "./routes/serviceTrackingDocuments.js";

//Contact Route
import contactRoutes from "./routes/contact.js";

//Task Automations
import automationRoutes from "./routes/automations.js";

//Leads Routes
import leadsRoutes from "./routes/leads.js";

import "./routes/scheduler.js";

/* ================================
   EXPRESS + HTTP SERVER
================================ */

const app = express();

// The app runs behind nginx on the same server. Trust only that local proxy's
// X-Forwarded-For, so req.ip is the visitor's real address (used for sign-in
// history, the activity log and per-IP login limits) and can't be faked by
// someone sending their own X-Forwarded-For header.
app.set("trust proxy", "loopback");
const httpServer = createServer(app);

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:5173"
  ],
  credentials: true
}));

/* ================================
   SOCKET.IO SETUP
================================ */

const socketServer = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

/* ================================
   SOCKET AUTH MIDDLEWARE
================================ */

socketServer.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Socket authentication failed"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Each socket belongs to the organization its token was issued by.
    const org = await getOrgBySlug(decoded.org || DEFAULT_ORG_SLUG);
    if (!org || org.status !== "active") {
      return next(new Error("Organization not available"));
    }
    socket.org = org;

    // Fork: Is this a Companion Device or a Web User?
    if (decoded.type === "device") {
      socket.device = {
        id: decoded.device_id,
        centre_id: decoded.centre_id,
        type: "device"
      };
    } else {
      socket.user = {
        id: decoded.id,
        centre_id: decoded.centre_id,
        role: decoded.role,
      };
    }

    next();
  } catch (err) {
    next(new Error("Invalid socket token"));
  }
});

/* ================================
   SOCKET CONNECTION
================================ */

socketServer.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  // Rooms are kept per organization: "<slug>|user:5" etc.
  const org = socket.org;
  const room = (name) => roomFor(org, name);
  socket.join(orgRoom(org));

 /* ==========================
     COMPANION DEVICE LOGIC
  ========================== */
  if (socket.device) {
    console.log(`📱 Device Connected: ${socket.device.id}`);
    
    socket.join(room(`centre:${socket.device.centre_id}`));
    socket.join(room(`device:${socket.device.id}`));

    // ---> NEW: Listen for incoming SMS and route to Messenger <---
    socket.on("incoming_sms", (smsData) => runWithTenant(org, async () => {
      console.log(`\n📩 SMS Forwarded from Device [${socket.device.id}]:`);
      console.log(`Sender: ${smsData.sender}`);
      console.log(`Message: ${smsData.message}`);
      
      const centreId = socket.device.centre_id;

      try {
        // 1. Save to PostgreSQL permanently (Your existing log table)
        await pool.query(
          `INSERT INTO companion_sms_logs (centre_id, device_id, sender, message, is_otp) 
           VALUES ($1, $2, $3, $4, $5)`,
          [centreId, socket.device.id, smsData.sender, smsData.message, smsData.isOtp]
        );

        // ==========================================
        // 2. MESSENGER INTEGRATION (The Group Chat)
        // ==========================================
        
        // Check if the SMS Gateway conversation already exists for this centre
        let convRes = await pool.query(
          `SELECT id FROM chat_conversations WHERE context_type = 'sms_gateway' AND centre_id = $1 LIMIT 1`,
          [centreId]
        );

        let conversationId;

        if (convRes.rows.length > 0) {
          conversationId = convRes.rows[0].id;
        } else {
          // Create the dedicated Gateway Room
          const newConv = await pool.query(
            `INSERT INTO chat_conversations (name, is_group, channel, context_type, centre_id, status)
             VALUES ($1, true, 'internal', 'sms_gateway', $2, 'active') RETURNING id`,
            [`📱 SMS Gateway (OTPs)`, centreId]
          );
          conversationId = newConv.rows[0].id;
        }

        // Auto-Enroll ALL active staff in this centre so everyone sees the OTPs.
        // The 'ON CONFLICT DO NOTHING' ensures we don't duplicate existing members.
        await pool.query(
          `INSERT INTO chat_participants (conversation_id, staff_id, participant_type, role, joined_at)
           SELECT $1, id, 'staff', 'member', NOW() FROM staff WHERE centre_id = $2 AND status = 'Active'
           ON CONFLICT DO NOTHING`,
          [conversationId, centreId]
        );

        // Format the message so it looks great in the UI
        const formattedMessage = smsData.isOtp 
            ? `🚨 OTP RECEIVED 🚨\n\nFrom: ${smsData.sender}\nMessage: ${smsData.message}`
            : `📩 New Text Message\n\nFrom: ${smsData.sender}\nMessage: ${smsData.message}`;

        // Insert the actual chat message. (sender_id is NULL because it's hardware, not a human)
        const msgRes = await pool.query(
          `INSERT INTO chat_messages (conversation_id, sender_id, sender_type, message_type, message, created_at)
           VALUES ($1, NULL, 'system', 'text', $2, NOW()) RETURNING *`,
          [conversationId, formattedMessage]
        );

        const savedMessage = msgRes.rows[0];

        // 3. FIRE WEBSOCKETS TO UPDATE THE REACT UI INSTANTLY
        
        // Emit the message to anyone currently looking at the SMS Gateway chat
        io.to(`conversation:${conversationId}`).emit("new_message", {
          ...savedMessage,
          sender_name: "SMS Gateway", 
          isCurrentUser: false,
          time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
        });

        // Bump the conversation to the top of the sidebar for everyone in the centre
        io.to(`centre:${centreId}`).emit("conversation_updated", {
          conversationId: conversationId,
          last_message: formattedMessage,
          last_message_at: savedMessage.created_at,
          unread_increment: 1 // Tells the frontend to increment the red badge
        });

        // Keep your original global toast broadcast if you still want the popup alert
        io.to(`centre:${centreId}`).emit("new_centre_sms", {
          device_id: socket.device.id,
          ...smsData
        });

        console.log(`✅ SMS successfully injected into Messenger (Conv ID: ${conversationId})`);

      } catch (error) {
        console.error("❌ Failed to process incoming SMS:", error);
      }
    }));

    socket.on("disconnect", () => {
      console.log(`🔴 Device Disconnected: ${socket.device.id}`);
    });

    return; 
  }

  /* ==========================
     HUMAN STAFF LOGIC (Existing)
  ========================== */
  const user = socket.user;
  
  // Failsafe if user is somehow undefined
  if (!user) return; 

  /* ==========================
     SEND CURRENT ONLINE USERS
  ========================== */
  // Filter out undefined (which would happen if a device is connected without a user object)
  const onlineUsers = Array.from(socketServer.sockets.sockets.values())
    .filter((s) => s.org?.slug === org.slug)
    .map((s) => s.user?.id)
    .filter(Boolean);

  socket.emit("online_users", onlineUsers);

  /* ==========================
     JOIN USER ROOMS
  ========================== */

  // 🔥 CHANGED 'staff:' to 'user:' so it matches your React frontend!
  socket.join(room(`user:${user.id}`));

  if (user.centre_id) {
    socket.join(room(`centre:${user.centre_id}`));
  }

  console.log(
    `👤 User ${user.id} joined rooms: user:${user.id}, centre:${user.centre_id}`
  );

  /* ==========================
     BROADCAST USER ONLINE
  ========================== */

  if (user.centre_id) {
    socket.to(room(`centre:${user.centre_id}`)).emit("user_online", {
      userId: user.id
    });
  }

  /* ==========================
     CHAT CONVERSATION ROOMS
  ========================== */

  socket.on("join", ({ staffId, centreId }) => {
    socket.join(room(`user:${staffId}`));
    socket.join(room(`centre:${centreId}`));
  });

  socket.on("join_conversation", (conversationId) => {
    socket.join(room(`conversation:${conversationId}`));

    console.log(
      `💬 User ${user.id} joined conversation:${conversationId}`
    );
  });

  socket.on("leave_conversation", (conversationId) => {
    socket.leave(room(`conversation:${conversationId}`));

    console.log(
      `👋 User ${user.id} left conversation:${conversationId}`
    );
  });

  /* ==========================
     TYPING INDICATOR
  ========================== */

  socket.on("typing", ({ conversationId, isTyping }) => {
    socket
      .to(room(`conversation:${conversationId}`))
      .emit("user_typing", {
        userId: user.id,
        conversationId,
        isTyping,
      });
  });

  /* ==========================
     DISCONNECT
  ========================== */
  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);

    if (user.centre_id) {
      socket.to(room(`centre:${user.centre_id}`)).emit("user_offline", {
        userId: user.id
      });
    }
  });
});

/* ================================
   MIDDLEWARE
================================ */

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ================================
   ORGANIZATIONS (multi-tenancy)
   Every request runs inside its organization; db.js and io then use
   that organization's database and socket rooms.
================================ */

attachSocketServer(socketServer);

// Public info about an organization (name, status) for the portal pages.
// Mounted before the tenant middleware: it reads the control database only.
app.use("/api/org", orgRoutes);

// Platform-admin page (you, the software owner): plans, organizations, billing.
// Uses only the control database and its own login, so it sits before the tenant middleware.
app.use("/api/platform", platformRoutes);

app.use(tenantMiddleware());

// Plan limits: customer portal on/off and storage, checked before the routes.
app.use(planMiddleware());

app.use((req, res, next) => {
  req.db = pool;
  next();
});

/* ================================
   SOCKET ACCESS IN ROUTES
================================ */

app.use((req, res, next) => {
  req.io = io;
  next();
});

/* ================================
   API ROUTES
================================ */

app.use("/api/auth", authRoute);
app.use("/api/org-settings", orgSettingsRoutes);
app.use("/api/portal", portalRoutes);
app.use("/api/staff", staffRoute);
app.use("/api/wallet", walletRoute);

app.use("/api/servicemanagement", serviceManagementRoutes);
app.use("/api/servicetracking", serviceTrackingRoute);
app.use("/api/salary", salaryRoute);

app.use("/api/centres", centreRoutes);
app.use("/api/expense", expenseRoute);

app.use("/api/walletreport", walletreportsRoute);
app.use("/api/staffreport", staffreportsRoute);
app.use("/api/accounting", accountingRoute);
app.use("/api/bankstatements", bankStatementsRouter);
app.use("/api/transaction", transactionRoute);
app.use('/api/analytics/admin', adminAnalyticsRoutes);
app.use('/api/analytics/superadmin', superAdminAnalyticsRoutes);
app.use('/api/reports/schedules', reportSchedulesRoute);
app.use("/api/reports", reportsRoute);
app.use("/api/customer/documents", customerDocumentsRoutes);
app.use("/api/customer/bookings", customerBookingRoutes);
app.use("/api/customer", customerRoute);
app.use("/api/staffcustomerdocuments", staffCustomerDocumentsRoutes);

app.use("/api/teams", teamRoutes);

app.use('/api/staffperformance', staffperformanceRoutes);

app.use("/api/reviews", reviewRoutes);

/* Collaboration */
app.use("/api/tasks", taskRoutes);
app.use("/api/files", filesRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/servicecollaboration", serviceCollaborationRoutes);
app.use("/api/webhook", webhookRoutes);
app.use("/api/libromi", libromiWebhookRoutes);
app.use("/api/whatsapp", whatsappRoutes);

/* Events */
app.use("/api/events", eventsRoutes);

/* Notes */
app.use("/api/notes", notesRoutes);

/* Printing */
app.use("/api/printing", printingRoutes);
app.use('/api/print-agent', printAgentRoutes);

/* Communication */
app.use("/api/communication", communicationRoutes);

/* Notification */
app.use("/api/notifications", notificationRoutes);

/* Knowledge Hub */
app.use("/api/knowledge", knowledgeRoutes);

/* Companion Devices */
app.use("/api/companion", companionRoutes);

/* Service Tracking Documents - for public access */
app.use("/api/servicetracking", serviceTrackingDocumentsRoutes);

/* Contact us - for public access */
app.use("/api/contact", contactRoutes);

/* Task Automations */
app.use("/api/automations", automationRoutes);

/* Leads Routes */
app.use("/api/leads", leadsRoutes);

/* ================================
   STATIC FILES
================================ */

app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"))
);

/* ================================
   ERROR HANDLING
================================ */

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

/* ================================
   START SERVER
================================ */

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  try {
    if (isMultiTenant()) {
      // Keep the control database's tables up to date (plans, billing, …).
      await applyControlSchema(getControlPool());
      startBillingJobs();
    }
    const org = await getDefaultOrg();
    await runWithTenant(org, () => pool.query("SELECT 1"));
    console.log(
      isMultiTenant()
        ? `✅ Multi-tenant mode: control DB ready, default organization "${org.slug}" connected`
        : "✅ Connected to PostgreSQL (single-organization mode)"
    );
  } catch (err) {
    console.error("❌ Database startup check failed:", err.message);
  }
});

app.get("/", (req, res) => {
  res.send("✅ Akshaya CRM Backend Running");
});

/* Export io */
export { io };