# Milano Cafe - Premium Digital Menu Setup Guide

This repository contains the complete codebase for **Milano Cafe**, a modern, luxury-tier digital QR menu website featuring a secure Admin Dashboard, Cloudflare Worker API, and Cloudflare KV Caching.

---

## 📁 Project Structure

```text
/milano
├── index.html          # Public premium digital menu webpage
├── admin.html          # Admin dashboard for menu management
├── logo.jpeg           # Milano Cafe Logo
├── css/
│   └── style.css       # Custom luxurious styling (Charcoal, Gold, Cream)
├── js/
│   ├── firebase.js     # Firebase SDK initialization
│   ├── main.js         # Public website renderer & language switcher
│   └── admin.js        # Admin auth, Firestore CRUD, & WebP compressor
└── worker/
    └── worker.js       # Cloudflare Worker API & KV Caching logic
```

---

## 🔥 Part 1: Firebase Setup Guide

Follow these steps to configure your Firebase backend.

### Step 1: Create a Firebase Project
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and name it `Milano Cafe Menu`.
3. Disable or enable Google Analytics (not required for the menu) and click **Create Project**.

### Step 2: Enable Authentication
1. In the left sidebar, click **Build > Authentication**, then click **Get Started**.
2. Go to the **Sign-in method** tab.
3. Select **Email/Password**, enable it, and click **Save**.
4. Go to the **Users** tab, click **Add User**, and create your Admin credentials:
   - **Email:** `admin@milanocafe.com` (or your preferred email)
   - **Password:** Choose a strong password.

### Step 3: Create Cloud Firestore Database
1. Click **Build > Firestore Database**, then click **Create Database**.
2. Select **Start in production mode** and choose your database location.
3. Click **Enable**.
4. Create a collection named `products`. (You can leave it empty; the Admin panel contains a button to seed mock menu items automatically).

### Step 4: Configure Security Rules
Go to the **Rules** tab in Firestore and replace the rules with the following configuration:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Products Collection Rules
    match /products/{productId} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Categories Collection Rules
    match /categories/{categoryId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### Step 5: Configure Firebase SDK Credentials
1. In the Firebase Console, go to **Project Settings** (gear icon next to Project Overview).
2. Under **Your apps**, click the web icon (`</>`) to register a web app. Name it `Milano Menu App`.
3. Copy the `firebaseConfig` object from the setup snippet.
4. Open [js/firebase.js](file:///c:/Users/ayame/OneDrive/Desktop/milano/js/firebase.js) in your text editor and replace the placeholder values:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

---

## ☁️ Part 2: Cloudflare Setup Guide

Deploy the frontend and configure the Worker API with KV cache for optimal delivery speeds.

### Step 1: Create a Cloudflare Account
Sign up or log in at [Cloudflare](https://dash.cloudflare.com/).

### Step 2: Deploy the Frontend using Cloudflare Pages
1. Go to **Workers & Pages** in the Cloudflare dashboard.
2. Click **Create Application > Pages > Connect to Git** or upload the project folder directly.
3. Select your repository/folder, choose the framework preset as **None** (this is a static Vanilla JS project), and click **Save and Deploy**.

### Step 3: Create KV Namespace
1. In the Cloudflare dashboard sidebar, go to **Workers & Pages > KV**.
2. Click **Create Namespace**.
3. Name it exactly: `MILANO_MENU_CACHE`.
4. Click **Add**.

### Step 4: Create and Deploy the Cloudflare Worker API
1. Go to **Workers & Pages > Overview** and click **Create Application > Create Worker**.
2. Name the worker `milano-menu-api` (or similar) and click **Deploy**.
3. Click **Edit Code** and replace the default worker code with the contents of [worker/worker.js](file:///c:/Users/ayame/OneDrive/Desktop/milano/worker/worker.js).
4. Save and deploy.

### Step 5: Connect KV Namespace and Environment Variables to the Worker
1. Go back to your Worker application dashboard page (for `milano-menu-api`).
2. Go to **Settings > Variables**.
3. Under **Environment Variables**, click **Add Variable**:
   - **Name:** `FIRESTORE_PROJECT_ID`
   - **Value:** *Your Firebase project ID* (e.g. `milano-cafe-menu`)
4. Scroll down to **KV Namespace Bindings** and click **Add Binding**:
   - **Variable Name:** `MILANO_MENU_CACHE`
   - **KV Namespace:** Select `MILANO_MENU_CACHE` from the dropdown.
5. Click **Save and Deploy**.

### Step 6: Route API Requests to the Worker
To ensure the frontend can communicate with `/api/menu` transparently without CORS errors or cross-domain configurations, set up a custom route or bind the worker to your Pages project:
1. In **Workers & Pages**, select your Page frontend project.
2. Go to **Settings > Functions** or **Settings > Routing**.
3. Add a route linking your frontend domain's `/api/*` path to your `milano-menu-api` worker.
4. *Alternatively*, if hosted separately, you can update `WORKER_API_ENDPOINT` in [js/main.js](file:///c:/Users/ayame/OneDrive/Desktop/milano/js/main.js) to point to your absolute Worker URL (e.g., `https://milano-menu-api.yoursubdomain.workers.dev/api/menu`).

---

## 🚀 Performance Features Checklist
* **WebP Image Compression:** Images are compressed under `300KB` and converted client-side to WebP inside `js/admin.js` before being converted to Base64 and saved directly in Firestore.
* **KV Edge Caching:** Public users hit Cloudflare's Edge Cache (`MILANO_MENU_CACHE`) with a `24-hour` expiry. Zero direct database queries are fired on standard visits.
* **Instant Cache Purge:** When the admin modifies products and clicks "Publish Menu", the worker deletes the old cache and regenerates it from Firestore instantly.
