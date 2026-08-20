import sgMail from "../config/mail.js";
import { admin } from "../config/firebase.js";
import dotenv from "dotenv";

dotenv.config();

class EmailService {
  getAppName() {
    return process.env.APP_NAME || "Darul Arkham";
  }

  getSenderEmail() {
    const email = process.env.SENDGRID_VERIFIED_SENDER || process.env.EMAIL_USER;
    if (!email) {
      throw new Error("SENDGRID_VERIFIED_SENDER or EMAIL_USER must be configured.");
    }
    return email;
  }

  getSupportEmail() {
    return process.env.SUPPORT_EMAIL || this.getSenderEmail();
  }

  getClientUrl() {
    const rawUrl = process.env.CLIENT_URL;

    if (!rawUrl) {
      throw new Error("CLIENT_URL environment variable is not defined.");
    }

    const primaryUrl = rawUrl.split(",")[0].trim();
    return primaryUrl.replace(/\/+$/, "");
  }

  getRecoveryUrl(path = "/reset-password") {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${this.getClientUrl()}${cleanPath}`;
  }

  getActionCodeSettings(path = "/reset-password") {
    return {
      url: this.getRecoveryUrl(path),
      handleCodeInApp: true,
    };
  }

  formatDirectAppUrl(firebaseGeneratedLink, targetPath = "/reset-password") {
    try {
      const firebaseUrl = new URL(firebaseGeneratedLink);
      const oobCode = firebaseUrl.searchParams.get("oobCode");
      const apiKey = firebaseUrl.searchParams.get("apiKey");

      if (!oobCode) return firebaseGeneratedLink;

      const appUrl = this.getRecoveryUrl(targetPath);
      const params = new URLSearchParams();
      params.set("oobCode", oobCode);
      if (apiKey) params.set("apiKey", apiKey);

      return `${appUrl}?${params.toString()}`;
    } catch {
      return firebaseGeneratedLink;
    }
  }

  escapeHtml(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  getSender() {
    return {
      email: this.getSenderEmail(),
      name: this.getAppName(),
    };
  }

  async sendEmail({ to, subject, text, html }) {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error("SENDGRID_API_KEY is not configured.");
    }

    const message = {
      to,
      from: this.getSender(),
      replyTo: this.getSupportEmail(),
      subject,
      text,
      html,
    };

    try {
      const [response] = await sgMail.send(message);
      return { success: true, statusCode: response.statusCode };
    } catch (error) {
      console.error("SendGrid Email Error:", error?.response?.body || error?.message || error);
      throw error;
    }
  }

  async sendAdminInvitation(email, name, role) {
    const appName = this.getAppName();
    const safeName = this.escapeHtml(name || "Administrator");

    const actionCodeSettings = this.getActionCodeSettings("/reset-password");
    const firebaseLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
    const passwordSetupLink = this.formatDirectAppUrl(firebaseLink, "/reset-password");

    const subject = `${appName}: Complete Your Account Setup`;
    const text = `Hello ${name},\n\nAccount setup link: ${passwordSetupLink}`;
    const html = `<p>Hello ${safeName},</p><p>Account setup link: <a href="${passwordSetupLink}">${passwordSetupLink}</a></p>`;

    return await this.sendEmail({ to: email, subject, text, html });
  }

  async sendForgotPasswordLink(email) {
    const appName = this.getAppName();

    const actionCodeSettings = this.getActionCodeSettings("/reset-password");
    const firebaseLink = await admin.auth().generatePasswordResetLink(email, actionCodeSettings);
    const passwordResetLink = this.formatDirectAppUrl(firebaseLink, "/reset-password");

    const subject = `${appName}: Password Reset Request`;
    const text = `Hello,\n\nReset your password here: ${passwordResetLink}`;
    const html = `<p>Reset your password here: <a href="${passwordResetLink}">${passwordResetLink}</a></p>`;

    return await this.sendEmail({ to: email, subject, text, html });
  }

  async sendPasswordChangeNotification(email, name = "Administrator") {
    const appName = this.getAppName();
    const recoveryUrl = this.getRecoveryUrl("/forgot-password");

    const subject = `${appName}: Password Changed`;
    const text = `Hello ${name},\n\nYour password was changed. Secure account: ${recoveryUrl}`;
    const html = `<p>Hello ${this.escapeHtml(name)},</p><p>Your password was changed. Secure account: <a href="${recoveryUrl}">${recoveryUrl}</a></p>`;

    return await this.sendEmail({ to: email, subject, text, html });
  }
}

export default new EmailService();
      
