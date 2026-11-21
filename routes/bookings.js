import { Router } from "express";
import { ObjectId } from "mongodb";
import { col } from "../config/db.js";
import { verifyToken, verifyCustomer } from "../middleware/auth.js";
import { ACTIVE } from "../utils/constants.js";

const router = Router();
const guard = [verifyToken, verifyCustomer];

// POST /api/bookings   (customer sends a repair request)
router.post("/", guard, async (req, res) => {
  const { serviceId, customerPhone, address, preferredDate, problemDescription } = req.body;
  const phone = String(customerPhone || "").trim();
  const place = String(address || "").trim();
  const problem = String(problemDescription || "").trim();
  const date = new Date(preferredDate);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (
    !ObjectId.isValid(serviceId) ||
    !phone || phone.length > 20 ||
    !place || place.length > 200 ||
    isNaN(date) ||
    date < today ||
    problem.length < 20 || problem.length > 1000
  ) {
    return res.status(400).json({ message: "Please fill the form correctly (problem needs 20+ characters)" });
  }

  const service = await col("services").findOne({
    _id: new ObjectId(serviceId),
    approvalStatus: "approved",
    isAvailable: true,
  });
  if (!service) return res.status(404).json({ message: "Service not found" });
  if (service.technicianEmail === req.user.email) {
    return res.status(403).json({ message: "You cannot request your own service" });
  }

  const active = await col("bookings").findOne({
    serviceId: String(service._id),
    customerEmail: req.user.email,
    status: { $in: ACTIVE },
  });
  if (active) return res.status(409).json({ message: "You already have an active request for this service" });

  const booking = {
    serviceId: String(service._id),
    serviceTitle: service.title,
    serviceImage: service.image,
    category: service.category,
    basePrice: service.basePrice,
    technicianName: service.technicianName,
    technicianEmail: service.technicianEmail,
    customerName: req.user.name,
    customerEmail: req.user.email,
    customerPhone: phone,
    address: place,
    preferredDate: date,
    problemDescription: problem,
    status: "requested",
    finalAmount: service.basePrice,
    paymentStatus: "unpaid",
    statusHistory: [{ status: "requested", changedAt: new Date() }],
    createdAt: new Date(),
  };

  let result;
  try {
    result = await col("bookings").insertOne(booking);
  } catch (err) {
    // 11000 = the database found a second active request (two quick clicks)
    if (err.code === 11000) {
      return res.status(409).json({ message: "You already have an active request for this service" });
    }
    throw err;
  }
  res.status(201).json({ ...booking, _id: result.insertedId });
});

// GET /api/bookings/my   (only my own bookings)
router.get("/my", guard, async (req, res) => {
  const list = col("bookings").find({ customerEmail: req.user.email }).sort({ createdAt: -1 });
  res.json(await list.toArray());
});

// PATCH /api/bookings/:id/cancel   (only while still "requested")
router.patch("/:id/cancel", guard, async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) return res.status(404).json({ message: "Booking not found" });

  const result = await col("bookings").updateOne(
    { _id: new ObjectId(id), customerEmail: req.user.email, status: "requested" },
    {
      $set: { status: "cancelled" },
      $push: { statusHistory: { status: "cancelled", changedAt: new Date() } },
    }
  );
  if (!result.matchedCount) {
    return res.status(400).json({ message: "Only your own requested bookings can be cancelled" });
  }
  res.json({ message: "Booking cancelled" });
});

// PATCH /api/bookings/:id/review   (own PAID booking, only once)
router.patch("/:id/review", guard, async (req, res) => {
  const { id } = req.params;
  const rating = Number(req.body.rating);
  const review = String(req.body.review || "").trim();

  if (!ObjectId.isValid(id)) return res.status(404).json({ message: "Booking not found" });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: "Rating must be from 1 to 5" });
  }
  if (review.length > 500) return res.status(400).json({ message: "Review is too long (max 500 characters)" });

  // the filter checks everything: my booking, already paid, and no rating yet
  const result = await col("bookings").updateOne(
    { _id: new ObjectId(id), customerEmail: req.user.email, paymentStatus: "paid", rating: { $exists: false } },
    { $set: { rating, review, reviewedAt: new Date() } }
  );
  if (!result.matchedCount) {
    return res.status(400).json({ message: "Only your own paid booking can be reviewed, once" });
  }
  res.json({ message: "Thanks for your review" });
});

export default router;
