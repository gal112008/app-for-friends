import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { computeStats } from "../utils/streaks";

const router = Router();
router.use(requireAuth);

const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

router.post("/", validateBody(createGroupSchema), async (req: AuthedRequest, res, next) => {
  try {
    const { name } = req.body as z.infer<typeof createGroupSchema>;
    const group = await prisma.group.create({
      data: {
        name,
        ownerId: req.userId as string,
        members: { create: { userId: req.userId as string } },
      },
    });
    res.status(201).json({ id: group.id, name: group.name, inviteCode: group.inviteCode });
  } catch (err) {
    next(err);
  }
});

const joinGroupSchema = z.object({
  inviteCode: z.string().trim().min(1).max(128),
});

router.post("/join", validateBody(joinGroupSchema), async (req: AuthedRequest, res, next) => {
  try {
    const { inviteCode } = req.body as z.infer<typeof joinGroupSchema>;
    const group = await prisma.group.findUnique({ where: { inviteCode } });
    if (!group) {
      return res.status(404).json({ error: "Invalid invite code" });
    }

    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId: req.userId as string } },
      update: {},
      create: { groupId: group.id, userId: req.userId as string },
    });

    res.json({ id: group.id, name: group.name });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const groups = await prisma.group.findMany({
      where: { members: { some: { userId: req.userId as string } } },
      select: { id: true, name: true, inviteCode: true },
    });
    res.json(groups);
  } catch (err) {
    next(err);
  }
});

// Friends-only leaderboard: every member of this group, ranked by current streak.
router.get("/:groupId/leaderboard", async (req: AuthedRequest, res, next) => {
  try {
    const { groupId } = req.params;

    // Confirm the requester is actually in this group before revealing anything.
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: req.userId as string } },
    });
    if (!membership) {
      return res.status(403).json({ error: "Not a member of this group" });
    }

    const members = await prisma.groupMember.findMany({
      where: { groupId },
      include: { user: { include: { goons: { select: { goonedAt: true } } } } },
    });

    type LeaderboardRow = {
      userId: string;
      displayName: string;
      currentStreak: number;
      maxStreak: number;
      avgPerDay: number;
      maxPerDay: number;
      totalGoons: number;
    };

    const leaderboard: LeaderboardRow[] = members
      .map((m: (typeof members)[number]) => {
        const stats = computeStats(m.user.goons.map((goon: { goonedAt: Date }) => goon.goonedAt));
        return {
          userId: m.user.id,
          displayName: m.user.displayName,
          currentStreak: stats.currentStreak,
          maxStreak: stats.maxStreak,
          avgPerDay: stats.avgPerDay,
          maxPerDay: stats.maxPerDay,
          totalGoons: stats.totalGoons,
        };
      })
      .sort((a: LeaderboardRow, b: LeaderboardRow) => b.currentStreak - a.currentStreak || b.totalGoons - a.totalGoons);

    res.json(leaderboard);
  } catch (err) {
    next(err);
  }
});

export default router;
