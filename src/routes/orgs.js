const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

router.use(requireAuth);

// GET /api/orgs?q=search-term
// Returns curated (recommended) orgs first, then any matching custom orgs.
router.get("/", async (req, res) => {
  const { q } = req.query;

  const where = q
    ? { name: { contains: q, mode: "insensitive" } }
    : {};

  const orgs = await prisma.org.findMany({
    where,
    orderBy: [{ curated: "desc" }, { name: "asc" }],
  });

  res.json(orgs);
});

module.exports = router;
