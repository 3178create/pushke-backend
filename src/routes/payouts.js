const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth } = require("../middleware/auth");
const { chargeCard, sendToOrg } = require("../lib/donationProcessor");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// POST /api/groups/:groupId/payouts { splits: [{ orgId, percentage }] }
// Charges any un-charged pledges, then splits the total across the chosen
// organizations according to percentage (must sum to 100).
router.post("/:groupId/payouts", async (req, res) => {
  const { groupId } = req.params;
  const { splits } = req.body;

  if (!Array.isArray(splits) || splits.length === 0) {
    return res.status(400).json({ error: "splits is required, e.g. [{ orgId, percentage }]" });
  }
  const pctSum = splits.reduce((s, x) => s + x.percentage, 0);
  if (pctSum !== 100) return res.status(400).json({ error: `percentages must sum to 100 (got ${pctSum})` });

  const pledges = await prisma.pledge.findMany({ where: { groupId, status: "PLEDGED" } });
  if (pledges.length === 0) return res.status(400).json({ error: "No pledges to send" });

  // 1. Charge each pledger's saved payment method (pledge-and-charge model).
  for (const pledge of pledges) {
    const result = await chargeCard({ userId: pledge.userId, amountCents: pledge.amount });
    if (!result.success) {
      return res.status(502).json({ error: `Charge failed for pledge ${pledge.id}` });
    }
  }

  const totalCents = pledges.reduce((sum, p) => sum + p.amount, 0);

  // 2. Send the total to each selected org per its percentage split.
  const orgIds = splits.map((s) => s.orgId);
  const orgs = await prisma.org.findMany({ where: { id: { in: orgIds } } });
  const orgById = Object.fromEntries(orgs.map((o) => [o.id, o]));

  const payout = await prisma.payout.create({ data: { groupId, amount: totalCents } });

  for (const split of splits) {
    const org = orgById[split.orgId];
    if (!org) continue;
    const amountCents = Math.round((totalCents * split.percentage) / 100);

    const result = await sendToOrg({ ein: org.ein, amountCents, donorUserId: req.userId });

    await prisma.payoutSplit.create({
      data: {
        payoutId: payout.id,
        orgId: org.id,
        orgName: org.name,
        orgEin: org.ein,
        percentage: split.percentage,
        amount: amountCents,
        receiptUrl: result.receiptUrl || null,
      },
    });
  }

  // 3. Mark pledges as disbursed.
  await prisma.pledge.updateMany({
    where: { id: { in: pledges.map((p) => p.id) } },
    data: { status: "DISBURSED" },
  });

  const full = await prisma.payout.findUnique({ where: { id: payout.id }, include: { splits: true } });
  res.status(201).json(full);
});

module.exports = router;
