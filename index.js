// index.js
const express = require("express");

const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express();
const stripe = require("stripe")(process.env.STRIP_SECRET_KEY);
// middleware
app.use(cors());
app.use(express.json());

// veryfy medialwel
// const verifyFirebaseToken = async (req, res, next) => {
//   const authHeader = req.headers.authorization; // <-- correct way to read header
//   console.log(authHeader)

//   if (!authHeader) {
//     return res.status(401).send({ message: "unauthorized access" });
//   }

//   const token = authHeader.split(" ")[1]; // "Bearer TOKEN"

//   try {
//     const decoded = await admin.auth().verifyIdToken(token);
//     req.user = decoded;   // optional: save decoded info
//     next();
//   } catch (err) {
//     return res.status(403).send({ message: "invalid token" });
//   }
// };









// data base Connection with mondodb
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@mongodb-digitalshop.vq7pmww.mongodb.net/?appName=Mongodb-DigitalShop`;

// / Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
const db = client.db("Blood_Donation_Application_DB")
// All colleciton of mongodb
const allRegisteredDonorInfoCollection = db.collection("allRegisteredDonorInfo")
const AllblodDonationRequest = db.collection("BlodeDonationRequest")

// allRegisteredDonorInfo Api
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







// Creat  request Data
app.post('/CreatedBloadDonation',async(req,res)=>{
const RequestedInfo = req.body;
const result = await AllblodDonationRequest.insertOne(RequestedInfo)
res.send(result)   
})
app.get('/all-dontionrequest',async(req,res)=>{

})



// get All request data  FOR PENDIN REQUEST
app.get("/donation-requests", async (req, res) => {
  try {
    const { status } = req.query;

    const query = {};
    if (status) query.status = status; // pending/approved/done/cancelled

    const result = await AllblodDonationRequest
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Server error", error: error.message });
  }
});

app.get("/blood-donation-requests", async (req, res) => {
  try {
    const { status, bloodGroup, search, page = 1, limit = 10 } = req.query;

    const query = {};
    if (status) query.status = status;
    if (bloodGroup) query.bloodGroup = bloodGroup;

    if (search) {
      query.$or = [
        { patientName: { $regex: search, $options: "i" } },
        { hospitalName: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const [result, total] = await Promise.all([
      AllblodDonationRequest.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .toArray(),
      AllblodDonationRequest.countDocuments(query),
    ]);

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

// Get Donattion details page
const { ObjectId } = require("mongodb");

app.get("/blood-donation-requests-details/:id", async (req, res) => {
  try {
    const result = await AllblodDonationRequest.findOne({
      _id: new ObjectId(req.params.id), // ✅ Correct param name
    });

    if (!result) {
      return res.status(404).send({ message: "Request not found" });
    }

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Server error" });
  }
});






// my requests 
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






// allRegisteredDonorInfo Api
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
// ============================
// ✅ MY DONATION REQUESTS (Donor)
// GET /my-blood-donation-requests?email=...&status=all&page=1&limit=10&search=...
// ============================
app.get("/my-blood-donation-requests", async (req, res) => {
  try {
    const { email, status = "all", search = "", page = 1, limit = 10 } = req.query;

    if (!email) return res.status(400).send({ message: "email is required" });

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const query = { requesterEmail: email };

    // ✅ status filter
    if (status !== "all") query.status = status; // pending|inprogress|done|canceled

    // ✅ search
    if (search?.trim()) {
      const s = search.trim();
      query.$or = [
        { patientName: { $regex: s, $options: "i" } },
        { hospitalName: { $regex: s, $options: "i" } },
        { location: { $regex: s, $options: "i" } },
        { bloodGroup: { $regex: s, $options: "i" } },
        { phone: { $regex: s, $options: "i" } },
      ];
    }

    const total = await AllblodDonationRequest.countDocuments(query);

    const result = await AllblodDonationRequest
      .find(query)
      .sort({ createdAt: -1 }) // newest first
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

// ============================
// ✅ DELETE MY DONATION REQUEST (Donor)
// DELETE /my-blood-donation-requests/:id?email=user@email.com
// ============================


// GET: My donation requests
app.get("/my-blood-donation-requests", async (req, res) => {
  try {
    const { email, status = "all", search = "", page = 1, limit = 10 } = req.query;

    if (!email) return res.status(400).send({ message: "email is required" });

    const query = { requesterEmail: email };

    if (status !== "all") query.status = status;

    const q = search.trim();
    if (q) {
      query.$or = [
        { recipientName: { $regex: q, $options: "i" } },
        { hospitalName: { $regex: q, $options: "i" } },
        { recipientDistrict: { $regex: q, $options: "i" } },
        { recipientUpazila: { $regex: q, $options: "i" } },
        { fullAddress: { $regex: q, $options: "i" } },
        { bloodGroup: { $regex: q, $options: "i" } },
        { status: { $regex: q, $options: "i" } },
      ];
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const total = await AllblodDonationRequest.countDocuments(query);

    const result = await AllblodDonationRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum); // ✅ mongoose returns array

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



// DELETE: only owner can delete (ownership by requesterEmail)
app.delete("/my-blood-donation-requests/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await AllblodDonationRequest.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({ message: "Donation request not found" });
    }

    res.send({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).send({ message: "Server error", error: error.message });
  }
});
// update stutus
app.patch("/update-status/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) return res.status(400).send({ message: "status is required" });

    const result = await AllblodDonationRequest.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: "Request not found" });
    }

    res.send({ success: true, result });
  } catch (error) {
    res.status(500).send({ message: "Server error", error: error.message });
  }
});








app.get('/profile/:email', async(req,res)=>{
  const email = req.params.email
  const result =await allRegisteredDonorInfoCollection.findOne({email})
res.send(result)
})




app.put("/update/profile", async (req, res) => {
  try {
    const { email, name, district, upazila, photoUrl } = req.body;

    if (!email) {
      return res.status(400).send({ message: "email is required" });
    }

    const filter = { email };

    const updateDoc = {
      $set: {
        email,
        name,
        district,
        upazila,
        photoUrl: photoUrl,
        updatedAt: new Date(),
      },
    };

    const result = await allRegisteredDonorInfoCollection.updateOne(
      filter,
      updateDoc,
      { upsert: true }
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Server error", error: error.message });
  }
});




// getUserRoll 


app.get('/regesterDoner/role/:email', async(req,res)=>{
  const email = req.params.email
  const result =await allRegisteredDonorInfoCollection.findOne({email})
res.send(({role:result?.role}))
})
// all user rool and stutus Change



app.patch("/users/:id/role", async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body; // donor | volunteer | admin

    if (!["donor", "volunteer", "admin"].includes(role)) {
      return res.status(400).send({ message: "Invalid role" });
    }

    const result = await allRegisteredDonorInfoCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { role } }
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Server error", error: error.message });
  }
});
app.patch("/users/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const allowedStatuses = ["active", "blocked"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: { status },
    };

    const result = await allRegisteredDonorInfoCollection.updateOne(
      filter,
      updateDoc
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Optional: return the updated document
    const updatedUser = await allRegisteredDonorInfoCollection.findOne(filter);

    return res.json({
      message: "User status updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Error updating user status:", err);
    return res.status(500).json({ message: "Internal server error" });
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







    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error

  }
}
run().catch(console.dir);







// routes
app.get("/", (req, res) => {
  res.send("Blood Donation API running ✅");
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// example POST route (test)
app.post("/echo", (req, res) => {
  res.json({ received: req.body });
});


app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});