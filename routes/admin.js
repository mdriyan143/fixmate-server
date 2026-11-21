import { Router } from "express";
import { ObjectId } from "mongodb";
import { col } from "../config/db.js";
import { verifyToken, verifyAdmin } from "../middleware/auth.js";

const router = Router();
router.use(verifyToken, verifyAdmin); // everything under /api/admin is admin-only

const byStatus = (key) => (req) => (req.query.status ? { [key]: String(req.query.status) } : {});

router.get("/users", async (req, res) => {
  res.json(
    await col("users")
      .find({}, { projection: { name: 1, email: 1, image: 1, role: 1, createdAt: 1 } })
      .sort({ createdAt: -1 })
      .toArray()
  );
});

router.patch("/users/:id/role", async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!ObjectId.isValid(id)) return res.status(404).json({ message: "User not found" });
  if (!["customer", "technician", "admin"].includes(role)) return res.status(400).json({ message: "Invalid role" });
  if (id === req.user.id) return res.status(400).json({ message: "You cannot change your own role" });

  const result = await col("users").updateOne({ _id: new ObjectId(id) }, { $set: { role } });
  // matchedCount 0 = no user has this id
  if (!result.matchedCount) return res.status(404).json({ message: "User not found" });
  res.json({ message: "Role updated" });
});

router.get("/services", async (req, res) => {
  res.json(await col("services").find(byStatus("approvalStatus")(req)).sort({ createdAt: -1 }).toArray());
});

router.patch("/services/:id/approval", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!ObjectId.isValid(id)) return res.status(404).json({ message: "Service not found" });
  if (!["approved", "rejected"].includes(status)) return res.status(400).json({ message: "Invalid status" });

  const result = await col("services").updateOne({ _id: new ObjectId(id) }, { $set: { approvalStatus: status } });
  if (!result.matchedCount) return res.status(404).json({ message: "Service not found" });
  res.json({ message: `Service ${status}` });
});

router.get("/bookings", async (req, res) => {
  res.json(await col("bookings").find(byStatus("status")(req)).sort({ createdAt: -1 }).toArray());
});

router.get("/payments", async (req, res) => {
  res.json(await col("payments").find().sort({ paidAt: -1 }).toArray());
});

export default router;
