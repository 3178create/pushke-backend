const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// POST /api/groups/:groupId/pledges { amountCents, method }
// Records a pledge. In "pledge-and-charge" mode (recommended in the spec),
// this does NOT charge the card yet — it just adds to the box. The actual
// charge happens at payout time via the donation processor.
router.post("/:groupId/pledges", async (req, res) => {
  const { groupId } = req.params;
  const { amountCents, method } = req.body;
  if (!amountCents || amountCents <= 0) return res.status(400).json({ error: "amountCents must be a positive integer" });

  const pledge = await prisma.pledge.create({
    data: { groupId, userId: req.userId, amount: amountCents, method: method || "card" },
  });

  res.status(201).json(pledge);
});

// GET /api/groups/:groupId/pledges  -> current box balance + per-member breakdown
router.get("/:groupId/pledges", async (req, res) => {
  const { groupId } = req.params;
  const pledges = await prisma.pledge.findMany({
    where: { groupId, status: "PLEDGED" },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const total = pledges.reduce((sum, p) => sum + p.amount, 0);
  res.json({ totalCents: total, pledges });
});

module.exports = router;
