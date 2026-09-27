// Abstraction over whichever real donation processor you choose (Every.org,
// Pledge, Chariot, Stripe+manual KYC layer, etc). Swap the body of these
// functions for real API calls — nothing else in the app needs to change.
//
// IMPORTANT: this file is a stub. It does not move real money. Replace
// chargeCard() and sendToOrg() with real API calls before going live, and
// keep API keys in environment variables, never in source.

const EVERY_ORG_API_KEY = process.env.EVERY_ORG_API_KEY; // set in .env, never commit

/**
 * Charges the family's saved card/bank method for a pledge cycle.
 * Real implementation: POST to your processor's charge endpoint.
 */
async function chargeCard({ userId, amountCents }) {
  if (!EVERY_ORG_API_KEY) {
    console.warn("[donationProcessor] STUB MODE — no EVERY_ORG_API_KEY set. Simulating charge.");
    return { success: true, chargeId: `stub_charge_${Date.now()}`, receiptUrl: null };
  }

  // Example real call shape (adjust to the actual Every.org / processor docs):
  // const res = await fetch("https://partners.every.org/v0.2/charges", {
  //   method: "POST",
  //   headers: { Authorization: `Bearer ${EVERY_ORG_API_KEY}`, "Content-Type": "application/json" },
  //   body: JSON.stringify({ userId, amountCents }),
  // });
  // const data = await res.json();
  // return { success: res.ok, chargeId: data.id, receiptUrl: data.receiptUrl };

  throw new Error("chargeCard: real API integration not yet implemented");
}

/**
 * Sends a charged amount on to a specific nonprofit (by EIN) and requests
 * an IRS-compliant receipt. Real implementation: POST to your processor's
 * donation/disbursement endpoint.
 */
async function sendToOrg({ ein, amountCents, donorUserId }) {
  if (!EVERY_ORG_API_KEY) {
    console.warn("[donationProcessor] STUB MODE — simulating disbursement to", ein);
    return { success: true, donationId: `stub_donation_${Date.now()}`, receiptUrl: null };
  }

  // Example real call shape:
  // const res = await fetch("https://partners.every.org/v0.2/donations", {
  //   method: "POST",
  //   headers: { Authorization: `Bearer ${EVERY_ORG_API_KEY}`, "Content-Type": "application/json" },
  //   body: JSON.stringify({ ein, amountCents, donorUserId }),
  // });
  // const data = await res.json();
  // return { success: res.ok, donationId: data.id, receiptUrl: data.receiptUrl };

  throw new Error("sendToOrg: real API integration not yet implemented");
}

module.exports = { chargeCard, sendToOrg };
