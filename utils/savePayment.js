import { ObjectId } from "mongodb";
import { col } from "../config/db.js";

// used by BOTH the success page and the webhook, and safe to call many times
export async function savePayment(session) {
  if (session.payment_status !== "paid") return null;
  const bookingId = session.metadata?.bookingId;
  if (!bookingId || !ObjectId.isValid(bookingId)) return null;

  const booking = await col("bookings").findOne({ _id: new ObjectId(bookingId) });
  if (!booking) return null;

    // reuse an existing payment, or insert a new one
  let payment = await col("payments").findOne({ bookingId: String(booking._id) });

  if (!payment) {
    payment = {
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
      if (err.code !== 11000) throw err; // duplicate: another request saved it first
    }
  }

  // ALWAYS runs, so a half-finished earlier attempt gets repaired.
  // "unpaid" in the filter means "paid" is added to the history only once.
  await col("bookings").updateOne(
    { _id: booking._id, paymentStatus: "unpaid" },
    {
      $set: { paymentStatus: "paid" },
      $push: { statusHistory: { status: "paid", changedAt: new Date() } },
    }
  );

  return col("payments").findOne({ bookingId: String(booking._id) });
}