import { ObjectId } from "mongodb";
import { col } from "../config/db.js";

// used by BOTH the success page and the webhook, and safe to call many times
export async function savePayment(session) {
  if (session.payment_status !== "paid") return null;
  const bookingId = session.metadata?.bookingId;
  if (!bookingId || !ObjectId.isValid(bookingId)) return null;

  const booking = await col("bookings").findOne({ _id: new ObjectId(bookingId) });
  if (!booking) return null;

  // already saved (by the other path or a Stripe retry)? just return it
  const old = await col("payments").findOne({ bookingId: String(booking._id) });
  if (old) return old;

  const payment = {
    bookingId: String(booking._id),
    serviceTitle: booking.serviceTitle,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    technicianName: booking.technicianName,
    technicianEmail: booking.technicianEmail,
    amount: session.amount_total / 100,
    currency: "usd",
    transactionId: session.payment_intent,
    stripeSessionId: session.id,
    paymentStatus: "paid",
    paidAt: new Date(),
  };

  try {
    await col("payments").insertOne(payment);
  } catch (err) {
    if (err.code !== 11000) throw err; // 11000 = duplicate, the unique index did its job
  }

  // "unpaid" is in the filter, so "paid" is added to the history only the first time
  await col("bookings").updateOne(
    { _id: booking._id, paymentStatus: "unpaid" },
    {
      $set: { paymentStatus: "paid" },
      $push: { statusHistory: { status: "paid", changedAt: new Date() } },
    }
  );
 return col("payments").findOne({ bookingId: String(booking._id) });
}