import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import cloudinaryRoutes from "./routes/cloudinaryRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { initPurgeTrashJob, runPurgeTrashTask } from "./jobs/purgeTrashJob.js";
import { initAuditCleanupJob, runAuditCleanupTask } from "./jobs/auditCleanupJob.js";
import { verifyCronSecret } from "./middleware/authMiddleware.js";

dotenv.config();

const app = express();

app.set("trust proxy", 1);

// Standardize allowed origins by stripping trailing slashes
const rawOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5174", "http://localhost:5173", "http://localhost:3000"];

const allowedOrigins = rawOrigins.map((o) => o.trim().replace(/\/+$/, ""));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/+$/, "");
      if (allowedOrigins.includes(cleanOrigin) || process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      return callback(new Error(`CORS Policy Violation: Origin ${origin} not allowed.`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-cron-secret"],
    credentials: true,
  })
);

app.use(express.json());

// API Endpoints
app.use("/api/cloudinary", cloudinaryRoutes);
app.use("/api/admins", adminRoutes);

// Protected Cron Endpoints
app.post("/api/admin/run-purge", verifyCronSecret, async (req, res) => {
  try {
    const result = await runPurgeTrashTask();
    res.json({ success: true, message: "Manual purge completed.", ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/admin/run-audit-purge", verifyCronSecret, async (req, res) => {
  try {
    const result = await runAuditCleanupTask();
    res.json({ success: true, message: "Manual audit log purge completed.", ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Root Route
app.get("/", (req, res) => {
  res.status(200).json({
    status: "online",
    message: "Darul Arkham Admin API is running.",
    timestamp: new Date().toISOString(),
  });
});

// 404 Route Handler
app.use("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found.`,
  });
});

// Initialize Scheduled Jobs
initPurgeTrashJob();
initAuditCleanupJob();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);
});
  
