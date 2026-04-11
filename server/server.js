import express from "express";
import dotenv from "dotenv";
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
import superAdminAnalytics from "./routes/reports/superAdminAnalytics.js";

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

import staffperformanceRoutes from "./routes/staffPerformance.js";

dotenv.config();

const { Pool } = pkg;

/* ================================
   EXPRESS + HTTP SERVER
================================ */

const app = express();
const httpServer = createServer(app);

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

    socket.user = {
      id: decoded.id,
      centre_id: decoded.centre_id,
      role: decoded.role,
    };

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

  const user = socket.user;

  /* ==========================
     SEND CURRENT ONLINE USERS
  ========================== */

  const onlineUsers = Array.from(io.sockets.sockets.values()).map(
    (s) => s.user?.id
  );

  socket.emit("online_users", onlineUsers);

  /* ==========================
     JOIN USER ROOMS
  ========================== */

  socket.join(`staff:${user.id}`);

  if (user.centre_id) {
    socket.join(`centre:${user.centre_id}`);
  }

  console.log(
    `👤 Staff ${user.id} joined rooms: staff:${user.id}, centre:${user.centre_id}`
  );

  /* ==========================
     BROADCAST USER ONLINE
  ========================== */

  socket.to(`centre:${user.centre_id}`).emit("user_online", {
    userId: user.id
  });

  socket.join(`staff:${user.id}`);

  if (user.centre_id) {
    socket.join(`centre:${user.centre_id}`);
  }

  console.log(
    `👤 Staff ${user.id} joined rooms: staff:${user.id}, centre:${user.centre_id}`
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

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ================================
   POSTGRESQL
================================ */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.PG_URI,
  ssl: process.env.DATABASE_URL
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
app.use("/api/analytics", superAdminAnalytics);

app.use("/api/customer/documents", customerDocumentsRoutes);
app.use("/api/customer/bookings", customerBookingRoutes);
app.use("/api/customer", customerRoute);
app.use("/api/staffcustomerdocuments", staffCustomerDocumentsRoutes);

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
