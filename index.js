// index.js (basic MongoDB integration only)
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@mongodb-digitalshop.vq7pmww.mongodb.net/?appName=Mongodb-DigitalShop`;

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function run() {
  try {
    await client.connect();
    console.log("✅ MongoDB connected");

    // ✅ Your DB
    const db = client.db("Blood_Donation_Application_DB");

    // ✅ Your collections
    const allRegisteredDonorInfoCollection = db.collection("allRegisteredDonorInfo");
    const AllblodDonationRequest = db.collection("BlodeDonationRequest");

app.post("/create-checkout-session", async (req, res) => {
    try {
      const { name = "Anonymous", email, amount } = req.body;

      const parsedAmount = Number(amount);
      if (!email) return res.status(400).json({ message: "Email is required" });
      if (!Number.isFinite(parsedAmount) || parsedAmount < 1) {
        return res.status(400).json({ message: "Amount must be at least 1" });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: email,
        line_items: [
          {
            price_data: {
              currency: "usd", // change to "bdt" if needed
              product_data: { name: "Funding / Donation" },
              unit_amount: Math.round(parsedAmount * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          donor_name: name,
          donor_email: email,
          amount_display: String(parsedAmount),
        },
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancel`,
      });

      res.status(200).json({ url: session.url });
    } catch (err) {
      console.error("Stripe error:", err);
      res.status(500).json({ message: err?.message || "Failed to create session" });
    }
  });

  // ✅ Verify session (GET) -> used by PaymentSuccess page
  app.get("/checkout-session/:sessionId", async (req, res) => {
    try {
      const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);

  res.send({
      id: session.id,                         // cs_test_...
      payment_intent: session.payment_intent, // ✅ pi_...
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
      customer_email: session.customer_email,
      metadata: session.metadata,
    });
    } catch (err) {
      console.error("Stripe retrieve session error:", err);
      res.status(500).send({ message: err?.message || "Failed to retrieve session" });
    }
  });

  // ✅ Optional: mark payment success (PATCH) for DB update
  app.patch("/payment-success", async (req, res) => {
    try {
      const sessionId = req.query.session_id;
      if (!sessionId) return res.status(400).send({ message: "session_id required" });

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status !== "paid") {
        return res.status(400).send({ message: "Payment not completed yet" });
      }

   

      res.send({ success: true });
    } catch (err) {
      console.error("Payment success patch error:", err);
      res.status(500).send({ message: err?.message || "Server error" });
    }
  });





    // optional ping
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Ping success");


  } finally {
    // do not close client for server apps
  }
}
run().catch(console.dir);

app.get("/", (req, res) => res.send("Server running ✅"));

app.listen(port, () => console.log(`🚀 Server running on port ${port}`));
