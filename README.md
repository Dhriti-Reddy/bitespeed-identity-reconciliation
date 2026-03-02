# Bitespeed Identity Reconciliation Task

This is a backend service developed for the Bitespeed technical challenge. It consolidates multiple contact entries (email/phone) into a single linked identity.

## 🚀 Live Endpoint
**POST** `https://bitespeed-identity-reconciliation-ui6y.onrender.com`

## 🛠️ Tech Stack
* **Language:** TypeScript
* **Server Framework:** Express.js
* **ORM:** Prisma
* **Database:** SQLite (local/self-contained)

## 📋 API Usage
The endpoint accepts a JSON body with `email` and `phoneNumber`.

**Request Body:**
```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}