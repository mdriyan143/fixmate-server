import { Router } from "express";
import { ObjectId } from "mongodb";
import { col } from "../config/db.js";
import { verifyToken, verifyTechnician } from "../middleware/auth.js";

const router = Router();
const guard = [verifyToken, verifyTechnician];

// the ONLY allowed moves; everything else is rejected
const flow = {
  requested: ["accepted", "rejected"],
  accepted: ["in-progress"],
  "in-progress": ["completed"],
};

// GET /api/bookings/technician?status=
router.get("/technician", guard, async (req, res) => {
  const query = { technicianEmail: req.user.email };
  if (req.query.status) query.status = String(req.query.status);
  const list = col("bookings").find(query).sort({ createdAt: -1 });
  res.json(await list.toArray());
});

// PATCH /api/bookings/:id/status
router.patch("/:id/status", guard, async (req, res) => {
  const { id } = req.params;
  const { status, finalAmount } = req.body;
  if (!ObjectId.isValid(id)) return res.status(404).json({ message: "Booking not found" });

  const booking = await col("bookings").findOne({ _id: new ObjectId(id) });
  if (!booking) return res.status(404).json({ message: "Booking not found" });
  if (booking.technicianEmail !== req.user.email) return res.status(403).json({ message: "Forbidden" });

  if (!flow[booking.status]?.includes(status)) {
    return res.status(400).json({ message: `Cannot change ${booking.status} to ${status}` });
  }

  const set = { status };
  if (status === "completed") {
    const amount = Number(finalAmount);
    if (!(amount > 0)) return res.status(400).json({ message: "Final amount must be greater than 0" });
    set.finalAmount = amount;
  }

  // the filter includes the old status, so two quick clicks cannot both succeed
  // $push adds the new status and the time to the history list
  const result = await col("bookings").updateOne(
    { _id: booking._id, status: booking.status },
    { $set: set, $push: { statusHistory: { status, changedAt: new Date() } } }
  );
  if (!result.matchedCount) return res.status(409).json({ message: "Status was already changed" });
  res.json({ message: "Status updated" });
});

export default router;