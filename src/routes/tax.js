const express = require("express");
const PDFDocument = require("pdfkit");
const { PrismaClient } = require("@prisma/client");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// Shared query: every disbursed payout split for a group in a given year,
// joined back to the member(s) whose pledges funded it.
async function getYearGivingByMember(groupId, year) {
  const start = new Date(`${year}-01-01T00:00:00.000Z`);
  const end = new Date(`${Number(year) + 1}-01-01T00:00:00.000Z`);

  // Pull disbursed pledges in range, with the payout(s) that used them.
  // NOTE: this simple model assumes one payout batches all currently-pledged
  // funds together, and a pledge's donor is credited proportionally for the
  // splits in that payout. For a v1, an equally valid simpler approach is to
  // record which pledge funded which specific PayoutSplit at charge time —
  // worth revisiting once real charge-level tracking is in place.
  const pledges = await prisma.pledge.findMany({
    where: { groupId, status: "DISBURSED", createdAt: { gte: start, lt: end } },
    include: { user: { select: { name: true, email: true } } },
  });

  const payouts = await prisma.payout.findMany({
    where: { groupId, createdAt: { gte: start, lt: end } },
    include: { splits: true },
  });

  // Simplified attribution: split each payout's org amounts across
  // contributing members proportionally to what each pledged that cycle.
  const byMember = {}; // email -> { name, gifts: [{date, org, amount}] }

  for (const payout of payouts) {
    const cyclePledges = pledges.filter((p) => Math.abs(new Date(p.createdAt) - new Date(payout.createdAt)) < 1000 * 60 * 60 * 24 * 8);
    const cycleTotal = cyclePledges.reduce((s, p) => s + p.amount, 0) || 1;

    for (const pledge of cyclePledges) {
      const share = pledge.amount / cycleTotal;
      const key = pledge.user.email;
      byMember[key] = byMember[key] || { name: pledge.user.name, gifts: [] };

      for (const split of payout.splits) {
        byMember[key].gifts.push({
          date: payout.createdAt,
          org: split.orgName,
          ein: split.orgEin,
          amountCents: Math.round(split.amount * share),
        });
      }
    }
  }

  return byMember;
}

// GET /api/groups/:groupId/tax-summary/:year  -> JSON, per person
router.get("/:groupId/tax-summary/:year", async (req, res) => {
  const { groupId, year } = req.params;
  const byMember = await getYearGivingByMember(groupId, year);

  const members = Object.entries(byMember).map(([email, data]) => ({
    email,
    name: data.name,
    gifts: data.gifts,
    subtotalCents: data.gifts.reduce((s, g) => s + g.amountCents, 0),
  }));

  res.json({
    year: Number(year),
    members,
    grandTotalCents: members.reduce((s, m) => s + m.subtotalCents, 0),
  });
});

// GET /api/groups/:groupId/tax-summary/:year/pdf  -> downloadable PDF
router.get("/:groupId/tax-summary/:year/pdf", async (req, res) => {
  const { groupId, year } = req.params;
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  const byMember = await getYearGivingByMember(groupId, year);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${group.name.replace(/\s+/g, "_")}_${year}_giving_summary.pdf"`);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  doc.fontSize(20).text(`${group.name} — ${year} Charitable Giving Summary`, { align: "left" });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor("#666").text(`Generated for record-keeping. Each person should report only their own contributions below.`);
  doc.moveDown(1);

  let grandTotal = 0;

  for (const [email, data] of Object.entries(byMember)) {
    doc.fillColor("#000").fontSize(14).text(data.name, { underline: true });
    doc.fontSize(9).fillColor("#888").text(email);
    doc.moveDown(0.3);

    let subtotal = 0;
    doc.fontSize(10).fillColor("#000");
    for (const gift of data.gifts) {
      const dollars = (gift.amountCents / 100).toFixed(2);
      subtotal += gift.amountCents;
      doc.text(`${new Date(gift.date).toLocaleDateString()}   ${gift.org} (EIN ${gift.ein})   $${dollars}`);
    }

    doc.moveDown(0.2);
    doc.fontSize(11).text(`${data.name}'s deductible total: $${(subtotal / 100).toFixed(2)}`, { align: "right" });
    doc.moveDown(1);
    grandTotal += subtotal;
  }

  doc.moveDown(0.5);
  doc.fontSize(12).text(`Combined family total (for reference only): $${(grandTotal / 100).toFixed(2)}`, { align: "right" });
  doc.moveDown(1);
  doc.fontSize(8).fillColor("#888").text(
    "This summary reflects processed donations for record-keeping purposes. Consult your tax professional to confirm deductibility and proper substantiation for each individual's contributions."
  );

  doc.end();
});

module.exports = router;
