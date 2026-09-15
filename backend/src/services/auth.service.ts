import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import { Types } from "mongoose";
import { User } from "../models/User";
import { ApiError } from "../utils/ApiError";
import { env } from "../config/env";

const BCRYPT_COST_FACTOR = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST_FACTOR);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signAccessToken(userId: Types.ObjectId): string {
  return jwt.sign({ sub: userId.toString() }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn as SignOptions["expiresIn"],
  });
}

export function signRefreshToken(userId: Types.ObjectId): string {
  return jwt.sign({ sub: userId.toString() }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn as SignOptions["expiresIn"],
  });
}

export async function signUp(email: string, password: string, name: string) {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    // Same response shape as an invalid-login would give, elsewhere — but for
    // signup specifically it's fine to be explicit, since the person is
    // choosing an email, not probing for one that already exists.
    throw new ApiError(409, "An account with this email already exists.");
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({ email: email.toLowerCase(), passwordHash, name });
  return user;
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  // Deliberately identical error for "no such user" and "wrong password" —
  // never reveal which one it was.
  if (!user) throw new ApiError(401, "Invalid email or password.");

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new ApiError(401, "Invalid email or password.");

  user.lastActiveAt = new Date();
  await user.save();
  return user;
}

// Forgot-password: issue a single-use, time-limited token and email it.
// Always return the same success response whether or not the email exists —
// implemented at the controller level so timing doesn't leak it either.
export async function requestPasswordReset(email: string) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return; // silently no-op — controller responds identically either way

  const resetToken = jwt.sign({ sub: user._id.toString(), purpose: "password_reset" }, env.jwtAccessSecret, {
    expiresIn: "30m",
  });

  // TODO: send `resetToken` via email service. Never log it, never return it
  // in the API response.
  void resetToken;
}
