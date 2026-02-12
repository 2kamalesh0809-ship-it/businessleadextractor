# Developer Guide & Project Documentation

This document provides in-depth technical details for developers who wish to maintain or extend the Promptix Google Maps Lead Extractor.

## 🏗️ Technical Architecture

The project follows a decoupled Frontend/Backend architecture:
- **Frontend**: Single Page Application (SPA) style using Vanilla JavaScript, HTML5, and CSS3.
- **Backend**: Node.js REST API with Express, using MongoDB Atlas for persistence and SerpApi for data sourcing.

### 🔌 API Flow (Search Process)

1.  **Frontend**: User submits the search form in `index.html`.
2.  **Frontend**: `script.js` sends a POST request to `/api/search/outscraper` with `keyword`, `location`, and `limit`.
3.  **Backend**: `scrapeController.js` validates credentials and deducts 1 credit from the `User` model.
4.  **Backend**: `scrapeController.js` queries the `SearchHistory` collection to find the total results already extracted for this user/query.
5.  **Backend**: `serpApiService.js` is called with the calculated `startOffset` and `limit`.
6.  **Backend**: A loop in `serpApiService.js` fetches multiple pages from SerpApi (20 per page) and concatenates them.
7.  **Backend**: Results are saved to `SearchHistory` and returned to the frontend.
8.  **Frontend**: `script.js` renders the data into the leads table and enables export buttons.

## 🛠️ Key Maintenance Areas

### 1. Adding New Pricing Plans
- **Backend**: Update `google-maps-lead-backend/config/plans.js` to define the new plan name, price, and credits.
- **Frontend**: Add a new plan card in `google-maps-lead-frontend/pricing.html` and update the `currentUserPlan` logic in `script.js` if there are new feature-based restrictions.

### 2. Modifying Export Formats
- The export logic is handled in `script.js` inside the `downloadData()` and `generatePDF()` functions.
- To add a new format (e.g., JSON), add a button to `index.html` and a new case in the `downloadData()` switch in `script.js`.

### 3. Normalization Logic
- All searches are normalized to lowercase in `scrapeController.js` before being queried or saved. This prevents "Gym" and "gym" from being treated as different searches.
- If you change the source of truth for location names, ensure normalization is maintained.

## 🧩 Database Models (Mongoose)

- **User**: Stores username, hashed password, current credits, and active plan.
- **SearchHistory**: Tracks every successful search per user, including the keyword, location, and the count of results obtained (used for pagination offset).
- **UsageLog**: A general log for credit deductions.
- **Payment**: Tracks Razorpay transactions.

## 🔒 Security
- **JWT**: Authentication is handled via JSON Web Tokens stored in `localStorage` on the frontend.
- **Environment Variables**: Never commit `.env` to version control. It contains the `SERPAPI_KEY` and MongoDB connection string.

## 📈 Future Expansion Ideas
- **Email Crawler**: Currently, email extraction is a placeholder (`N/A`). You can integrate a third-party email finder API inside the `serpApiService.js` mapping logic.
- **Team Accounts**: The "Team Collaboration" feature mentioned in the Pro plan can be implemented by adding a `teamId` field to the `User` model.
- **Scheduled Scrapes**: Use `node-cron` to allow users to schedule automatic weekly lead refreshes.

---
*Created by Antigravity (Advanced Agentic Coding Team)*
