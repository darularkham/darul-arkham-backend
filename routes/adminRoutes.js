import express from "express";
import adminController from "../controllers/adminController.js";
import { forgotPasswordLimiter, changePasswordLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.post("/create", (req, res) => adminController.createAdmin(req, res));
router.put("/update", (req, res) => adminController.updateAdmin(req, res));
router.post("/forgot-password", forgotPasswordLimiter, (req, res) => adminController.forgotPassword(req, res));
router.post("/notify-password-change", changePasswordLimiter, (req, res) => adminController.notifyPasswordChange(req, res));
router.delete("/:id", (req, res) => adminController.deleteAdmin(req, res));

export default router;
