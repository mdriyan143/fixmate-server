import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI);
let db;

export async function connectDB() {
  await client.connect();
  db = client.db(process.env.DB_NAME);
  // one payment per Stripe session, and one payment per booking
  await db.collection("payments").createIndex({ stripeSessionId: 1 }, { unique: true });
  await db.collection("payments").createIndex({ bookingId: 1 }, { unique: true });
  console.log("MongoDB connected");
}

// short helper: col("services") gives the services collection
export const col = (name) => db.collection(name);