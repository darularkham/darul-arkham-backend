import sgMail from "@sendgrid/mail";
import { admin } from "../config/firebase.js";
import dotenv from "dotenv";

dotenv.config();

class EmailService {
  constructor() {
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    }
  }

  getRecoveryUrl(path = "/reset-password") {
    const baseUrl = process.env.CLIENT_URL || "http://localhost:5174";
    const cleanBase = baseUrl.replace(/\/+$|\s+/g, "");
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${cleanBase}${cleanPath}`;
  }

  getActionCodeSettings(path = "/reset-password") {
    return {
      url: this.getRecoveryUrl(path),
      handleCodeInApp: true,
    };
  }

  formatDirectAppUrl(firebaseGeneratedLink, targetPath = "/reset-password") {
    try {
      const urlObj = new URL(firebaseGeneratedLink);
      const oobCode = urlObj.searchParams.get("oobCode");
      const apiKey = urlObj.searchParams.get("apiKey");

      if (!oobCode) return firebaseGeneratedLink;

      const appBaseUrl = this.getRecoveryUrl(targetPath);
      return `${appBaseUrl}?oobCode=${oobCode}${apiKey ? `&apiKey=${apiKey}` : ""}`;
    } catch (e) {
      return firebaseGeneratedLink;
    }
  }

  getSenderEmail() {
    return process.env.EMAIL_USER || "your-verified-single-sender@gmail.com";
  }

  async sendAdminInvitation(email, name, role) {
    try {
      const actionCodeSettings = this.getActionCodeSettings("/reset-password");
      const rawLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
      const passwordSetupLink = this.formatDirectAppUrl(rawLink, "/reset-password");

      const supportEmail = process.env.SUPPORT_EMAIL || this.getSenderEmail();
      const appName = process.env.APP_NAME || "Darul Arkham";

      const msg = {
        to: email,
        from: {
          email: this.getSenderEmail(),
          name: appName,
        },
        replyTo: supportEmail,
        subject: `Welcome to ${appName} - Set Your Password`,
        text: `Hello ${name},\n\nAn administrator account (${role?.toUpperCase() || "ADMIN"}) has been created for you on ${appName}.\n\nPlease set your password using this link:\n${passwordSetupLink}\n\nSupport: ${supportEmail}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 24px; color: #222; max-width: 560px; margin: 0 auto; border: 1px solid #e1e4e8; border-radius: 8px;">
            <h2 style="color: #007bff; margin-top: 0;">Welcome, ${name}!</h2>
            <p>An administrator account has been created for you on <strong>${appName}</strong>.</p>
            <p><strong>Role:</strong> ${role?.toUpperCase() || "ADMIN"}</p>
            <p>Click below to set your password and activate your account:</p>
            <div style="margin: 24px 0;">
              <a href="${passwordSetupLink}" style="background-color: #007bff; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Set Account Password</a>
            </div>
            <p style="font-size: 12px; color: #666;">Or copy and paste this link:</p>
            <p style="font-size: 12px; color: #007bff; word-break: break-all;">${passwordSetupLink}</p>
            <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
            <p style="font-size: 11px; color: #888;">Questions? Contact support at <a href="mailto:${supportEmail}" style="color: #007bff;">${supportEmail}</a>.</p>
          </div>
        `,
      };

      const response = await sgMail.send(msg);
      return { success: true, response };
    } catch (error) {
      console.error("Invitation Email Error:", error.response ? error.response.body : error);
      throw error;
    }
  }

  async sendForgotPasswordLink(email) {
    try {
      const actionCodeSettings = this.getActionCodeSettings("/reset-password");
      const rawLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
      const passwordResetLink = this.formatDirectAppUrl(rawLink, "/reset-password");

      const supportEmail = process.env.SUPPORT_EMAIL || this.getSenderEmail();
      const appName = process.env.APP_NAME || "Darul Arkham";

      const msg = {
        to: email,
        from: {
          email: this.getSenderEmail(),
          name: appName,
        },
        replyTo: supportEmail,
        subject: `Reset Your Password - ${appName}`,
        text: `Hello,\n\nA password reset request was received for your ${appName} administrator account.\n\nReset link:\n${passwordResetLink}\n\nIf you did not request this, please ignore this email.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 24px; color: #222; max-width: 560px; margin: 0 auto; border: 1px solid #e1e4e8; border-radius: 8px;">
            <h2 style="color: #1a1a1a; margin-top: 0;">Password Reset Request</h2>
            <p>We received a request to reset the password for your <strong>${appName}</strong> administrator account.</p>
            <div style="margin: 24px 0;">
              <a href="${passwordResetLink}" style="background-color: #007bff; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Reset Password</a>
            </div>
            <p style="font-size: 12px; color: #666;">Or copy and paste this link:</p>
            <p style="font-size: 12px; color: #007bff; word-break: break-all;">${passwordResetLink}</p>
            <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
            <p style="font-size: 11px; color: #888;">If you didn't request this, contact <a href="mailto:${supportEmail}" style="color: #007bff;">${supportEmail}</a>.</p>
          </div>
        `,
      };

      const response = await sgMail.send(msg);
      return { success: true, response };
    } catch (error) {
      console.error("Forgot Password Email Error:", error.response ? error.response.body : error);
      throw error;
    }
  }

  async sendPasswordChangeNotification(email, name = "Administrator") {
    try {
      const supportEmail = process.env.SUPPORT_EMAIL || this.getSenderEmail();
      const appName = process.env.APP_NAME || "Darul Arkham";
      const recoveryUrl = this.getRecoveryUrl("/forgot-password");

      const msg = {
        to: email,
        from: {
          email: this.getSenderEmail(),
          name: appName,
        },
        replyTo: supportEmail,
        subject: `Security Alert: Password Changed - ${appName}`,
        text: `Hello ${name},\n\nYour password for ${appName} was successfully changed.\n\nIf you did not make this change, recover your account immediately: ${recoveryUrl}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 24px; color: #222; max-width: 560px; margin: 0 auto; border: 1px solid #e1e4e8; border-radius: 8px;">
            <h2 style="color: #dc3545; margin-top: 0;">Security Alert</h2>
            <p>Hello <strong>${name}</strong>,</p>
            <p>Your password for <strong>${appName}</strong> was updated successfully.</p>
            <div style="background-color: #fff3f2; border-left: 4px solid #dc3545; padding: 16px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-weight: bold; color: #b02a37;">Didn't perform this action?</p>
              <p style="margin: 8px 0; font-size: 13px; color: #444;">If you did not change your password, recover your account immediately:</p>
              <a href="${recoveryUrl}" style="color: #dc3545; font-weight: bold; font-size: 13px;">Request Immediate Password Recovery</a>
            </div>
            <div style="font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 12px;">
              Event Time: ${new Date().toUTCString()}
            </div>
          </div>
        `,
      };

      const response = await sgMail.send(msg);
      return { success: true, response };
    } catch (error) {
      console.error("Password Notification Email Error:", error.response ? error.response.body : error);
      throw error;
    }
  }
}

export default new EmailService();
