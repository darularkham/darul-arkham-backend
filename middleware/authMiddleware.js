export const verifyCronSecret = (req, res, next) => {
  const secret = req.headers["x-cron-secret"];
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    console.error("[SECURITY WARNING] CRON_SECRET is not configured in environment variables!");
    return res.status(500).json({ success: false, message: "Server auth configuration missing." });
  }

  if (!secret || secret !== expectedSecret) {
    return res.status(401).json({ success: false, message: "Unauthorized request." });
  }

  next();
};
