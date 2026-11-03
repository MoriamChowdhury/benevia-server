import { Request, Response, NextFunction } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

export interface AuthRequest extends Request {
  user?: { email: string; name: string };
}

const clientUrl = (process.env.CLIENT_URL || "").replace(/\/$/, "");

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${clientUrl}/api/auth/jwks`));
  }
  return jwks;
}

export async function verifyToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).send({ message: "Unauthorized: token missing" });
    return;
  }

  try {
    const token = header.split(" ")[1];
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: clientUrl,
      audience: clientUrl,
    });

    if (!payload.email) {
      res.status(401).send({ message: "Unauthorized: invalid token" });
      return;
    }

    req.user = {
      email: String(payload.email),
      name: String(payload.name || ""),
    };
    next();
  } catch {
    res.status(401).send({ message: "Unauthorized: invalid or expired token" });
  }
}