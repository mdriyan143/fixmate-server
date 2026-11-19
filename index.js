import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL.split(","), credentials: true }));
app.use(express.json());

app.get("/", (req, res) => res.send("FixMate server is running"));

const port = process.env.PORT || 5000;
connectDB().then(() => app.listen(port, () => console.log(`Server running on port ${port}`)));
