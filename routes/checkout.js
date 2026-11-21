import { Router } from "express";
import { ObjectId } from "mongodb";
import { col } from "../config/db.js";
import { stripe } from "../config/stripe.js";
import { verifyToken, verifyCustomer } from "../middleware/auth.js";
import { MAIN_CLIENT } from "../utils/urls.js";
import { savePayment } from "../utils/savePayment.js";


const router = Router();

// POST /api/payments/create-checkout-session
router.post("/create-checkout-session", verifyToken, verifyCustomer, async (req, res) => {
  const { bookingId } = req.body;
  if (!ObjectId.isValid(bookingId)) return res.status(400).json({ message: "Invalid booking" });

  // amount comes from the database, never from the client
  const booking = await col("bookings").findOne({
    _id: new ObjectId(bookingId),
    customerEmail: req.user.email,
  });
  if (!booking) return res.status(404).json({ message: "Booking not found" });
  if (booking.status !== "completed" || booking.paymentStatus !== "unpaid") {
    return res.status(400).json({ message: "Only completed and unpaid jobs can be paid" });
  }

  if (booking.checkoutSessionId) {
  try {
    const old = await stripe.checkout.sessions.retrieve(booking.checkoutSessionId);
    if (old.status === "open") return res.json({ url: old.url });
    if (old.payment_status === "paid") {
      await savePayment(old);
      return res.status(400).json({ message: "This booking is already paid" });
    }
  } catch {
    // old session not found, create a new one below
  }
}

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: booking.customerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(booking.finalAmount * 100),
          product_data: { name: booking.serviceTitle },
        },
      },
    ],
    metadata: { bookingId: String(booking._id), customerEmail: booking.customerEmail },
    success_url: `${MAIN_CLIENT}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${MAIN_CLIENT}/payment/cancel`,
  });
  await col("bookings").updateOne(
  { _id: booking._id },
  { $set: { checkoutSessionId: session.id } }
);
  res.json({ url: session.url });
});

export default router;
