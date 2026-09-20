import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// Global leaderboard ranks by total goons in the last 30 days rather than
// current streak — computing every user's streak on every request doesn't
// scale, and "most active recently" is a reasonable global ranking anyway.
// (Per-friend-group leaderboards use the more expensive streak calc since
// those groups are small.)
router.get("/", async (_req, res, next) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const rows = await prisma.$queryRaw<
      { id: string; displayName: string; goonCount: bigint }[]
    >`
      SELECT u.id, u."displayName", COUNT(g.id) AS "goonCount"
      FROM users u
      JOIN goons g ON g."userId" = u.id
      WHERE g."goonedAt" >= ${since}
      GROUP BY u.id, u."displayName"
      ORDER BY "goonCount" DESC
      LIMIT 100
    `;

    res.json(
      rows.map((r: { id: string; displayName: string; goonCount: bigint }) => ({
        userId: r.id,
        displayName: r.displayName,
        goonCountLast30Days: Number(r.goonCount),
      }))
    );
  } catch (err) {
    next(err);
  }
});

export default router;
