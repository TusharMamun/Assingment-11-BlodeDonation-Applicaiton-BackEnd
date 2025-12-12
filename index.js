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
