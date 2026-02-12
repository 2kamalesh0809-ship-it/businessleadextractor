# Promptix - Google Maps Lead Extractor

A powerful, full-stack lead generation tool that extracts business data from Google Maps using SerpApi.

## 🚀 Overview

Promptix is designed for sales teams and marketers to quickly build business datasets. It features a modern, dark-themed dashboard, real-time lead extraction, and advanced export capabilities (CSV, Excel, PDF) tailored to different subscription plans.

## 📦 Project Structure

```text
D:\a2\
├── google-maps-lead-backend/    # Node.js/Express API
│   ├── config/                 # Database & Plan configurations
│   ├── controllers/            # Request handling logic
│   ├── models/                 # MongoDB Schemas (User, History, etc.)
│   ├── services/               # SerpApi & Third-party integrations
│   └── .env                    # Environment variables (API Keys)
└── google-maps-lead-frontend/   # Vanilla HTML/CSS/JS
    ├── index.html              # Main Dashboard
    ├── pricing.html            # Subscription management
    ├── script.js               # Frontend logic & API calls
    └── style.css               # Premium SaaS UI styles
```

## ✨ Key Features

- **High-Volume Extraction**: Fetches 50+ leads in a single search using multi-page pagination.
- **Smart Offset**: Automatically skips previously extracted leads to ensure you always get fresh data.
- **Plan-Based Limits**: 
  - **Free/Starter**: CSV Export Only.
  - **Pro**: CSV, Excel, and Professional PDF Reports.
- **Credit System**: Integrated credit deduction (1 credit per successful search).
- **Modern UI**: Fully responsive, dark-mode first design with glassmorphism effects.

## 🛠️ Quick Start

### 1. Backend Setup
1. `cd google-maps-lead-backend`
2. `npm install`
3. Create/edit `.env` with your `SERPAPI_KEY` and `MONGODB_URI`.
4. `npm start` (Runs on `http://localhost:5000`)

### 2. Frontend Setup
1. Open `google-maps-lead-frontend/index.html` in your browser.
2. (Optional) Run with a Live Server for better performance.

## 📄 Documentation
For detailed developer instructions, architecture deep dives, and modification guides, please refer to:
- [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) - Full technical documentation.
