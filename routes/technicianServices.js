import { Router } from "express";
import { ObjectId } from "mongodb";
import { col } from "../config/db.js";
import { verifyToken, verifyTechnician } from "../middleware/auth.js";
import { CATEGORIES, MODES } from "../utils/constants.js";

const router = Router();
const guard = [verifyToken, verifyTechnician];
const fields = [
  "title", "category", "description", "image", "estimatedDuration", "serviceMode", "serviceArea",
];

// keep only allowed fields and validate them
function clean(body) {
  const data = Object.fromEntries(fields.map((f) => [f, String(body[f] ?? "").trim()]));
  data.basePrice = Number(body.basePrice);
  const ok =
    fields.every((f) => data[f]) &&
    data.basePrice > 0 &&
    CATEGORIES.includes(data.category) &&
    MODES.includes(data.serviceMode);
  return ok ? data : null;
}

// loads the service and makes sure the logged-in technician owns it
async function ownService(req, res) {
  const { id } = req.params;
  const service = ObjectId.isValid(id) && (await col("services").findOne({ _id: new ObjectId(id) }));
  if (!service) {
    res.status(404).json({ message: "Service not found" });
    return null;
  }
  if (service.technicianEmail !== req.user.email) {
    res.status(403).json({ message: "Forbidden" });
    return null;
  }
  return service;
}

// GET /api/services/mine
router.get("/mine", guard, async (req, res) => {
  const list = col("services").find({ technicianEmail: req.user.email }).sort({ createdAt: -1 });
  res.json(await list.toArray());
});

// POST /api/services
router.post("/", guard, async (req, res) => {
  const data = clean(req.body);
  if (!data) return res.status(400).json({ message: "Please fill all fields correctly" });

  const service = {
    ...data,
    technicianName: req.user.name,
    technicianEmail: req.user.email,
    approvalStatus: "pending",
    isAvailable: true,
    createdAt: new Date(),
  };
  const result = await col("services").insertOne(service);
  res.status(201).json({ ...service, _id: result.insertedId });
});

// PATCH /api/services/:id   (editing sends it back to pending)
router.patch("/:id", guard, async (req, res) => {
  const service = await ownService(req, res);
  if (!service) return;
  const data = clean(req.body);
  if (!data) return res.status(400).json({ message: "Please fill all fields correctly" });

  await col("services").updateOne({ _id: service._id }, { $set: { ...data, approvalStatus: "pending" } });
  res.json({ message: "Service updated and sent for approval again" });
});

// PATCH /api/services/:id/availability
router.patch("/:id/availability", guard, async (req, res) => {
  const service = await ownService(req, res);
  if (!service) return;
  await col("services").updateOne({ _id: service._id }, { $set: { isAvailable: Boolean(req.body.isAvailable) } });
  res.json({ message: "Availability updated" });
});

// DELETE /api/services/:id
router.delete("/:id", guard, async (req, res) => {
  const service = await ownService(req, res);
  if (!service) return;
  await col("services").deleteOne({ _id: service._id });
  res.json({ message: "Service deleted" });
});

export default router;
