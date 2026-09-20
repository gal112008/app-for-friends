import { Router } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import appleSigninAuth from "apple-signin-auth";
import { prisma } from "../lib/prisma";
import { validateBody } from "../middleware/validate";

const router = Router();

// Auth endpoints are the highest-value target for brute force / credential
// stuffing, so they get a much tighter limit than the rest of the API.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(authLimiter);

function issueJwt(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN || "30d") as jwt.SignOptions["expiresIn"],
  });
}

const googleSchema = z.object({
  idToken: z.string().min(10),
  displayName: z.string().min(1).max(60).optional(),
});

router.post("/google", validateBody(googleSchema), async (req, res, next) => {
  try {
    const { idToken, displayName } = req.body as z.infer<typeof googleSchema>;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(503).json({ error: "Google sign-in is not configured" });

    const ticket = await new OAuth2Client(clientId).verifyIdToken({
      idToken,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) {
      return res.status(401).json({ error: "Invalid Google token" });
    }

    const user = await prisma.user.upsert({
      where: { googleId: payload.sub },
      update: {},
      create: {
        googleId: payload.sub,
        email: payload.email_verified ? payload.email : undefined,
        displayName: displayName || payload.name || "New user",
      },
    });

    res.json({ token: issueJwt(user.id), user: { id: user.id, displayName: user.displayName } });
  } catch {
    return res.status(401).json({ error: "Invalid Google token" });
  }
});

const appleSchema = z.object({
  idToken: z.string().min(10),
  displayName: z.string().min(1).max(60).optional(),
});

router.post("/apple", validateBody(appleSchema), async (req, res, next) => {
  try {
    const { idToken, displayName } = req.body as z.infer<typeof appleSchema>;
    const clientId = process.env.APPLE_CLIENT_ID;
    if (!clientId) return res.status(503).json({ error: "Apple sign-in is not configured" });

    const payload = await appleSigninAuth.verifyIdToken(idToken, {
      audience: clientId,
      ignoreExpiration: false,
    });
    if (!payload?.sub) {
      return res.status(401).json({ error: "Invalid Apple token" });
    }

    const user = await prisma.user.upsert({
      where: { appleId: payload.sub },
      update: {},
      create: {
        appleId: payload.sub,
        email: payload.email,
        // Apple only sends a real name on the user's very first sign-in ever,
        // so the client must capture it then and pass it along here.
        displayName: displayName || "New user",
      },
    });

    res.json({ token: issueJwt(user.id), user: { id: user.id, displayName: user.displayName } });
  } catch {
    return res.status(401).json({ error: "Invalid Apple token" });
  }
});

export default router;
