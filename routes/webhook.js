import { stripe } from "../config/stripe.js";
import { savePayment } from "../utils/savePayment.js";

// needs the RAW body, so index.js mounts it before express.json()
export default async function webhook(req, res) {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") await savePayment(event.data.object);
  res.json({ received: true });
}
