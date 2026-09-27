require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const groupRoutes = require("./routes/groups");
const pledgeRoutes = require("./routes/pledges");
const orgRoutes = require("./routes/orgs");
const payoutRoutes = require("./routes/payouts");
const taxRoutes = require("./routes/tax");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/groups", pledgeRoutes); // adds /:groupId/pledges under the same base
app.use("/api/groups", payoutRoutes); // adds /:groupId/payouts
app.use("/api/groups", taxRoutes);    // adds /:groupId/tax-summary/:year(/pdf)
app.use("/api/orgs", orgRoutes);

// Centralized error handler — routes throw errors with .statusCode set
// (see groups.js's assertIsAdmin/assertIsMember) and this catches the rest.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Pushke backend listening on port ${PORT}`));
