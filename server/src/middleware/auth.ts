import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { User } from "../models/User.js";
import type { Role } from "../types.js";
import { AppError } from "../utils.js";

export interface AuthUser {
  id: string;
  role: Role;
  name: string;
  email: string;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

interface TokenPayload {
  sub: string;
  role: Role;
}

export function signToken(userId: string, role: Role): string {
  return jwt.sign({ sub: userId, role } satisfies TokenPayload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export async function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) throw new AppError("Authentication required.", 401);

    let payload: TokenPayload;
    try {
      payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
    } catch {
      throw new AppError("Invalid or expired session. Please log in again.", 401);
    }

    const user = await User.findById(payload.sub);
    if (!user) throw new AppError("Account not found.", 401);
    if (user.isFlagged) throw new AppError("This account has been restricted. Contact an administrator.", 403);

    req.user = { id: user.id, role: user.role, name: user.name, email: user.email };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError("Authentication required.", 401));
    if (!roles.includes(req.user.role)) {
      return next(new AppError("You do not have access to this resource.", 403));
    }
    next();
  };
}
