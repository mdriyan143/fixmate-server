import { Router } from "express";
import { ObjectId } from "mongodb";
import { col } from "../config/db.js";

const router = Router();
const sorts = {
  "price-asc": { basePrice: 1 },
  "price-desc": { basePrice: -1 },
  newest: { createdAt: -1 },
};

// GET /api/services?search=&category=&mode=&sort=&limit=   (public)
router.get("/", async (req, res) => {
  const { search, category, mode, sort, limit } = req.query;
  const query = { approvalStatus: "approved", isAvailable: true };

  if (category) query.category = String(category);
  if (mode) query.serviceMode = String(mode);
  if (search) {
    const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");
    query.$or = [{ title: rx }, { category: rx }];
  }

  let cursor = col("services").find(query).sort(sorts[sort] || sorts.newest);
  if (Number(limit) > 0) cursor = cursor.limit(Number(limit));
  res.json(await cursor.toArray());
});

// GET /api/services/:id   (public, only approved + available)
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) return res.status(404).json({ message: "Service not found" });

  const service = await col("services").findOne({
    _id: new ObjectId(id),
    approvalStatus: "approved",
    isAvailable: true,
  });
  if (!service) return res.status(404).json({ message: "Service not found" });

  const technician = await col("users").findOne(
    { email: service.technicianEmail },
    { projection: { name: 1, image: 1, area: 1, bio: 1 } }
  );
  res.json({ ...service, technician });
});

export default router;
