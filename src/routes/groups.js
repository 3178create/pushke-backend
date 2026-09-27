const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// POST /api/groups { name }
// Creates a group and makes the creator its ADMIN, FAMILY, ACTIVE member.
router.post("/", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });

  const user = await prisma.user.findUnique({ where: { id: req.userId } });

  const group = await prisma.group.create({
    data: {
      name,
      memberships: {
        create: {
          userId: user.id,
          invitedEmail: user.email,
          role: "ADMIN",
          relation: "FAMILY",
          status: "ACTIVE",
        },
      },
      subscription: { create: { plan: "FREE" } },
    },
    include: { memberships: true, subscription: true },
  });

  res.status(201).json(group);
});

// POST /api/groups/:groupId/invite { email, relation: "FAMILY" | "FRIEND" }
router.post("/:groupId/invite", async (req, res) => {
  const { groupId } = req.params;
  const { email, relation } = req.body;
  if (!email || !["FAMILY", "FRIEND"].includes(relation)) {
    return res.status(400).json({ error: "email and relation ('FAMILY' or 'FRIEND') are required" });
  }

  await assertIsAdmin(groupId, req.userId);

  // Free-plan member cap enforcement (mirrors the app's paywall logic).
  const sub = await prisma.subscription.findUnique({ where: { groupId } });
  const memberCount = await prisma.membership.count({ where: { groupId } });
  const FREE_CAP = 4;
  if (sub?.plan === "FREE" && memberCount >= FREE_CAP) {
    return res.status(402).json({ error: "Free plan is capped at 4 people. Upgrade to Pushke+ to add more." });
  }

  const membership = await prisma.membership.create({
    data: { groupId, invitedEmail: email, relation, status: "PENDING", role: "MEMBER" },
  });

  // TODO: send a real invite email here (SendGrid/Postmark/etc) with a signup link.
  res.status(201).json(membership);
});

// POST /api/groups/:groupId/invite/accept
// Called by the invited user once they've created their own account.
router.post("/:groupId/invite/accept", async (req, res) => {
  const { groupId } = req.params;
  const user = await prisma.user.findUnique({ where: { id: req.userId } });

  const membership = await prisma.membership.findUnique({
    where: { groupId_invitedEmail: { groupId, invitedEmail: user.email } },
  });
  if (!membership) return res.status(404).json({ error: "No pending invite found for your email in this group" });

  const updated = await prisma.membership.update({
    where: { id: membership.id },
    data: { userId: user.id, status: "ACTIVE" },
  });

  res.json(updated);
});

// GET /api/groups/:groupId/members
router.get("/:groupId/members", async (req, res) => {
  const { groupId } = req.params;
  await assertIsMember(groupId, req.userId);

  const members = await prisma.membership.findMany({
    where: { groupId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(members);
});

async function assertIsMember(groupId, userId) {
  const membership = await prisma.membership.findFirst({ where: { groupId, userId, status: "ACTIVE" } });
  if (!membership) {
    const err = new Error("Not a member of this group");
    err.statusCode = 403;
    throw err;
  }
  return membership;
}

async function assertIsAdmin(groupId, userId) {
  const membership = await assertIsMember(groupId, userId);
  if (membership.role !== "ADMIN") {
    const err = new Error("Admin only");
    err.statusCode = 403;
    throw err;
  }
  return membership;
}

module.exports = router;
