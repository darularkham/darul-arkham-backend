import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.SENDGRID_API_KEY) {
  console.warn("⚠️ SENDGRID_API_KEY is not configured.");
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export default sgMail;
