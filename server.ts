import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { google } from 'googleapis';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

// Helper to get OAuth2 client
function getOAuth2Client() {
  const clientId = process.env.CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  let appUrl = process.env.APP_URL || 'http://localhost:3000';
  appUrl = appUrl.replace(/\/$/, ''); // strip trailing slash

  const redirectUri = `${appUrl}/api/auth/callback`;

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// Helper to get authenticated google clients from request cookie or Authorization header
function getAuthenticatedClient(req: express.Request) {
  let rawTokens = req.cookies?.google_tokens;

  // Fallback to Authorization header if cookie is blocked in iframe/cross-site context
  if (!rawTokens && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      rawTokens = authHeader.substring(7);
    } else {
      rawTokens = authHeader;
    }
  }

  if (!rawTokens && req.headers['x-google-tokens']) {
    rawTokens = req.headers['x-google-tokens'] as string;
  }

  if (!rawTokens) {
    return null;
  }

  try {
    const tokens = typeof rawTokens === 'string' ? JSON.parse(decodeURIComponent(rawTokens)) : rawTokens;
    if (!tokens || typeof tokens !== 'object') return null;

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);
    return oauth2Client;
  } catch (err) {
    console.error('Error parsing auth tokens:', err);
    return null;
  }
}

// -------------------------------------------------------------
// AUTH ENDPOINTS
// -------------------------------------------------------------

// Check Auth Status
app.get('/api/auth/status', async (req, res) => {
  const authClient = getAuthenticatedClient(req);
  if (!authClient) {
    return res.json({ authenticated: false });
  }

  try {
    // Fetch user profile info
    const oauth2 = google.oauth2({ version: 'v2', auth: authClient });
    const userInfo = await oauth2.userinfo.get();
    return res.json({
      authenticated: true,
      email: userInfo.data.email,
      picture: userInfo.data.picture,
      tokens: authClient.credentials,
    });
  } catch (err: any) {
    console.error('Failed to fetch user info with token:', err.message);
    return res.json({ authenticated: false, error: 'Token expired or invalid' });
  }
});

// Initiates Google OAuth Login Flow
app.get('/api/auth/login', (req, res) => {
  const oauth2Client = getOAuth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent select_account',
  });

  res.redirect(authUrl);
});

// OAuth Callback
app.get('/api/auth/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) {
    return res.status(400).send('Authorization code is missing.');
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    // Merge with any existing refresh_token if present
    let existingTokens: any = {};
    const existingRaw = req.cookies?.google_tokens || req.headers.authorization?.replace('Bearer ', '');
    if (existingRaw) {
      try {
        existingTokens = typeof existingRaw === 'string' ? JSON.parse(decodeURIComponent(existingRaw)) : existingRaw;
      } catch (e) {}
    }
    const mergedTokens = { ...existingTokens, ...tokens };

    // Save tokens in SameSite=None, Secure HTTP-only cookie for iframe compatibility
    res.cookie('google_tokens', JSON.stringify(mergedTokens), {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    const serializedTokens = JSON.stringify(mergedTokens);

    // Send success response informing parent window and saving to localStorage
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; }
            .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.05); text-align: center; }
            h2 { color: #16a34a; margin-top: 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Connected to Google Sheets!</h2>
            <p>You are logged in. Closing window...</p>
            <script>
              const tokens = ${JSON.stringify(serializedTokens)};
              try {
                localStorage.setItem('sheet_expense_google_tokens', tokens);
              } catch (e) {
                console.error('LocalStorage write error:', e);
              }
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', tokens: tokens }, '*');
                setTimeout(() => window.close(), 1200);
              } else {
                setTimeout(() => { window.location.href = '/'; }, 1000);
              }
            </script>
          </div>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('Error exchanging code for tokens:', err);
    res.status(500).send('Authentication failed: ' + (err.message || 'Unknown error'));
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('google_tokens', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
  });
  res.json({ success: true });
});

// -------------------------------------------------------------
// GOOGLE SHEETS & DRIVE API ENDPOINTS
// -------------------------------------------------------------

// List user's expense spreadsheets from Google Drive
app.get('/api/sheets/list', async (req, res) => {
  const authClient = getAuthenticatedClient(req);
  if (!authClient) {
    return res.status(401).json({ error: 'Not authenticated with Google Account' });
  }

  try {
    const drive = google.drive({ version: 'v3', auth: authClient });
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      fields: 'files(id, name, createdTime, modifiedTime, webViewLink)',
      pageSize: 20,
      orderBy: 'modifiedTime desc',
    });

    res.json({ files: response.data.files || [] });
  } catch (err: any) {
    console.error('Error listing sheets:', err);
    res.status(500).json({ error: err.message || 'Failed to list Google Sheets' });
  }
});

// Create a new Expense Tracker Spreadsheet in Google Sheets
app.post('/api/sheets/create', async (req, res) => {
  const authClient = getAuthenticatedClient(req);
  if (!authClient) {
    return res.status(401).json({ error: 'Not authenticated with Google Account' });
  }

  const { title = 'Expense Tracker Database' } = req.body;

  try {
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    // 1. Create spreadsheet with 'Expenses' sheet
    const createRes = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title,
        },
        sheets: [
          {
            properties: {
              title: 'Expenses',
              gridProperties: {
                frozenRowCount: 1,
              },
            },
          },
        ],
      },
    });

    const spreadsheetId = createRes.data.spreadsheetId;
    if (!spreadsheetId) {
      throw new Error('Failed to retrieve new spreadsheet ID');
    }

    // 2. Add header row
    const headers = [['ID', 'Date', 'Category', 'Description', 'Amount ($)', 'Payment Method', 'Notes']];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Expenses!A1:G1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: headers,
      },
    });

    // 3. Format header row (bold, background color)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.1, green: 0.2, blue: 0.3 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
        ],
      },
    });

    res.json({
      spreadsheetId,
      title,
      webViewLink: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    });
  } catch (err: any) {
    console.error('Error creating Google Sheet:', err);
    res.status(500).json({ error: err.message || 'Failed to create Google Sheet' });
  }
});

// Get all expenses from a Google Sheet
app.get('/api/expenses', async (req, res) => {
  const authClient = getAuthenticatedClient(req);
  if (!authClient) {
    return res.status(401).json({ error: 'Not authenticated with Google Account' });
  }

  const spreadsheetId = req.query.spreadsheetId as string;
  if (!spreadsheetId) {
    return res.status(400).json({ error: 'spreadsheetId query parameter is required' });
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    // Check sheet names to determine range
    const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetName = spreadsheetInfo.data.sheets?.[0]?.properties?.title || 'Expenses';

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A2:G2000`,
    });

    const rows = response.data.values || [];
    const expenses = rows.map((row, idx) => {
      // Row index in sheet starts at 2 because A1 is header
      const actualRowIndex = idx + 2;
      return {
        id: row[0] || `EXP-${idx + 1}`,
        date: row[1] || new Date().toISOString().split('T')[0],
        category: row[2] || 'Miscellaneous',
        description: row[3] || '',
        amount: parseFloat(row[4]) || 0,
        paymentMethod: row[5] || 'Other',
        notes: row[6] || '',
        rowIndex: actualRowIndex,
      };
    });

    res.json({ expenses, sheetName });
  } catch (err: any) {
    console.error('Error fetching expenses from Google Sheet:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch expenses from Google Sheet' });
  }
});

// Add a new expense row to Google Sheet
app.post('/api/expenses', async (req, res) => {
  const authClient = getAuthenticatedClient(req);
  if (!authClient) {
    return res.status(401).json({ error: 'Not authenticated with Google Account' });
  }

  const { spreadsheetId, expense } = req.body;
  if (!spreadsheetId || !expense) {
    return res.status(400).json({ error: 'spreadsheetId and expense payload are required' });
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    const id = expense.id || `EXP-${Date.now()}`;
    const newRow = [
      id,
      expense.date,
      expense.category,
      expense.description,
      expense.amount,
      expense.paymentMethod,
      expense.notes || '',
    ];

    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'A1', // Google Sheets automatically finds the first empty row
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [newRow],
      },
    });

    res.json({ success: true, id, updatedRange: appendRes.data.updates?.updatedRange });
  } catch (err: any) {
    console.error('Error appending expense to sheet:', err);
    res.status(500).json({ error: err.message || 'Failed to append expense to sheet' });
  }
});

// Update an existing expense row in Google Sheet
app.put('/api/expenses', async (req, res) => {
  const authClient = getAuthenticatedClient(req);
  if (!authClient) {
    return res.status(401).json({ error: 'Not authenticated with Google Account' });
  }

  const { spreadsheetId, expense } = req.body;
  if (!spreadsheetId || !expense || !expense.rowIndex) {
    return res.status(400).json({ error: 'spreadsheetId, expense, and expense.rowIndex are required' });
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    const range = `A${expense.rowIndex}:G${expense.rowIndex}`;
    const rowValues = [
      expense.id,
      expense.date,
      expense.category,
      expense.description,
      expense.amount,
      expense.paymentMethod,
      expense.notes || '',
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowValues],
      },
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error updating expense in sheet:', err);
    res.status(500).json({ error: err.message || 'Failed to update expense in sheet' });
  }
});

// Delete an expense row in Google Sheet
app.delete('/api/expenses', async (req, res) => {
  const authClient = getAuthenticatedClient(req);
  if (!authClient) {
    return res.status(401).json({ error: 'Not authenticated with Google Account' });
  }

  const { spreadsheetId, rowIndex } = req.body;
  if (!spreadsheetId || !rowIndex) {
    return res.status(400).json({ error: 'spreadsheetId and rowIndex are required' });
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    // Clear values for that row range
    const range = `A${rowIndex}:G${rowIndex}`;
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error clearing expense row in sheet:', err);
    res.status(500).json({ error: err.message || 'Failed to delete expense row' });
  }
});

// Batch Delete multiple expense rows in Google Sheet
app.post('/api/expenses/batch-delete', async (req, res) => {
  const authClient = getAuthenticatedClient(req);
  if (!authClient) {
    return res.status(401).json({ error: 'Not authenticated with Google Account' });
  }

  const { spreadsheetId, rowIndices } = req.body;
  if (!spreadsheetId || !Array.isArray(rowIndices) || rowIndices.length === 0) {
    return res.status(400).json({ error: 'spreadsheetId and non-empty rowIndices array are required' });
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    const ranges = rowIndices.map((r: number) => `A${r}:G${r}`);
    
    await sheets.spreadsheets.values.batchClear({
      spreadsheetId,
      requestBody: {
        ranges,
      },
    });

    res.json({ success: true, count: rowIndices.length });
  } catch (err: any) {
    console.error('Error batch deleting expense rows in sheet:', err);
    res.status(500).json({ error: err.message || 'Failed to delete expense rows' });
  }
});

// Batch Update category for multiple expense rows in Google Sheet
app.post('/api/expenses/batch-update-category', async (req, res) => {
  const authClient = getAuthenticatedClient(req);
  if (!authClient) {
    return res.status(401).json({ error: 'Not authenticated with Google Account' });
  }

  const { spreadsheetId, rowIndices, category } = req.body;
  if (!spreadsheetId || !Array.isArray(rowIndices) || rowIndices.length === 0 || !category) {
    return res.status(400).json({ error: 'spreadsheetId, rowIndices array, and category are required' });
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    const data = rowIndices.map((r: number) => ({
      range: `C${r}`,
      values: [[category]],
    }));

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data,
      },
    });

    res.json({ success: true, count: rowIndices.length });
  } catch (err: any) {
    console.error('Error batch updating categories in sheet:', err);
    res.status(500).json({ error: err.message || 'Failed to update categories' });
  }
});

// Seed sample expense data into Google Sheet
app.post('/api/expenses/seed', async (req, res) => {
  const authClient = getAuthenticatedClient(req);
  if (!authClient) {
    return res.status(401).json({ error: 'Not authenticated with Google Account' });
  }

  const { spreadsheetId } = req.body;
  if (!spreadsheetId) {
    return res.status(400).json({ error: 'spreadsheetId is required' });
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // Generate realistic sample expenses across current and previous 3 months
    const now = new Date();
    const sampleRows = [];
    
    const sampleTemplates = [
      { category: 'Housing & Rent', desc: 'Monthly Apartment Rent', amount: 1650, pm: 'Bank Transfer' },
      { category: 'Groceries', desc: 'Whole Foods Market', amount: 142.80, pm: 'Credit Card' },
      { category: 'Groceries', desc: 'Trader Joe\'s Weekly Grocery', amount: 98.45, pm: 'Debit Card' },
      { category: 'Dining & Drinks', desc: 'Italian Bistro Dinner', amount: 76.50, pm: 'Credit Card' },
      { category: 'Dining & Drinks', desc: 'Starbucks Coffee & Snacks', amount: 18.25, pm: 'Digital Wallet' },
      { category: 'Utilities & Bills', desc: 'Electric & Power Bill', amount: 115.00, pm: 'Bank Transfer' },
      { category: 'Utilities & Bills', desc: 'High-speed Fiber Internet', amount: 70.00, pm: 'Credit Card' },
      { category: 'Transportation', desc: 'Subway Monthly Pass', amount: 128.00, pm: 'Credit Card' },
      { category: 'Transportation', desc: 'Chevron Fuel Refill', amount: 48.50, pm: 'Credit Card' },
      { category: 'Entertainment', desc: 'Netflix & Spotify Subscriptions', amount: 28.99, pm: 'Credit Card' },
      { category: 'Entertainment', desc: 'Cinema Movie Tickets', amount: 34.00, pm: 'Digital Wallet' },
      { category: 'Shopping', desc: 'Target Household Essentials', amount: 89.20, pm: 'Credit Card' },
      { category: 'Health & Fitness', desc: 'Gym Membership', amount: 65.00, pm: 'Credit Card' },
      { category: 'Health & Fitness', desc: 'CVS Pharmacy Prescription', amount: 24.50, pm: 'Debit Card' },
      { category: 'Travel', desc: 'Weekend Getaway Airbnb', amount: 320.00, pm: 'Credit Card' },
    ];

    let idCounter = 100;
    // Populate across 4 months (Month 0, Month -1, Month -2, Month -3)
    for (let monthOffset = 3; monthOffset >= 0; monthOffset--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
      
      // Select 6-10 items per month
      for (const item of sampleTemplates) {
        idCounter++;
        const day = Math.floor(Math.random() * 25) + 1;
        const itemDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), day);
        const dateStr = itemDate.toISOString().split('T')[0];
        
        // Add slight amount variance
        const variance = (Math.random() * 0.2 - 0.1) * item.amount;
        const finalAmount = Math.round((item.amount + variance) * 100) / 100;

        sampleRows.push([
          `EXP-${idCounter}`,
          dateStr,
          item.category,
          item.desc,
          finalAmount,
          item.pm,
          'Sample generated data',
        ]);
      }
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: sampleRows,
      },
    });

    res.json({ success: true, count: sampleRows.length });
  } catch (err: any) {
    console.error('Error seeding data:', err);
    res.status(500).json({ error: err.message || 'Failed to seed sample expenses' });
  }
});

// -------------------------------------------------------------
// GEMINI AI SMART EXPENSE PARSER
// -------------------------------------------------------------
app.post('/api/ai/parse-expense', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text prompt is required' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is missing' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Extract expense details from the following receipt or natural language note into JSON format:
"${text}"

Respond ONLY with valid JSON in this exact structure, with no markdown code blocks:
{
  "amount": number (e.g. 45.50),
  "category": string (Standard category like "Groceries", "Dining & Drinks", "Transportation", "Utilities & Bills", "Entertainment", "Shopping", "Health & Fitness", "Travel", "Housing & Rent", "Miscellaneous", or a specific custom category name if none fit),
  "description": string (short clean name/vendor, e.g. "Swiggy", "Blinkit", "Big Bazaar"),
  "date": string (YYYY-MM-DD format, default to today's date ${new Date().toISOString().split('T')[0]} if unspecified),
  "paymentMethod": string (Must be one of: "UPI", "Credit Card", "Debit Card", "Cash", "Bank Transfer", "Digital Wallet", "Other"),
  "notes": string
}`,
    });

    const responseText = response.text?.trim() || '';
    const cleanJsonText = responseText.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleanJsonText);

    res.json({ parsed });
  } catch (err: any) {
    console.error('Error parsing expense with Gemini AI:', err);
    res.status(500).json({ error: err.message || 'Failed to parse expense with AI' });
  }
});

// -------------------------------------------------------------
// VITE MIDDLEWARE / STATIC SERVING
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

export default app;
