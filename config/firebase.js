import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

const rawKey = process.env.FIREBASE_PRIVATE_KEY || "";
const privateKey = rawKey.replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  throw new Error("Missing Firebase Admin credentials in environment variables.");
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
  console.log("✅ Firebase Admin SDK initialized successfully.");
}

const db = admin.firestore();
const auth = admin.auth();
const FieldValue = admin.firestore.FieldValue;

export { admin, db, auth, FieldValue };
export default admin;
