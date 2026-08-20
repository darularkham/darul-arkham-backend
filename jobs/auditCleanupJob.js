import cron from "node-cron";
import { db } from "../config/firebase.js";

export const runAuditCleanupTask = async () => {
  console.log("[CRON AUDIT] Checking for expired audit logs...");
  try {
    const settingsDoc = await db.collection("settings").doc("system").get();

    if (!settingsDoc.exists) {
      console.log("[CRON AUDIT] Settings document not found. Skipping auto-cleanup.");
      return { success: false, reason: "Settings document not found" };
    }

    const systemData = settingsDoc.data();
    const auditSettings = systemData.auditLogs || systemData.audit || {};
    const { enabled = true, autoCleanup = true, retainDays = 90 } = auditSettings;

    if (!enabled || !autoCleanup) {
      console.log("[CRON AUDIT] Automated audit log cleanup is disabled in settings.");
      return { success: false, reason: "Audit cleanup disabled" };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - Number(retainDays));

    const expiredQuery = await db
      .collection("auditLogs")
      .where("createdAt", "<=", cutoffDate)
      .limit(400)
      .get();

    if (expiredQuery.empty) {
      console.log("[CRON AUDIT] No expired audit logs to clean up.");
      return { success: true, totalPurged: 0 };
    }

    const batch = db.batch();
    expiredQuery.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    console.log(`[CRON AUDIT] Successfully purged ${expiredQuery.size} expired audit logs.`);
    return { success: true, totalPurged: expiredQuery.size };
  } catch (error) {
    console.error("[CRON AUDIT] Audit log cleanup task failed:", error.message);
    throw error;
  }
};

export const initAuditCleanupJob = () => {
  cron.schedule("0 0 * * *", () => runAuditCleanupTask());
};
