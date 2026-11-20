import { Router } from "express";
import { col } from "../config/db.js";
import { stripe } from "../config/stripe.js";
import { verifyToken, verifyCustomer } from "../middleware/auth.js";
import { savePayment } from "../utils/savePayment.js";

const router = Router();
const guard = [verifyToken, verifyCustomer];

// GET /api/payments/verify?session_id=...   (called by the success page)
router.get("/verify", guard, async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(String(req.query.session_id));
    if (session.metadata?.customerEmail !== req.user.email) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const payment = await savePayment(session);
    if (!payment) return res.status(400).json({ message: "Payment is not completed" });
    res.json(payment);
  } catch {
    res.status(400).json({ message: "Could not verify this payment" });
  }
});

// GET /api/payments/my   (payment history)
router.get("/my", guard, async (req, res) => {
  const list = col("payments").find({ customerEmail: req.user.email }).sort({ paidAt: -1 });
  res.json(await list.toArray());
});

export default router;
