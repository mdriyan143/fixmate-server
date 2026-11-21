import { Router } from "express";
import { col } from "../config/db.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

// PATCH /api/users/profile   (role and email can never change here)
router.patch("/profile", verifyToken, async (req, res) => {
  const { name, phone, area, bio, image } = req.body;
  const clean = {
    name: String(name || "").trim(),
    phone: String(phone || "").trim(),
    area: String(area || "").trim(),
    bio: String(bio || "").trim(),
  };

  if (!clean.name) return res.status(400).json({ message: "Name is required" });
  if (clean.name.length > 80 || clean.phone.length > 20 || clean.area.length > 100 || clean.bio.length > 500) {
    return res.status(400).json({ message: "One of the fields is too long" });
  }

  const set = { ...clean, updatedAt: new Date() };
  if (image) {
    // the photo must be a web link (ImgBB), nothing else
    if (!/^https?:\/\//.test(String(image)) || String(image).length > 500) {
      return res.status(400).json({ message: "Invalid image link" });
    }
    set.image = String(image);
  }

  await col("users").updateOne({ email: req.user.email }, { $set: set });
  res.json({ message: "Profile updated" });
});

export default router;
