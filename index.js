import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import { CLIENT_ORIGINS } from "./utils/urls.js";
import services from "./routes/services.js";
import bookings from "./routes/bookings.js";
import checkout from "./routes/checkout.js";
import payments from "./routes/payments.js";
import webhook from "./routes/webhook.js";
import technicianServices from "./routes/technicianServices.js";
import jobs from "./routes/jobs.js";
import users from "./routes/users.js";
import admin from "./routes/admin.js";

if (CLIENT_ORIGINS.length === 0) console.warn("WARNING: CLIENT_URL is empty, browsers will get CORS errors");

const app = express();
app.use(cors({ origin: CLIENT_ORIGINS, credentials: true }));

// make sure MongoDB is connected before any route runs (also needed on serverless hosts)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

app.post("/api/payments/webhook", express.raw({ type: "application/json" }), webhook);
app.use(express.json({ limit: "100kb" }));

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

// any error thrown inside a route lands here and is sent as JSON, never as an HTML page
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: status < 500 ? err.message : "Server error. Please try again.",
  });
});

const port = process.env.PORT || 5000;
// normal hosts (Render, Railway, your PC) start a server. Vercel runs the exported app instead
if (!process.env.VERCEL) {
  connectDB()
    .then(() => app.listen(port, () => console.log(`Server running on port ${port}`)))
    .catch((err) => {
      console.error("Could not start the server:", err.message);
      process.exit(1);
    });
}

export default app;
