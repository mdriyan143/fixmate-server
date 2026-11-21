import { Router } from "express";
import { ObjectId } from "mongodb";
import { col } from "../config/db.js";

const router = Router();
const sorts = {
  "price-asc": { basePrice: 1 },
  "price-desc": { basePrice: -1 },
  newest: { createdAt: -1 },
};

// adds avgRating and reviewCount to each service in the list
async function withRatings(list) {
  const ids = list.map((s) => String(s._id));

  // groups all rated bookings by service and calculates the average
  const stats = await col("bookings")
    .aggregate([
      { $match: { serviceId: { $in: ids }, rating: { $exists: true } } },
      { $group: { _id: "$serviceId", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ])
    .toArray();

  const byService = Object.fromEntries(stats.map((x) => [x._id, x]));
  return list.map((s) => ({
    ...s,
    avgRating: byService[String(s._id)]?.avg ?? 0,
    reviewCount: byService[String(s._id)]?.count ?? 0,
  }));
}

// GET /api/services?search=&category=&mode=&sort=&limit=&page=   (public)
router.get("/", async (req, res) => {
  const { search, category, mode, sort, limit, page } = req.query;
  const query = { approvalStatus: "approved", isAvailable: true };

  if (category) query.category = String(category);
  if (mode) query.serviceMode = String(mode);
  if (search) {
    const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");
    query.$or = [{ title: rx }, { category: rx }];
  }

  let cursor = col("services").find(query).sort(sorts[sort] || sorts.newest);

  // paged list, used by /services:  ?page=1, ?page=2 ...
  if (page) {
    const perPage = 8;
    const pageNo = Math.max(parseInt(page) || 1, 1);
    const total = await col("services").countDocuments(query);
    const items = await withRatings(await cursor.skip((pageNo - 1) * perPage).limit(perPage).toArray());
    return res.json({ items, total, pages: Math.ceil(total / perPage) });
  }

  // plain list, used by the home page (?limit=6)
  if (Number(limit) > 0) cursor = cursor.limit(Number(limit));
  res.json(await withRatings(await cursor.toArray()));
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
  const [rated] = await withRatings([service]);
  res.json({ ...rated, technician });
});

export default router;