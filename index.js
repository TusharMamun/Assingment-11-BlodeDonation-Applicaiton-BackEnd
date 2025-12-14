const express = require("express");

const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express();
const stripe = require("stripe")(process.env.STRIP_SECRET_KEY);
const admin = require("firebase-admin");
const serviceAccount =require("./firabaseSkd.json")
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});


// middleware
app.use(cors());
app.use(express.json());
// Validation MIdelwer


const VerifyFbToken=async(req,res,next)=>{

const token =req.headers.authorization
if(!token){
  return res.status(401).send({ message: "Unauthorized access"})
}
try {
const idToken = token.split(' ')[1];
const decoded = await admin.auth().verifyIdToken(idToken)
req.decoded_email = decoded.email
console.log(decoded)
} catch (error) {
  return res.status(401).send({message:"Unauthorized access"})
}





next()
}










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
app.post("/CreatedBloadDonation", async (req, res) => {
  try {
    const data = req.body || {};

    const requiredFields = [
      "requesterName",
      "requesterEmail",
      "recipientName",
      "recipientDistrict",
      "recipientUpazila",
      "hospitalName",
      "fullAddress",
      "bloodGroup",
      "donationDate",
      "donationTime",
      "requestMessage",
    ];

    const missing = requiredFields.filter((f) => !String(data[f] || "").trim());
    if (missing.length) {
      return res.status(400).send({
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    if (String(data.requestMessage).trim().length < 10) {
      return res.status(400).send({ message: "Write at least 10 characters" });
    }

    const allowedBloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
    if (!allowedBloodGroups.includes(String(data.bloodGroup).trim())) {
      return res.status(400).send({ message: "Invalid blood group" });
    }

    // ✅ normalize email
    const email = String(data.requesterEmail || "").trim().toLowerCase();

    // ✅ case-insensitive find user
    const user = await allRegisteredDonorInfoCollection.findOne({
      email: { $regex: `^${email}$`, $options: "i" },
    });

    if (!user) {
      return res.status(404).send({
        message: "User not found. Please register first.",
      });
    }

    // ✅ blocked user can’t create request
    if (String(user?.status || "active").toLowerCase() === "blocked") {
      return res.status(403).send({
        message: "Blocked user is not able to create any donation request",
      });
    }

    const doc = {
      requesterName: String(data.requesterName).trim(),
      requesterEmail: email,
      recipientName: String(data.recipientName).trim(),
      recipientDistrict: String(data.recipientDistrict).trim(),
      recipientUpazila: String(data.recipientUpazila).trim(),
      hospitalName: String(data.hospitalName).trim(),
      fullAddress: String(data.fullAddress).trim(),
      bloodGroup: String(data.bloodGroup).trim(),
      donationDate: String(data.donationDate).trim(),
      donationTime: String(data.donationTime).trim(),
      requestMessage: String(data.requestMessage).trim(),
      status: "pending",
      createdAt: new Date(),
    };

    const result = await AllblodDonationRequest.insertOne(doc);

    res.send({
      success: true,
      message: "Donation request created successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Create donation request error:", error);
    res.status(500).send({ message: "Server error", error: error.message });
  }
});




// get All request data  FOR PENDIN REQUEST
app.get("/donation-requests",VerifyFbToken, async (req, res) => {
// console.log(req.headers)
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

app.get("/blood-donation-requests",VerifyFbToken, async (req, res) => {
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

app.get("/blood-donation-requests-details/:id",VerifyFbToken, async (req, res) => {
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


app.post('/regesterDoner',async(req,res)=>{
const userInfo = req.body;
const result = await allRegisteredDonorInfoCollection.insertOne(userInfo)
res.send(result)
})
// get all  user
app.get("/regesterDoner",VerifyFbToken, async (req, res) => {
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








app.get('/profile/:email',VerifyFbToken, async(req,res)=>{
  const email = req.params.email

  const result =await allRegisteredDonorInfoCollection.findOne({email})
res.send(result)
})




app.put("/update/profile", VerifyFbToken,async (req, res) => {
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

// Mydonation for my donation page


app.get("/donation-requests/:id", async (req, res) => {
  try {
    const doc = await AllblodDonationRequest.findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return res.status(404).send({ message: "Request not found" });
    res.send(doc);
  } catch (error) {
    res.status(500).send({ message: "Server error", error: error.message });
  }
});





app.get("/my-blood-donation-requests",VerifyFbToken, async (req, res) => {
  try {
    const { email, status = "pending", search = "", page = 1, limit = 10 } = req.query;
    if (!email) return res.status(400).send({ message: "email is required" });
if (email !== req.decoded_email) {
  return res.status(403).send({
    message: "Forbidden access: You are not allowed to access this resource.",
  });
}
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const query = { requesterEmail: String(email).toLowerCase() };

    if (status && status !== "all") query.status = String(status).toLowerCase();

    const q = String(search).trim();
    if (q) {
      query.$or = [
        { recipientName: { $regex: q, $options: "i" } },
        { hospitalName: { $regex: q, $options: "i" } },
        { recipientDistrict: { $regex: q, $options: "i" } },
        { recipientUpazila: { $regex: q, $options: "i" } },
        { bloodGroup: { $regex: q, $options: "i" } },
      ];
    }

    const total = await AllblodDonationRequest.countDocuments(query);

    const result = await AllblodDonationRequest
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    res.send({
      result,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (error) {
    res.status(500).send({ message: "Server error", error: error.message });
  }
});
app.get("/donation-requests/:id",VerifyFbToken, async (req, res) => {
  try {
    const doc = await AllblodDonationRequest.findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return res.status(404).send({ message: "Request not found" });
    res.send(doc);
  } catch (error) {
    res.status(500).send({ message: "Server error", error: error.message });
  }
});
app.patch("/my-blood-donation-requests/:id", VerifyFbToken, async (req, res) => {
  try {
    const { email } = req.query;

    // ✅ 1) email required
    if (!email) {
      return res.status(400).send({ message: "email is required" });
    }

    // ✅ 2) token email must match query email
    if (String(email).toLowerCase() !== String(req.decoded_email).toLowerCase()) {
      return res.status(403).send({
        message: "Forbidden access: You are not allowed to access this resource.",
      });
    }

    const { id } = req.params;

    // ✅ 3) validate id
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid request ID" });
    }

    // ✅ 4) find existing
    const existing = await AllblodDonationRequest.findOne({ _id: new ObjectId(id) });
    if (!existing) {
      return res.status(404).send({ message: "Request not found" });
    }

    // ✅ 5) ensure owner
    if (
      String(existing.requesterEmail || "").toLowerCase() !==
      String(email).toLowerCase()
    ) {
      return res.status(403).send({ message: "Forbidden: Not allowed" });
    }

    // ✅ 6) only pending can edit
    if (String(existing.status || "").toLowerCase() !== "pending") {
      return res.status(400).send({ message: "Only pending requests can be edited" });
    }

    // ✅ 7) update fields
    const b = req.body || {};
    const updateDoc = {
      $set: {
        recipientName: b.recipientName,
        recipientDistrict: b.recipientDistrict,
        recipientUpazila: b.recipientUpazila,
        hospitalName: b.hospitalName,
        fullAddress: b.fullAddress,
        bloodGroup: b.bloodGroup,
        donationDate: b.donationDate,
        donationTime: b.donationTime,
        requestMessage: b.requestMessage,
        updatedAt: new Date(),
      },
    };

    const result = await AllblodDonationRequest.updateOne(
      { _id: new ObjectId(id) },
      updateDoc
    );

    res.send({ success: true, result });
  } catch (error) {
    console.error("PATCH /my-blood-donation-requests/:id error:", error);
    res.status(500).send({ message: "Server error", error: error.message });
  }
});

app.delete("/my-blood-donation-requests/:id", VerifyFbToken, async (req, res) => {
  try {
    const { email } = req.query;
    const { id } = req.params;

    // 1) email required
    if (!email) {
      return res.status(400).send({ message: "email is required" });
    }

    // 2) token email must match query email
    if (String(email).toLowerCase() !== String(req.decoded_email).toLowerCase()) {
      return res.status(403).send({
        message: "Forbidden access: You are not allowed to access this resource.",
      });
    }

    // 3) validate id
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid request ID" });
    }

    // 4) find existing request
    const query = { _id: new ObjectId(id) };
    const existing = await AllblodDonationRequest.findOne(query);

    if (!existing) {
      return res.status(404).send({ message: "Request not found" });
    }

    // 5) ensure owner
    if (
      String(existing.requesterEmail || "").toLowerCase() !==
      String(email).toLowerCase()
    ) {
      return res.status(403).send({ message: "Forbidden: Not allowed" });
    }

    // 6) only pending can delete
    if (String(existing.status || "").toLowerCase() !== "pending") {
      return res.status(400).send({ message: "Only pending requests can be deleted" });
    }

    // 7) delete
    const result = await AllblodDonationRequest.deleteOne(query);

    res.send({ success: true, result });
  } catch (error) {
    console.error("DELETE /my-blood-donation-requests/:id error:", error);
    res.status(500).send({ message: "Server error", error: error.message });
  }
});





app.get("/blood-donation-requests",VerifyFbToken, async (req, res) => {
  try {
    const {
      status = "",
      bloodGroup = "",
      search = "",
      page = "1",
      limit = "10",
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    // ✅ status filter
    if (status) filter.status = status;

    // ✅ blood filter
    if (bloodGroup) filter.bloodGroup = bloodGroup;

    // ✅ search (regex)
    if (search) {
      const rx = new RegExp(search, "i");
      filter.$or = [
        { requesterName: rx },
        { requesterEmail: rx },
        { recipientName: rx },
        { recipientDistrict: rx },
        { recipientUpazila: rx },
        { hospitalName: rx },
      ];
    }

    const total = await AllblodDonationRequest.countDocuments(filter);

    const result = await AllblodDonationRequest
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const totalPages = Math.max(Math.ceil(total / limitNum), 1);

    res.send({ result, total, page: pageNum, totalPages });
  } catch (error) {
    console.error("GET /blood-donation-requests error:", error);
    res.status(500).send({ message: "Server error", error: error.message });
  }
});

/* ==========================
   PATCH: /blood-donation-requests/:id/status
   Admin Only (no middleware)
   Header must have: x-user-email
   Body: { status: "done" | "cancelled" }
   Rule: only if current status === "inprogress"
========================== */
app.patch("/blood-donation-requests/:id/status",VerifyFbToken, async (req, res) => {
  try {
    const { id } = req.params;
    const rawStatus = req.body?.status;

    // ✅ read admin email from header
    const email = req.headers["x-user-email"];
    if (!email) {
      return res.status(401).send({
        success: false,
        message: "Unauthorized: missing x-user-email header",
      });
    }

    // ✅ verify admin from DB
    const adminUser = await allRegisteredDonorInfoCollection.findOne({ email });
    if (!adminUser) {
      return res.status(401).send({
        success: false,
        message: "Unauthorized: user not found",
      });
    }

    if (adminUser.role !== "admin") {
      return res.status(403).send({
        success: false,
        message: "Forbidden: only admin can update status",
      });
    }

    // ✅ validate id
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid request ID",
      });
    }

    // ✅ validate status
    const nextStatus = String(rawStatus || "").trim().toLowerCase();
    const allowed = ["done", "cancelled"];
    if (!allowed.includes(nextStatus)) {
      return res.status(400).send({
        success: false,
        message: "Invalid status. Allowed: done, cancelled",
      });
    }

    const query = { _id: new ObjectId(id) };

    // ✅ find request
    const request = await AllblodDonationRequest.findOne(query);
    if (!request) {
      return res.status(404).send({
        success: false,
        message: "Blood donation request not found",
      });
    }

    // ✅ rule: only inprogress -> done/cancelled
    if (request.status !== "inprogress") {
      return res.status(400).send({
        success: false,
        message: "Only inprogress requests can be marked done/cancelled",
      });
    }

    const updateDoc = {
      $set: {
        status: nextStatus,
        updatedAt: new Date(),
        updatedBy: email,
      },
    };

    if (nextStatus === "done") updateDoc.$set.completedAt = new Date();
    if (nextStatus === "cancelled") updateDoc.$set.cancelledAt = new Date();

    const result = await AllblodDonationRequest.updateOne(query, updateDoc);

    if (result.matchedCount === 0) {
      return res.status(404).send({
        success: false,
        message: "Request not found",
      });
    }

    const updatedRequest = await AllblodDonationRequest.findOne(query);

    return res.send({
      success: true,
      message: `Request ${nextStatus} successfully`,
      request: updatedRequest,
    });
  } catch (error) {
    console.error("PATCH /blood-donation-requests/:id/status error:", error);
    res.status(500).send({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});


app.patch("/blood-donation-requests-updateData/:id", VerifyFbToken, async (req, res) => {
  try {
    const email = req.decoded_email;
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid request ID" });
    }

    const existing = await AllblodDonationRequest.findOne({ _id: new ObjectId(id) });
    if (!existing) {
      return res.status(404).send({ message: "Request not found" });
    }

    if (String(existing.requesterEmail || "").toLowerCase() !== email) {
      return res.status(403).send({ message: "Forbidden: Not allowed" });
    }

    if (String(existing.status || "").toLowerCase() !== "pending") {
      return res.status(400).send({ message: "Only pending requests can be edited" });
    }

    const b = req.body || {};

    const requiredFields = [
      "recipientName",
      "recipientDistrict",
      "recipientUpazila",
      "hospitalName",
      "fullAddress",
      "bloodGroup",
      "donationDate",
      "donationTime",
      "requestMessage",
    ];

    const missing = requiredFields.filter((f) => !String(b[f] || "").trim());
    if (missing.length) {
      return res.status(400).send({
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    const allowedBloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
    if (!allowedBloodGroups.includes(String(b.bloodGroup).trim())) {
      return res.status(400).send({ message: "Invalid blood group" });
    }

    if (String(b.requestMessage).trim().length < 10) {
      return res.status(400).send({ message: "Write at least 10 characters" });
    }

    const updateDoc = {
      $set: {
        requesterEmail: email, // enforce from token
        requesterName: String(b.requesterName || existing.requesterName || "").trim(),
        recipientName: String(b.recipientName).trim(),
        recipientDistrict: String(b.recipientDistrict).trim(),
        recipientUpazila: String(b.recipientUpazila).trim(),
        hospitalName: String(b.hospitalName).trim(),
        fullAddress: String(b.fullAddress).trim(),
        bloodGroup: String(b.bloodGroup).trim(),
        donationDate: String(b.donationDate).trim(),
        donationTime: String(b.donationTime).trim(),
        requestMessage: String(b.requestMessage).trim(),
        updatedAt: new Date(),
      },
    };

    const result = await AllblodDonationRequest.updateOne(
      { _id: new ObjectId(id) },
      updateDoc
    );

    res.send({ success: true, result });
  } catch (error) {
    console.error("PATCH /blood-donation-requests-updateData/:id error:", error);
    res.status(500).send({ message: "Server error", error: error.message });
  }
});















app.get("/latest-3-my-blood-donation-requests",VerifyFbToken, async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).send({ message: "email is required" });

    const result = await AllblodDonationRequest
      .find({ requesterEmail: String(email).toLowerCase() })
      .sort({ createdAt: -1 })
      .limit(3)
      .toArray();

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Server error", error: error.message });
  }
});

app.get("/my-blood-donation-requests",VerifyFbToken, async (req, res) => {
  try {
    const { email, status = "pending", search = "", page = 1, limit = 10 } = req.query;
    if (!email) return res.status(400).send({ message: "email is required" });
     
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const query = { requesterEmail: String(email).toLowerCase() };

    if (status && status !== "all") query.status = status;

    const q = String(search).trim();
    if (q) {
      query.$or = [
        { recipientName: { $regex: q, $options: "i" } },
        { hospitalName: { $regex: q, $options: "i" } },
        { recipientDistrict: { $regex: q, $options: "i" } },
        { recipientUpazila: { $regex: q, $options: "i" } },
        { bloodGroup: { $regex: q, $options: "i" } },
      ];
    }

    const total = await AllblodDonationRequest.countDocuments(query);

    const result = await AllblodDonationRequest
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    res.send({
      result,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (error) {
    res.status(500).send({ message: "Server error", error: error.message });
  }
});


app.get("/donation-requests/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await AllblodDonationRequest.findOne({ _id: new ObjectId(id) });
    if (!doc) return res.status(404).send({ message: "Request not found" });
    res.send(doc);
  } catch (error) {
    res.status(500).send({ message: "Server error", error: error.message });
  }
});
app.patch("/my-blood-donation-requests/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { email } = req.query;
    if (!email) return res.status(400).send({ message: "email is required" });

    const existing = await AllblodDonationRequest.findOne({ _id: new ObjectId(id) });
    if (!existing) return res.status(404).send({ message: "Request not found" });

    if (String(existing.requesterEmail).toLowerCase() !== String(email).toLowerCase()) {
      return res.status(403).send({ message: "Not allowed" });
    }

    if (String(existing.status).toLowerCase() !== "pending") {
      return res.status(400).send({ message: "Only pending requests can be edited" });
    }

    const body = req.body || {};
    const updateDoc = {
      $set: {
        recipientName: body.recipientName,
        recipientDistrict: body.recipientDistrict,
        recipientUpazila: body.recipientUpazila,
        hospitalName: body.hospitalName,
        fullAddress: body.fullAddress,
        bloodGroup: body.bloodGroup,
        donationDate: body.donationDate,
        donationTime: body.donationTime,
        requestMessage: body.requestMessage,
        updatedAt: new Date(),
      },
    };

    const result = await AllblodDonationRequest.updateOne(
      { _id: new ObjectId(id) },
      updateDoc
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Server error", error: error.message });
  }
});
app.delete("/my-blood-donation-requests/:id",VerifyFbToken, async (req, res) => {
  try {
    const id = req.params.id;
    const { email } = req.query;
    if (!email) return res.status(400).send({ message: "email is required" });

    const existing = await AllblodDonationRequest.findOne({ _id: new ObjectId(id) });
    if (!existing) return res.status(404).send({ message: "Request not found" });

    if (String(existing.requesterEmail).toLowerCase() !== String(email).toLowerCase()) {
      return res.status(403).send({ message: "Not allowed" });
    }

    if (String(existing.status).toLowerCase() !== "pending") {
      return res.status(400).send({ message: "Only pending requests can be deleted" });
    }

    const result = await AllblodDonationRequest.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Server error", error: error.message });
  }
});
app.patch("/my-blood-donation-requests/:id/status", async (req, res) => {
  try {
    const id = req.params.id;
    const { email } = req.query;
    const { status } = req.body;

    if (!email) return res.status(400).send({ message: "email is required" });
    if (!status) return res.status(400).send({ message: "status is required" });

    const next = String(status).toLowerCase();
    const allowed = ["pending", "inprogress", "done", "canceled"];
    if (!allowed.includes(next)) {
      return res.status(400).send({ message: "Invalid status" });
    }

    const existing = await AllblodDonationRequest.findOne({ _id: new ObjectId(id) });
    if (!existing) return res.status(404).send({ message: "Request not found" });

    // owner check
    if (String(existing.requesterEmail).toLowerCase() !== String(email).toLowerCase()) {
      return res.status(403).send({ message: "Not allowed" });
    }

    const current = String(existing.status || "").toLowerCase();

    // ✅ rules: from inprogress -> done/canceled only
    if (current !== "inprogress") {
      return res.status(400).send({ message: "Only inprogress requests can change status" });
    }

    if (!(next === "done" || next === "canceled")) {
      return res.status(400).send({ message: "Inprogress can only become done or canceled" });
    }

    const result = await AllblodDonationRequest.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: next, updatedAt: new Date() } }
    );

    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Server error", error: error.message });
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