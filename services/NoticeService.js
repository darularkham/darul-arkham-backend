import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../config/firebaseConfig";
import cloudinaryService from "./cloudinaryService";
import mediaService from "./mediaService";
import { CLOUDINARY_FOLDERS } from "../config/cloudinary";

class NoticeService {
  async getNotices() {
    try {
      const q = query(collection(db, "notices"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(item => ({ id: item.id, ...item.data() }))
        .filter(n => n.status !== "trashed");
    } catch (error) {
      return [];
    }
  }

  async createNotice(data, userId = "admin") {
    let createdDocRef = null;

    try {
      // 1. Save Notice to Firestore
      createdDocRef = await addDoc(collection(db, "notices"), {
        title: data.title,
        content: data.content,
        pdf: data.pdf || null, // Expects { url, publicId, format, bytes, name }
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
        createdBy: userId
      });

      // 2. Automatic Media Sync: Register PDF in Media collection
      if (data.pdf?.publicId) {
        const mediaResult = await mediaService.createMedia({
          name: data.pdf.name || `${data.title} (Notice PDF)`,
          url: data.pdf.url,
          publicId: data.pdf.publicId,
          format: data.pdf.format || "pdf",
          bytes: data.pdf.bytes || 0,
          resourceType: "raw",
          folder: CLOUDINARY_FOLDERS.PDF,
          source: "notices",
          sourceId: createdDocRef.id
        }, userId);

        // If registering to media fails, roll back notice creation
        if (!mediaResult.success) {
          throw new Error(`Media sync failed: ${mediaResult.message}`);
        }
      }

      return { success: true, message: "Notice created and synced successfully." };

    } catch (error) {
      // SAFE ROLLBACK LOGIC
      
      // Rollback 1: Delete created notice document from Firestore if it was created
      if (createdDocRef?.id) {
        try {
          await deleteDoc(doc(db, "notices", createdDocRef.id));
        } catch (rollbackErr) {
          console.error("Failed to rollback Firestore notice document:", rollbackErr);
        }
      }

      // Rollback 2: Clean up orphaned PDF from Cloudinary
      if (data.pdf?.publicId) {
        try {
          await cloudinaryService.deleteFile(data.pdf.publicId, CLOUDINARY_FOLDERS.PDF);
        } catch (cloudinaryErr) {
          console.error("Failed to delete orphaned Cloudinary PDF:", cloudinaryErr);
        }
      }

      return { success: false, message: error.message };
    }
  }

  async updateNotice(id, data) {
    try {
      await updateDoc(doc(db, "notices", id), { ...data, updatedAt: serverTimestamp() });
      return { success: true, message: "Notice updated successfully." };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async moveToTrash(notice, userId = "admin") {
    try {
      await updateDoc(doc(db, "notices", notice.id), {
        status: "trashed",
        previousStatus: notice.status,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedBy: userId
      });
      return { success: true, message: "Notice moved to trash." };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async deletePermanently(notice) {
    try {
      if (notice.pdf?.publicId) {
        const result = await cloudinaryService.deleteFile(notice.pdf.publicId, CLOUDINARY_FOLDERS.PDF);
        if (!result.success) return result;
      }
      await deleteDoc(doc(db, "notices", notice.id));
      return { success: true, message: "Notice permanently deleted." };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

export default new NoticeService();
