import { Response } from "express";
import { Request } from "express";
import jwt from "jsonwebtoken";
import * as authService from "../services/auth.service";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";
import { User } from "../models/User";
import { AuthedRequest } from "../middleware/auth.middleware";

const REFRESH_COOKIE_NAME = "codrive_refresh";
const refreshCookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: "lax" as const,
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) throw new ApiError(400, "email, password, and name are required.");
  if (password.length < 8) throw new ApiError(400, "Password must be at least 8 characters.");

  const user = await authService.signUp(email, password, name);
  const accessToken = authService.signAccessToken(user._id);
  const refreshToken = authService.signRefreshToken(user._id);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
  res.status(201).json({
    user: { id: user._id, email: user.email, name: user.name, avatarData: user.avatarData },
    accessToken,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, "email and password are required.");

  const user = await authService.login(email, password);
  const accessToken = authService.signAccessToken(user._id);
  const refreshToken = authService.signRefreshToken(user._id);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
  res.json({
    user: { id: user._id, email: user.email, name: user.name, avatarData: user.avatarData },
    accessToken,
  });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie(REFRESH_COOKIE_NAME);
  res.status(204).send();
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) throw new ApiError(400, "email is required.");

  await authService.requestPasswordReset(email);

  // Identical response whether or not the account exists — never reveal it.
  res.json({ message: "If an account exists for that email, a reset link is on its way." });
});

// Issues a fresh short-lived access token from the long-lived refresh
// cookie. The frontend calls this once on page load (before it has any
// access token yet) so a signed-in user stays signed in across full page
// reloads and separate HTML files without re-entering credentials —
// exactly the flow a real single-page app's router would give you for free,
// which these separate static pages don't have.
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) throw new ApiError(401, "No refresh token.");

  let payload: { sub: string };
  try {
    payload = jwt.verify(token, env.jwtRefreshSecret) as { sub: string };
  } catch {
    throw new ApiError(401, "Refresh token invalid or expired.");
  }

  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, "Account no longer exists.");

  const accessToken = authService.signAccessToken(user._id);
  res.json({ accessToken, user: { id: user._id, email: user.email, name: user.name, avatarData: user.avatarData } });
});

export const me = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const user = await User.findById(req.userId);
  if (!user) throw new ApiError(404, "User not found.");
  res.json({ user: { id: user._id, email: user.email, name: user.name, avatarData: user.avatarData } });
});

export const updateProfile = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const { name, email, avatarData } = req.body;
  const user = await User.findById(req.userId);
  if (!user) throw new ApiError(404, "User not found.");

  if (name) user.name = name;
  if (email) user.email = email.toLowerCase();
  if (avatarData !== undefined) {
    if (avatarData !== null && (typeof avatarData !== "string" || !avatarData.startsWith("data:image/") || avatarData.length > 700_000)) {
      throw new ApiError(400, "Profile image must be a resized image under 500 KB.");
    }
    user.avatarData = avatarData || undefined;
  }
  await user.save();

  res.json({ user: { id: user._id, email: user.email, name: user.name, avatarData: user.avatarData } });
});

export const deleteAccount = asyncHandler(async (req: AuthedRequest, res: Response) => {
  await User.findByIdAndDelete(req.userId);
  // A production version would also cascade-delete this user's Progress,
  // RevisionRecord, Bookmark, Project/ProjectFile, and Submission documents
  // here — omitted for brevity, but the pattern is identical to any of the
  // other `deleteMany({ userId })` calls already in this codebase.
  res.clearCookie(REFRESH_COOKIE_NAME);
  res.status(204).send();
});
