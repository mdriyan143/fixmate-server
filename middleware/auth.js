import { createRemoteJWKSet, jwtVerify } from "jose";
import { col } from "../config/db.js";

let jwks;

// 401 = no or bad token. Role is always read fresh from the database.
export async function verifyToken(req, res, next) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    // same value as the client BETTER_AUTH_URL, without a "/" at the end
    const base = String(process.env.AUTH_URL || "").replace(/\/+$/, "");

    jwks ??= createRemoteJWKSet(new URL(`${base}/api/auth/jwks`));
    const { payload } = await jwtVerify(token, jwks, {
      issuer: base,
      audience: base,
    });

    const user = await col("users").findOne({ email: payload.email });
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    req.user = {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role || "customer",
    };
    next();
  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
}

// 403 = valid user, wrong role
const allow = (role) => (req, res, next) =>
  req.user.role === role ? next() : res.status(403).json({ message: "Forbidden" });

export const verifyCustomer = allow("customer");
export const verifyTechnician = allow("technician");
export const verifyAdmin = allow("admin");