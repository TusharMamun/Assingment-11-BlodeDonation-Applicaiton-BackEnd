# 🩸 Blood Donation Application — Backend (Express + MongoDB)

Backend API for the **Blood Donation Application**.  
This server provides secure endpoints for **authentication (Firebase token verify)**, **role-based access (Admin/Volunteer/Donor)**, **blood donation request management**, and **funding/payment (Stripe)**.

---

## 🔗 Live Server
- **API Base URL:** `https://YOUR-SERVER-URL.com`
- **Health Check:** `GET /health`

---

## 🎯 Key Features
- ✅ Firebase Admin **ID Token verification** middleware (`VerifyFbToken`)
- ✅ **Role based access control** (Admin check middleware `VeryfyAdmin`)
- ✅ Blood donation request flow:
  - `pending → inprogress → done / canceled(cancelled)`
- ✅ Donor request management:
  - Create request (blocked users cannot create)
  - View details
  - Update/Delete only when `pending`
  - Status change only when `inprogress`
- ✅ Admin/Volunteer request management:
  - View all requests with filters + pagination
  - Update request status (admin/volunteer only)
- ✅ User management:
  - Register donor
  - Get role
  - List users with pagination + search + status filter
  - Update role (admin only)
  - Block/unblock users
- ✅ Funding module (Stripe Checkout):
  - Create checkout session
  - Save payment after success (duplicate protected by `sessionId`)
  - Donor can view own fundings & total
  - Admin can view all fundings with pagination + search + total sum
- ✅ Analytics endpoint for admin/volunteer:
  - donation request status summary

---

## 🧰 Tech Stack
- Node.js
- Express.js
- MongoDB (Native Driver)
- Firebase Admin SDK
- Stripe
- dotenv, cors

---

## 📦 NPM Packages Used
```bash
express cors dotenv mongodb stripe firebase-admin