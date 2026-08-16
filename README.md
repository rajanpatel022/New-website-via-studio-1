# 📊 SheetExpense Tracker

A modern personal finance & expense tracker built with **React 19**, **Vite**, and **Tailwind CSS** that uses your own **Google Sheet as a live database** via Google Apps Script.

---

## 🚀 Deploy to Cloudflare Pages via GitHub

1. Push this repository to **GitHub**.
2. Go to **Cloudflare Dashboard** > **Compute (Workers & Pages)** > **Create application** > **Pages** > **Connect to Git**.
3. Select your GitHub repository.
4. Set the build settings:
   * **Framework preset**: `Vite`
   * **Build command**: `npm run build`
   * **Build output directory**: `dist`
5. Click **Save and Deploy**. Your website is live!

---

## 📄 Connect Your Google Sheet in 60 Seconds

1. Create a new Google Sheet at **[sheets.new](https://sheets.new)** (or open an existing one).
2. In the top menu, click **Extensions** > **Apps Script**.
3. Delete any default code and copy-paste the entire contents of [google-apps-script.js](google-apps-script.js).
4. Click the blue **Deploy** button (top right) > **New deployment**.
5. Click the gear icon ⚙️ next to "Select type" and select **Web app**.
6. Set:
   * **Description**: `SheetExpense API`
   * **Execute as**: `Me`
   * **Who has access**: `Anyone`
7. Click **Deploy**, authorize permissions when prompted, and **copy the Web app URL**.
8. Open your SheetExpense website, click **"Connect Google Sheet"**, paste your URL, and you're all set!

---

## 💻 Run Locally

```bash
# 1. Install dependencies
npm install

# 2. Start local development server
npm run dev
```
