import sgMail from "../config/mail.js";
import { admin } from "../config/firebase.js";
import dotenv from "dotenv";

dotenv.config();

class EmailService {
  getAppName() {
    return process.env.APP_NAME || "Darul Arkham";
  }

  getSenderEmail() {
    const email =
      process.env.SENDGRID_VERIFIED_SENDER ||
      process.env.EMAIL_USER;

    if (!email) {
      throw new Error(
        "SENDGRID_VERIFIED_SENDER or EMAIL_USER must be configured."
      );
    }

    return email;
  }

  getSupportEmail() {
    return process.env.SUPPORT_EMAIL || this.getSenderEmail();
  }

  getClientUrl() {
    const rawUrl = process.env.CLIENT_URL;

    if (!rawUrl) {
      console.warn("⚠️ CLIENT_URL is not set. Defaulting to http://localhost:5173");
      return "http://localhost:5173";
    }

    // Safely parse the first URL if a comma-separated list was provided in .env
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

    if (!to) {
      throw new Error("Recipient email is required.");
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
      console.log(`✅ Email sent successfully to ${to}`);
      return {
        success: true,
        statusCode: response.statusCode,
      };
    } catch (error) {
      const details = error?.response?.body || error?.message || error;
      console.error("SendGrid Email Error:", details);
      throw error;
    }
  }

  async sendAdminInvitation(email, name, role) {
    try {
      const appName = this.getAppName();
      const supportEmail = this.getSupportEmail();
      const safeName = this.escapeHtml(name || "Administrator");
      const safeRole = this.escapeHtml(role?.toUpperCase() || "ADMIN");

      const actionCodeSettings = this.getActionCodeSettings("/reset-password");
      const firebaseLink = await admin
        .auth()
        .generatePasswordResetLink(email, actionCodeSettings);

      const passwordSetupLink = this.formatDirectAppUrl(
        firebaseLink,
        "/reset-password"
      );

      const subject = `${appName}: Complete Your Account Setup`;

      const text = `Hello ${name || "Administrator"},\n\nAn administrator account has been created for you on ${appName}.\n\nRole: ${role?.toUpperCase() || "ADMIN"}\n\nComplete your account setup by creating your password:\n\n${passwordSetupLink}\n\nIf you were not expecting this account, please contact ${supportEmail}.\n\n${appName} Administration`;

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName} Account Setup</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif;color:#222;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:32px;">
      <h1 style="font-size:21px;margin:0 0 20px;">Welcome to ${appName}</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Hello ${safeName},</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">An administrator account has been created for you.</p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 24px;"><strong>Role:</strong> ${safeRole}</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">Use the button below to create your password and complete your account setup.</p>
      <div style="margin:28px 0;">
        <a href="${passwordSetupLink}" style="display:inline-block;padding:12px 22px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold;">Complete Account Setup</a>
      </div>
      <p style="font-size:12px;line-height:1.5;color:#6b7280;">If the button does not work, copy and paste this address into your browser:</p>
      <p style="font-size:12px;line-height:1.5;word-break:break-all;"><a href="${passwordSetupLink}" style="color:#2563eb;">${passwordSetupLink}</a></p>
      <hr style="border:0;border-top:1px solid #eeeeee;margin:28px 0;">
      <p style="font-size:12px;line-height:1.5;color:#6b7280;margin:0;">If you were not expecting this account, please contact <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>.</p>
    </div>
    <p style="font-size:11px;text-align:center;color:#9ca3af;margin-top:20px;">${appName}</p>
  </div>
</body>
</html>`;

      return await this.sendEmail({ to: email, subject, text, html });
    } catch (error) {
      console.error(
        "Invitation Email Error:",
        error?.response?.body || error?.message || error
      );
      throw error;
    }
  }

  async sendForgotPasswordLink(email) {
    try {
      const appName = this.getAppName();
      const supportEmail = this.getSupportEmail();

      const actionCodeSettings = this.getActionCodeSettings("/reset-password");
      const firebaseLink = await admin
        .auth()
        .generatePasswordResetLink(email, actionCodeSettings);

      const passwordResetLink = this.formatDirectAppUrl(
        firebaseLink,
        "/reset-password"
      );

      const subject = `${appName}: Password Reset Request`;

      const text = `Hello,\n\nWe received a request to reset the password for your ${appName} administrator account.\n\nUse the following link to choose a new password:\n\n${passwordResetLink}\n\nIf you did not request this password reset, you can safely ignore this email.\n\nIf you believe someone is attempting to access your account, contact ${supportEmail}.\n\n${appName} Security`;

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName} Password Reset</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif;color:#222;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:32px;">
      <h1 style="font-size:21px;margin:0 0 20px;">Password Reset Request</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">We received a request to reset the password for your <strong>${appName}</strong> administrator account.</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">If you made this request, use the button below to choose a new password.</p>
      <div style="margin:28px 0;">
        <a href="${passwordResetLink}" style="display:inline-block;padding:12px 22px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold;">Reset Password</a>
      </div>
      <p style="font-size:12px;line-height:1.5;color:#6b7280;">If the button does not work, copy and paste this address into your browser:</p>
      <p style="font-size:12px;line-height:1.5;word-break:break-all;"><a href="${passwordResetLink}" style="color:#2563eb;">${passwordResetLink}</a></p>
      <hr style="border:0;border-top:1px solid #eeeeee;margin:28px 0;">
      <p style="font-size:12px;line-height:1.5;color:#6b7280;margin:0;">If you did not request this password reset, no action is required. If you are concerned about your account, contact <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a>.</p>
    </div>
    <p style="font-size:11px;text-align:center;color:#9ca3af;margin-top:20px;">${appName}</p>
  </div>
</body>
</html>`;

      return await this.sendEmail({ to: email, subject, text, html });
    } catch (error) {
      console.error(
        "Forgot Password Email Error:",
        error?.response?.body || error?.message || error
      );
      throw error;
    }
  }

  async sendPasswordChangeNotification(email, name = "Administrator") {
    try {
      const appName = this.getAppName();
      const supportEmail = this.getSupportEmail();
      const recoveryUrl = this.getRecoveryUrl("/forgot-password");
      const safeName = this.escapeHtml(name);

      const subject = `${appName}: Password Changed`;

      const text = `Hello ${name},\n\nYour ${appName} administrator account password was successfully changed.\n\nIf you did not make this change, secure your account immediately:\n\n${recoveryUrl}\n\nYou can also contact ${supportEmail}.\n\n${appName} Security`;

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName} Security Alert</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif;color:#222;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:32px;">
      <h1 style="font-size:21px;margin:0 0 20px;">Password Changed</h1>
      <p style="font-size:15px;line-height:1.6;">Hello ${safeName},</p>
      <p style="font-size:15px;line-height:1.6;">Your <strong>${appName}</strong> administrator account password was successfully changed.</p>
      <div style="margin:24px 0;padding:16px;background:#fff7ed;border-left:4px solid #f97316;">
        <p style="font-size:14px;font-weight:bold;margin:0 0 8px;">Did you make this change?</p>
        <p style="font-size:13px;line-height:1.5;margin:0;">If you did not change your password, secure your account immediately.</p>
      </div>
      <div style="margin:24px 0;">
        <a href="${recoveryUrl}" style="display:inline-block;padding:12px 22px;background:#dc2626;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold;">Secure My Account</a>
      </div>
      <p style="font-size:12px;line-height:1.5;color:#6b7280;">You can also contact <a href="mailto:${supportEmail}" style="color:#2563eb;">${supportEmail}</a> for assistance.</p>
    </div>
    <p style="font-size:11px;text-align:center;color:#9ca3af;margin-top:20px;">${appName}</p>
  </div>
</body>
</html>`;

      return await this.sendEmail({ to: email, subject, text, html });
    } catch (error) {
      console.error(
        "Password Notification Email Error:",
        error?.response?.body || error?.message || error
      );
      throw error;
    }
  }
}

export default new EmailService();
               
