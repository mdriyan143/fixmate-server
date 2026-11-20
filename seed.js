import "dotenv/config";
import { connectDB, col } from "./config/db.js";

// the client (BetterAuth) must be running at AUTH_URL, because users are created through it
const AUTH = process.env.AUTH_URL;
const PASSWORD = "Fixmate123";
const images = {
  "Smartphone": "/services/smartphone.svg",
  "Laptop & PC": "/services/laptop.svg",
  "AC": "/services/ac.svg",
  "Refrigerator": "/services/refrigerator.svg",
  "TV": "/services/tv.svg",
  "Washing Machine": "/services/washing-machine.svg",
  "Electrical": "/services/electrical.svg",
};
const img = (category) => images[category];;

const people = [
  { name: "FixMate Admin", email: "admin@fixmate.com", role: "admin", area: "Dhaka", bio: "Platform admin" },
  { name: "Rafiq Hasan", email: "rafiq@fixmate.com", role: "technician", area: "Mirpur, Dhaka", bio: "8 years fixing phones and laptops." },
  { name: "Sabbir Ahmed", email: "sabbir@fixmate.com", role: "technician", area: "Dhanmondi, Dhaka", bio: "AC, fridge and washing machine expert." },
  { name: "Nusrat Jahan", email: "customer@fixmate.com", role: "customer", area: "Uttara, Dhaka", bio: "" },
];

// [title, category, price, duration, mode, technician index in people]
const list = [
  ["iPhone Screen Replacement", "Smartphone", 85, "2-3 hours", "Shop Drop-off", 1],
  ["Android Battery Replacement", "Smartphone", 25, "1 hour", "Shop Drop-off", 1],
  ["Laptop Full Servicing", "Laptop & PC", 30, "1 day", "Shop Drop-off", 1],
  ["Laptop Screen Repair", "Laptop & PC", 70, "1-2 days", "Shop Drop-off", 1],
  ["AC Gas Refill & Cleaning", "AC", 40, "2 hours", "Home Visit", 2],
  ["Split AC Installation", "AC", 55, "3 hours", "Home Visit", 2],
  ["Refrigerator Compressor Repair", "Refrigerator", 60, "1 day", "Home Visit", 2],
  ["Fridge Not Cooling Fix", "Refrigerator", 35, "3 hours", "Home Visit", 2],
  ["LED TV Panel Repair", "TV", 75, "2 days", "Shop Drop-off", 1],
  ["Smart TV Software Fix", "TV", 20, "1 hour", "Home Visit", 1],
  ["Washing Machine Motor Repair", "Washing Machine", 50, "1 day", "Home Visit", 2],
  ["Washing Machine Drain Fix", "Washing Machine", 28, "2 hours", "Home Visit", 2],
  ["House Electrical Wiring", "Electrical", 45, "1 day", "Home Visit", 1],
  ["Circuit Breaker Replacement", "Electrical", 22, "1 hour", "Home Visit", 2],
];

await connectDB();

for (const p of people) {
  // sign up through BetterAuth (it hashes the password); errors for existing users are fine
  await fetch(`${AUTH}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: AUTH },
    body: JSON.stringify({ name: p.name, email: p.email, password: PASSWORD }),
  });
  // admin cannot be created from sign-up, so roles are set straight in the database
  await col("users").updateOne({ email: p.email }, { $set: { role: p.role, area: p.area, bio: p.bio } });
}

await col("services").deleteMany({});
await col("bookings").deleteMany({});
await col("payments").deleteMany({});

const services = list.map(([title, category, basePrice, estimatedDuration, serviceMode, t], i) => ({
  title,
  category,
  description: `${title} by a verified technician. Genuine parts, quick diagnosis and a tested device before delivery.`,
  image: img(category),
  basePrice,
  estimatedDuration,
  serviceMode,
  serviceArea: people[t].area,
  technicianName: people[t].name,
  technicianEmail: people[t].email,
  approvalStatus: "approved",
  isAvailable: true,
  createdAt: new Date(Date.now() - i * 3600 * 1000),
}));
const { insertedIds } = await col("services").insertMany(services);

// a few bookings in different statuses for the demo customer
const customer = people[3];
const make = (i, status, extra = {}) => {
  const s = services[i];
  return {
    serviceId: String(insertedIds[i]),
    serviceTitle: s.title,
    serviceImage: s.image,
    category: s.category,
    basePrice: s.basePrice,
    technicianName: s.technicianName,
    technicianEmail: s.technicianEmail,
    customerName: customer.name,
    customerEmail: customer.email,
    customerPhone: "01700000000",
    address: "House 12, Road 5, Uttara, Dhaka",
    preferredDate: new Date(Date.now() + 2 * 86400000),
    problemDescription: "The device stopped working yesterday and needs a proper check.",
    status,
    finalAmount: s.basePrice,
    paymentStatus: "unpaid",
    createdAt: new Date(),
    ...extra,
  };
};
const bookings = [
  make(0, "requested"),
  make(4, "accepted"),
  make(2, "in-progress"),
  make(6, "completed", { finalAmount: 65 }),
  make(8, "rejected"),
  make(10, "completed", { finalAmount: 50, paymentStatus: "paid" }),
];
const done = await col("bookings").insertMany(bookings);

const paid = bookings[5];
await col("payments").insertOne({
  bookingId: String(done.insertedIds[5]),
  serviceTitle: paid.serviceTitle,
  customerName: paid.customerName,
  customerEmail: paid.customerEmail,
  technicianName: paid.technicianName,
  technicianEmail: paid.technicianEmail,
  amount: 50,
  currency: "usd",
  transactionId: "pi_seed_demo_1",
  stripeSessionId: "cs_seed_demo_1",
  paymentStatus: "paid",
  paidAt: new Date(),
});

console.log("Seed done. Password for all demo accounts:", PASSWORD);
process.exit(0);
