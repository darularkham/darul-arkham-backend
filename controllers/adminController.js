import { admin, db } from "../config/firebase.js";
import emailService from "../services/emailService.js";

class AdminController {
  async createAdmin(req, res) {
    try {
      const { email, name, role, permissionOverrides } = req.body;

      if (!email || !name) {
        return res.status(400).json({
          success: false,
          message: "Name and email address are required.",
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanName = name.trim();

      const userRecord = await admin.auth().createUser({
        email: cleanEmail,
        displayName: cleanName,
        emailVerified: false,
      });

      await db.collection("admins").doc(userRecord.uid).set({
        name: cleanName,
        email: cleanEmail,
        role: role || "admin",
        permissionOverrides: permissionOverrides || {},
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLogin: null,
      });

      await emailService.sendAdminInvitation(cleanEmail, cleanName, role);

      return res.status(201).json({
        success: true,
        message: "Administrator created successfully! Invitation link sent to their email.",
        uid: userRecord.uid,
      });
    } catch (error) {
      console.error("Create Admin Error:", error);
      if (error.code === "auth/email-already-exists") {
        return res.status(400).json({
          success: false,
          message: "An administrator account with this email already exists.",
        });
      }
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to create administrator.",
      });
    }
  }

  async updateAdmin(req, res) {
    try {
      const { uid, name, email, role, permissionOverrides } = req.body;

      if (!uid || !email || !name) {
        return res.status(400).json({
          success: false,
          message: "UID, name, and email address are required.",
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanName = name.trim();

      await admin.auth().updateUser(uid, {
        email: cleanEmail,
        displayName: cleanName,
      });

      await db.collection("admins").doc(uid).update({
        name: cleanName,
        email: cleanEmail,
        role: role || "admin",
        permissionOverrides: permissionOverrides || {},
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({
        success: true,
        message: "Administrator updated successfully.",
      });
    } catch (error) {
      console.error("Update Admin Error:", error);
      if (error.code === "auth/email-already-exists") {
        return res.status(400).json({
          success: false,
          message: "An account with this email address already exists.",
        });
      }
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to update administrator.",
      });
    }
  }

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      if (!email || !email.trim()) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid email address.",
        });
      }

      const cleanEmail = email.trim().toLowerCase();

      try {
        await admin.auth().getUserByEmail(cleanEmail);
      } catch (authErr) {
        if (authErr.code === "auth/user-not-found") {
          return res.status(404).json({
            success: false,
            message: "No administrator account is registered with this email address.",
          });
        }
        throw authErr;
      }

      const adminSnapshot = await db
        .collection("admins")
        .where("email", "==", cleanEmail)
        .limit(1)
        .get();

      if (!adminSnapshot.empty) {
        const adminData = adminSnapshot.docs[0].data();
        if (adminData.status === "disabled" || adminData.status === "suspended") {
          return res.status(403).json({
            success: false,
            message: `Cannot reset password. Account is currently ${adminData.status}.`,
          });
        }
      }

      await emailService.sendForgotPasswordLink(cleanEmail);

      return res.status(200).json({
        success: true,
        message: "Password reset instructions have been sent to your email inbox.",
      });
    } catch (error) {
      console.error("Forgot Password Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error while processing password reset request.",
      });
    }
  }

  async notifyPasswordChange(req, res) {
    try {
      const { email, name } = req.body;

      if (!email || !email.trim()) {
        return res.status(400).json({
          success: false,
          message: "Target email address is required.",
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanName = name ? name.trim() : "Administrator";

      await emailService.sendPasswordChangeNotification(cleanEmail, cleanName);

      return res.status(200).json({
        success: true,
        message: "Password change alert notification dispatched successfully.",
      });
    } catch (error) {
      console.error("Notify Password Change Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error while dispatching security alert.",
      });
    }
  }

  async deleteAdmin(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Admin ID is required.",
        });
      }

      try {
        await admin.auth().deleteUser(id);
      } catch (authError) {
        if (authError.code !== "auth/user-not-found") {
          throw authError;
        }
      }

      await db.collection("admins").doc(id).delete();

      return res.status(200).json({
        success: true,
        message: "Administrator deleted permanently.",
      });
    } catch (error) {
      console.error("Delete Admin Error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to delete administrator.",
      });
    }
  }
}

export default new AdminController();
