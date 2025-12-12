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
 allRegisteredDonorInfo Api
app.post('/regesterDoner',async(req,res)=>{
const userInfo = req.body;
const result = await allRegisteredDonorInfoCollection.insertOne(userInfo)
res.send(result)
})
// get all  user
app.get("/regesterDoner", async (req, res) => {
  try {
    const { status = "all", search = "", page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const query = {};

    if (status !== "all") query.status = status;

    if (search?.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { email: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const total = await allRegisteredDonorInfoCollection.countDocuments(query);

    const result = await allRegisteredDonorInfoCollection
      .find(query)
      .sort({ _id: -1 }) // ✅ newest first (show first)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .toArray();

    res.send({
      result,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    res.status(500).send({ message: "Server error", error: error.message });
  }
});
// Creat Blood donatio request 
app.post('/CreatedBloadDonation',async(req,res)=>{
const RequestedInfo = req.body;
const result = await AllblodDonationRequest.insertOne(RequestedInfo)
res.send(result)   
})
// app.get('/all-dontionrequest',async(req,res)=>{

// })
app.get("/my-blood-donation-requests", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).send({ message: "email is required" });
    }

    const result = await AllblodDonationRequest
      .find({ 
requesterEmail:email })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Server error", error: error.message });
  }
});


app.patch("/blood-donation-requests-updateData/:id", async (req, res) => {
  const { id } = req.params;

  const {
    requesterName,
    requesterEmail,
    recipientName,
    recipientDistrict,
    recipientUpazila,
    hospitalName,
    fullAddress,
    bloodGroup,
    donationDate,
    donationTime,
    requestMessage,
    // status  // 👈 not needed if your form doesn't send it
  } = req.body;

  try {
    // Basic validation (optional but good)
    if (
      !requesterName ||
      !requesterEmail ||
      !recipientName ||
      !recipientDistrict ||
      !recipientUpazila ||
      !hospitalName ||
      !fullAddress ||
      !bloodGroup ||
      !donationDate ||
      !donationTime ||
      !requestMessage
    ) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided" });
    }

    const filter = { _id: new ObjectId(id) };

    const updateDoc = {
      $set: {
        requesterName,
        requesterEmail,
        recipientName,
        recipientDistrict,  // 👈 district name (you mapped from id in frontend)
        recipientUpazila,
        hospitalName,
        fullAddress,
        bloodGroup,
        donationDate,       // string date (e.g. "2025-12-10")
        donationTime,       // string time (e.g. "14:30")
        requestMessage,
        updatedAt: new Date(),
        // ❌ no status here -> existing status in DB stays same
      },
    };

    const result = await AllblodDonationRequest.updateOne(
      filter,
      updateDoc
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Request not found" });
    }

    const updatedRequest = await AllblodDonationRequest.findOne(
      filter
    );

    return res.json({
      message: "Blood donation request updated successfully",
      request: updatedRequest,
    });
  } catch (err) {
    console.error("Error updating blood donation request:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});
app.patch('/my-blood-donation-requests-to-processing/:id', async (req, res) => {
  const id = req.params.id;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid request ID' });
  }

  try {

    const result = await AllblodDonationRequest
      .updateOne(
        { _id: new ObjectId(id), status: 'inprogress' }, // only update if status is 'inprogress'
        { $set: { status: 'pending', updatedAt: new Date() } }
      );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Request not found or not in progress' });
    }

    res.status(200).json({ message: 'Status updated to pending' });
  } catch (error) {
    console.error('Error updating request status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
app.patch("/blood-donation-requests/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const allowedStatuses = ["done", "cancelled"]; 

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const filter = { _id: new ObjectId(id) };
    const updateDoc = { $set: { status, updatedAt: new Date() } };

    const result = await AllblodDonationRequest.updateOne(
      filter,
      updateDoc
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Request not found" });
    }

    const updatedRequest = await AllblodDonationRequest.findOne(filter);

    return res.json({
      message: "Blood donation request status updated successfully",
      request: updatedRequest,
    });
  } catch (err) {
    console.error("Error updating blood donation request status:", err);
    return res.status(500).json({ message: "Internal server error" });
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
