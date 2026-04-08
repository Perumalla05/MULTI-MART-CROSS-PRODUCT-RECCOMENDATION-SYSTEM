
# 🛒 Real-Time Multi-Platform E-Commerce Price Aggregation System

## 📌 Overview

This project is a real-time price comparison system that aggregates product data from multiple Indian e-commerce platforms into a single unified interface. It enables users to search for products across platforms like Amazon, Flipkart, Myntra, Ajio, Zepto, and more, helping them find the best price, offers, and delivery options efficiently.

The system uses advanced web scraping techniques, API interception, and location-aware processing to deliver accurate and real-time results. 

---

## 🎯 Features

* 🔍 Unified product search across multiple platforms
* ⚡ Real-time price aggregation and comparison
* 📍 GPS-based hyperlocal grocery recommendations
* 🧠 Hybrid scraping (Playwright + API + interception)
* 💸 Displays offers, discounts, cashback, and ratings
* 🚚 Shows delivery time estimates for quick-commerce
* 📊 Fast response with caching support

---

## 🏗 Architecture

The project follows a **three-tier architecture**:

* **Frontend** → React-based user interface
* **Backend** → Node.js + Express API server
* **Scraping Layer** → Multi-platform scraping engine

### 🔄 Workflow

1. User enters product query (and optional location)
2. Request is sent to backend API
3. Cache is checked for existing results
4. Scrapers fetch data from multiple platforms
5. Data is normalized into a standard format
6. Aggregated results are returned to frontend

---

## 🛠 Tech Stack

* **Frontend:** React.js, Vite
* **Backend:** Node.js, Express.js
* **Scraping:** Playwright, Fetch APIs
* **Database/Cache:** Redis (optional), SQLite/PostgreSQL
* **Other Tools:** Nominatim API, Winston Logger

---

## 📂 Project Structure

```id="r8a2p1"
Ecommerce-Price-Aggregator/
│── frontend/          # React UI
│── backend/           # Express server
│── scrapers/          # Platform-specific scrapers
│── services/          # Orchestrator, caching, utilities
│── models/            # Data schema
│── config/            # Environment configs
│── package.json       # Dependencies
│── README.md
```

---

## 🗄 Database Design

The system uses:

* **Redis Cache** → Stores results with TTL (15 mins)
* **SQLite/PostgreSQL (optional)** → Stores search history

### Data Schema Includes:

* Product title
* Price & MRP
* Discount percentage
* Offers & cashback
* Ratings & reviews
* Delivery time

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the repository

```bash
git clone https://github.com/your-username/ecommerce-price-aggregator.git
cd ecommerce-price-aggregator
```

### 2️⃣ Install dependencies

```bash
npm install
```

### 3️⃣ Setup environment variables

Create a `.env` file:

```
PORT=3000
REDIS_URL=your_redis_url (optional)
```

### 4️⃣ Run backend server

```bash
npm start
```

### 5️⃣ Run frontend

```bash
cd frontend
npm install
npm run dev
```

### 6️⃣ Open in browser

```
http://localhost:5173
```

---

## 🔐 Key Concepts

* **Hybrid Scraping Architecture**

  * Playwright for dynamic sites
  * Direct API calls for fast retrieval
  * API interception for hidden data

* **Anti-Bot Handling**

  * User-Agent spoofing
  * Client hints injection

* **Location-Aware System**

  * GPS → Pincode conversion
  * Hyperlocal grocery results

---

## 🚀 Future Enhancements

* 📱 Mobile application integration
* ⚡ Distributed scraping (scalability)
* 🧠 AI-based price prediction
* 🔔 Price drop alerts
* 🛍 Direct purchase redirection

---

## 📌 Conclusion

This system provides an efficient and scalable solution to compare prices across multiple Indian e-commerce platforms in real time. It reduces user effort, improves decision-making, and demonstrates advanced concepts like web scraping, system design, and real-time data processing. 



Just tell me 👍
