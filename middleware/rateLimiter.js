import rateLimit from "express-rate-limit";

export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    message: "Too many password reset requests. Please wait 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const changePasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many password change notifications. Please try again in an hour.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
