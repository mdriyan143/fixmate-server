import { Router } from "express";
import { col } from "../config/db.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

// PATCH /api/users/profile   (role and email can never change here)
router.patch("/profile", verifyToken, async (req, res) => {
  const { name, phone, area, bio, image } = req.body;
  if (!String(name || "").trim()) return res.status(400).json({ message: "Name is required" });

  const set = {
    name: String(name).trim(),
    phone: String(phone || "").trim(),
    area: String(area || "").trim(),
    bio: String(bio || "").trim(),
    updatedAt: new Date(),
  };
  if (image) set.image = String(image);

  await col("users").updateOne({ email: req.user.email }, { $set: set });
  res.json({ message: "Profile updated" });
});

export default router;
