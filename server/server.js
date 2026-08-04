import express from "express";
import dotenv from "dotenv";

dotenv.config();

import path from "path";
import cors from "cors";
import jwt from "jsonwebtoken";
import { createServer } from "http";
import { Server } from "socket.io";
import pkg from "pg";

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

//communication routes
import communicationRoutes from "./routes/communication.js";

//notification routes
import notificationRoutes from "./routes/notifications.js";

//Operation Hub
import knowledgeRoutes from "./routes/knowledge.js";

//Companion Device Routes
import companionRoutes from "./routes/companion.js";

import "./routes/scheduler.js";

const { Pool } = pkg;

/* ================================
   EXPRESS + HTTP SERVER
================================ */

const app = express();
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

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

/* ================================
   SOCKET AUTH MIDDLEWARE
================================ */

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Socket authentication failed"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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

io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

 /* ==========================
     COMPANION DEVICE LOGIC
  ========================== */
  if (socket.device) {
    console.log(`📱 Device Connected: ${socket.device.id}`);
    
    socket.join(`centre:${socket.device.centre_id}`);
    socket.join(`device:${socket.device.id}`);

    // ---> NEW: Listen for incoming SMS and route to Messenger <---
    socket.on("incoming_sms", async (smsData) => {
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
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
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
    });

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
  const onlineUsers = Array.from(io.sockets.sockets.values())
    .map((s) => s.user?.id)
    .filter(Boolean);

  socket.emit("online_users", onlineUsers);

  /* ==========================
     JOIN USER ROOMS
  ========================== */

  // 🔥 CHANGED 'staff:' to 'user:' so it matches your React frontend!
  socket.join(`user:${user.id}`);

  if (user.centre_id) {
    socket.join(`centre:${user.centre_id}`);
  }

  console.log(
    `👤 User ${user.id} joined rooms: user:${user.id}, centre:${user.centre_id}`
  );

  /* ==========================
     BROADCAST USER ONLINE
  ========================== */

  if (user.centre_id) {
    socket.to(`centre:${user.centre_id}`).emit("user_online", {
      userId: user.id
    });
  }

  /* ==========================
     CHAT CONVERSATION ROOMS
  ========================== */

  socket.on("join", ({ staffId, centreId }) => {
    socket.join(`user:${staffId}`);
    socket.join(`centre:${centreId}`);
  });

  socket.on("join_conversation", (conversationId) => {
    socket.join(`conversation:${conversationId}`);

    console.log(
      `💬 User ${user.id} joined conversation:${conversationId}`
    );
  });

  socket.on("leave_conversation", (conversationId) => {
    socket.leave(`conversation:${conversationId}`);

    console.log(
      `👋 User ${user.id} left conversation:${conversationId}`
    );
  });

  /* ==========================
     TYPING INDICATOR
  ========================== */

  socket.on("typing", ({ conversationId, isTyping }) => {
    socket
      .to(`conversation:${conversationId}`)
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
      socket.to(`centre:${user.centre_id}`).emit("user_offline", {
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
   POSTGRESQL
================================ */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.PG_URI,
  // Only force SSL if we are in production mode
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

pool
  .connect()
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch((err) => console.error("❌ PG Connect Error:", err));

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

/* Communication */
app.use("/api/communication", communicationRoutes);

/* Notification */
app.use("/api/notifications", notificationRoutes);

/* Knowledge Hub */
app.use("/api/knowledge", knowledgeRoutes);

/* Companion Devices */
app.use("/api/companion", companionRoutes);

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

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

app.get("/", (req, res) => {
  res.send("✅ Akshaya CRM Backend Running");
});

/* Export io */
export { io };