import rateLimit from "express-rate-limit";

// Rate-limit auth endpoints per IP to blunt credential-stuffing attempts.
// Keyed additionally by email in the controller layer (not here) so a single
// attacker can't exhaust one victim's account by rotating IPs.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});
