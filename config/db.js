import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
let db;
let ready;

async function init() {
  await client.connect();
  db = client.db(process.env.DB_NAME);

  // one payment per Stripe session, and one payment per booking
  await db.collection("payments").createIndex({ stripeSessionId: 1 }, { unique: true });
  await db.collection("payments").createIndex({ bookingId: 1 }, { unique: true });

  // faster queries. A problem here must never stop the server, so each one has its own try/catch
  const speedIndexes = [
    ["bookings", { customerEmail: 1, createdAt: -1 }],
    ["bookings", { technicianEmail: 1, createdAt: -1 }],
    ["services", { approvalStatus: 1, isAvailable: 1, createdAt: -1 }],
    ["services", { technicianEmail: 1 }],
  ];
  for (const [name, keys] of speedIndexes) {
    try {
      await db.collection(name).createIndex(keys);
    } catch (err) {
      console.warn(`Index warning (${name}):`, err.message);
    }
  }

  // one ACTIVE request per customer and service (the database itself blocks double clicks)
  try {
    await db.collection("bookings").createIndex(
      { serviceId: 1, customerEmail: 1 },
      {
        unique: true,
        partialFilterExpression: { status: { $in: ["requested", "accepted", "in-progress"] } },
      }
    );
  } catch (err) {
    console.warn("Active-request index not created (the code check still works):", err.message);
  }

  console.log("MongoDB connected");
}

// safe to call many times: it connects only once
export function connectDB() {
  ready ??= init().catch((err) => {
    ready = undefined; // allow a retry on the next call
    throw err;
  });
  return ready;
}

// short helper: col("services") gives the services collection
export const col = (name) => db.collection(name);
