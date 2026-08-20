import cron from "node-cron";
import { db } from "../config/firebase.js";
import cloudinary from "../config/cloudinary.js";

const getResourceType = (folder = "", publicId = "") => {
  const normFolder = String(folder).toLowerCase();
  const normId = String(publicId).toLowerCase();

  if (normFolder.includes("audio") || normFolder.includes("video")) return "video";
  if (normFolder.includes("pdf") || normId.endsWith(".pdf")) return "image";
  if (normFolder.includes("doc") || normFolder.includes("raw")) return "raw";
  return "image";
};

export const runPurgeTrashTask = async () => {
  console.log("[CRON TRASH] Checking for expired trashed items...");
  try {
    const settingsDoc = await db.collection("settings").doc("system").get();

    if (!settingsDoc.exists) {
      console.log("[CRON TRASH] System settings document not found. Skipping purge.");
      return { success: false, reason: "Settings not found" };
    }

    const systemData = settingsDoc.data();
    const trashSettings = systemData.trash || {};
    const { enabled = true, autoDelete = true, deleteAfterDays = 7 } = trashSettings;

    if (!enabled || !autoDelete) {
      console.log("[CRON TRASH] Automated trash cleanup is disabled in settings.");
      return { success: false, reason: "Trash cleanup disabled" };
    }

    const cutoffMs = Date.now() - Number(deleteAfterDays) * 24 * 60 * 60 * 1000;
    const collectionsToClean = ["media", "lessons", "notices", "subjects"];
    let totalPurged = 0;

    for (const collectionName of collectionsToClean) {
      const snapshot = await db
        .collection(collectionName)
        .where("status", "==", "trashed")
        .get();

      if (snapshot.empty) continue;

      const batch = db.batch();

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (!data.deletedAt) continue;

        const deletedMs = typeof data.deletedAt.toMillis === "function"
          ? data.deletedAt.toMillis()
          : typeof data.deletedAt.toDate === "function"
          ? data.deletedAt.toDate().getTime()
          : new Date(data.deletedAt).getTime();

        if (isNaN(deletedMs) || deletedMs > cutoffMs) {
          continue;
        }

        const assets = [];
        if (data.publicId) {
          assets.push({ publicId: data.publicId, folder: data.folder });
        }
        if (data.audio?.publicId && data.audio.publicId !== data.publicId) {
          assets.push({ publicId: data.audio.publicId, folder: data.audio.folder || "lessons/audio" });
        }
        if (data.pdf?.publicId && data.pdf.publicId !== data.publicId) {
          assets.push({ publicId: data.pdf.publicId, folder: data.pdf.folder || "notices/pdf" });
        }

        for (const asset of assets) {
          try {
            const resourceType = getResourceType(asset.folder, asset.publicId);
            await cloudinary.uploader.destroy(asset.publicId, { resource_type: resourceType });
            console.log(`[CRON TRASH] Destroyed Cloudinary Asset: ${asset.publicId}`);
          } catch (cloudErr) {
            console.error(`[CRON TRASH] Failed to delete Cloudinary file ${asset.publicId}:`, cloudErr.message);
          }
        }

        batch.delete(docSnap.ref);
        totalPurged++;
      }

      await batch.commit();
      console.log(`[CRON TRASH] Purged expired items from '${collectionName}'`);
    }

    if (totalPurged > 0) {
      await db.collection("auditLogs").add({
        action: "AUTOMATED_PURGE",
        module: "TRASH",
        targetName: "SYSTEM_CRON",
        details: `Automated cleanup permanently deleted ${totalPurged} expired items.`,
        userName: "System Auto-Clean",
        userEmail: "system@internal",
        createdAt: new Date(),
      });
    }

    return { success: true, totalPurged };
  } catch (error) {
    console.error("[CRON TRASH] Trash purge task failed:", error.message);
    throw error;
  }
};

export const initPurgeTrashJob = () => {
  cron.schedule("0 0 * * *", () => runPurgeTrashTask());
};
