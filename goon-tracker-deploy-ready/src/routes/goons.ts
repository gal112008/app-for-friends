import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { computeStats } from "../utils/streaks";

const router = Router();
router.use(requireAuth);

// A real user records a court visit (a "goon") only a handful of times a day.
// This limit exists purely to stop a buggy or malicious client from
// spamming thousands of fake goons to fake a leaderboard position.
const goonLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/", goonLimiter, async (req: AuthedRequest, res, next) => {
  try {
    const goon = await prisma.goon.create({
      data: { userId: req.userId as string },
    });
    res.status(201).json({ id: goon.id, goonedAt: goon.goonedAt });
  } catch (err) {
    next(err);
  }
});

router.get("/me/stats", async (req: AuthedRequest, res, next) => {
  try {
    const goons = await prisma.goon.findMany({
      where: { userId: req.userId as string },
      select: { goonedAt: true },
    });
    const stats = computeStats(goons.map((goon: { goonedAt: Date }) => goon.goonedAt));
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

export default router;
