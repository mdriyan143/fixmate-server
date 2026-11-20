import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import services from "./routes/services.js";
import bookings from "./routes/bookings.js";
import checkout from "./routes/checkout.js";
import payments from "./routes/payments.js";
import webhook from "./routes/webhook.js";
import technicianServices from "./routes/technicianServices.js";
import jobs from "./routes/jobs.js";
import users from "./routes/users.js";
import admin from "./routes/admin.js";


const app = express();
app.use(cors({ origin: process.env.CLIENT_URL.split(","), credentials: true }));
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), webhook);
app.use(express.json());

app.get("/", (req, res) => res.send("FixMate server is running"));

app.use("/api/services", technicianServices); 

app.use("/api/services", services);
app.use("/api/bookings", bookings);
app.use("/api/payments", checkout);
app.use("/api/payments", payments);
app.use("/api/bookings", jobs);
app.use("/api/users", users);



app.use("/api/admin", admin);
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

const port = process.env.PORT || 5000;
connectDB().then(() => app.listen(port, () => console.log(`Server running on port ${port}`)));
