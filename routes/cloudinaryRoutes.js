import express from "express";
import { getSignature, deleteFile } from "../controllers/cloudinaryController.js";

const router = express.Router();

router.post("/signature", getSignature);
router.delete("/file", deleteFile);

export default router;
