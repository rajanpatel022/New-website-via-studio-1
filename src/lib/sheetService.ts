import { Expense } from '../types';

const STORAGE_KEY = 'sheet_expense_script_url';
const SHEET_META_KEY = 'sheet_expense_meta';
const SAVED_SHEETS_KEY = 'sheet_expense_saved_sheets';
const ACTIVE_SHEET_ID_KEY = 'sheet_expense_active_sheet_id';

export const DEFAULT_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbxnqfd3PqCA-Ck228A_Sl3qYqZvbVID7g61WsmfW61Hx0U4GrcThKSl2yv_hQsaWEg8fw/exec';

export interface SheetMeta {
  title: string;
  id?: string;
  connectedAt: string;
}

export interface SavedSheet {
  id: string;
  name: string;
  scriptUrl: string;
  sheetTitle?: string;
  lastUsedAt: string;
}

export function getSavedSheets(): SavedSheet[] {
  try {
    const raw = localStorage.getItem(SAVED_SHEETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('LocalStorage read error for saved sheets:', e);
  }

  // Default initial sheet
  const defaultSheet: SavedSheet = {
    id: 'default-main-sheet',
    name: 'Website Sheet',
    scriptUrl: DEFAULT_SCRIPT_URL,
    sheetTitle: 'Website Expenses',
    lastUsedAt: new Date().toISOString(),
  };
  return [defaultSheet];
}

export function saveSheetsList(sheets: SavedSheet[]): void {
  try {
    localStorage.setItem(SAVED_SHEETS_KEY, JSON.stringify(sheets));
  } catch (e) {
    console.error('LocalStorage write error for saved sheets:', e);
  }
}

export function getActiveSheet(): SavedSheet {
  const sheets = getSavedSheets();
  const activeId = localStorage.getItem(ACTIVE_SHEET_ID_KEY);
  if (activeId) {
    const found = sheets.find((s) => s.id === activeId);
    if (found) return found;
  }
  return sheets[0];
}

export function setActiveSheet(sheetId: string): SavedSheet {
  const sheets = getSavedSheets();
  const found = sheets.find((s) => s.id === sheetId) || sheets[0];
  try {
    localStorage.setItem(ACTIVE_SHEET_ID_KEY, found.id);
    localStorage.setItem(STORAGE_KEY, found.scriptUrl);
    if (found.sheetTitle) {
      setStoredSheetMeta({
        title: found.sheetTitle,
        connectedAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error('Failed to set active sheet:', e);
  }
  return found;
}

export function addOrUpdateSheet(sheet: {
  id?: string;
  name: string;
  scriptUrl: string;
  sheetTitle?: string;
  lastUsedAt?: string;
}): SavedSheet {
  const sheets = getSavedSheets();
  const id = sheet.id || `sheet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const updatedSheet: SavedSheet = {
    name: sheet.name,
    scriptUrl: sheet.scriptUrl,
    sheetTitle: sheet.sheetTitle,
    id,
    lastUsedAt: sheet.lastUsedAt || new Date().toISOString(),
  };

  const existingIndex = sheets.findIndex((s) => s.id === id);
  if (existingIndex >= 0) {
    sheets[existingIndex] = updatedSheet;
  } else {
    sheets.push(updatedSheet);
  }

  saveSheetsList(sheets);
  setActiveSheet(id);
  return updatedSheet;
}

export function deleteSavedSheet(sheetId: string): SavedSheet {
  let sheets = getSavedSheets();
  sheets = sheets.filter((s) => s.id !== sheetId);
  if (sheets.length === 0) {
    sheets = [
      {
        id: 'default-main-sheet',
        name: 'Website Sheet',
        scriptUrl: DEFAULT_SCRIPT_URL,
        sheetTitle: 'Website Expenses',
        lastUsedAt: new Date().toISOString(),
      },
    ];
  }
  saveSheetsList(sheets);
  return setActiveSheet(sheets[0].id);
}

export function getStoredScriptUrl(): string {
  const active = getActiveSheet();
  return active?.scriptUrl || DEFAULT_SCRIPT_URL;
}

export function setStoredScriptUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, url.trim());
    const active = getActiveSheet();
    if (active) {
      active.scriptUrl = url.trim();
      addOrUpdateSheet(active);
    }
  } catch (e) {
    console.error('LocalStorage write error:', e);
  }
}

export function clearStoredScriptUrl(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SHEET_META_KEY);
  } catch (e) {
    console.error('LocalStorage clear error:', e);
  }
}

export function getStoredSheetMeta(): SheetMeta | null {
  try {
    const raw = localStorage.getItem(SHEET_META_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setStoredSheetMeta(meta: SheetMeta): void {
  try {
    localStorage.setItem(SHEET_META_KEY, JSON.stringify(meta));
  } catch (e) {
    console.error('LocalStorage write error:', e);
  }
}

/**
 * Sends a POST request to Google Apps Script Web App
 */
async function postToAppsScript(url: string, payload: Record<string, any>): Promise<any> {
  const cleanUrl = url.trim();
  const res = await fetch(cleanUrl, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'text/plain;charset=utf-8', // Prevents CORS preflight issues with Apps Script
    },
  });

  if (!res.ok) {
    throw new Error(`Google Apps Script returned status ${res.status}`);
  }

  const data = await res.json();
  if (data.status === 'error') {
    throw new Error(data.message || 'Error occurred in Google Apps Script');
  }
  return data;
}

/**
 * Test connectivity to the Google Apps Script Web App
 */
export async function testSheetConnection(url: string): Promise<{ success: boolean; title?: string; error?: string }> {
  try {
    const data = await postToAppsScript(url, { action: 'ping' });
    if (data.status === 'success') {
      const meta: SheetMeta = {
        title: data.spreadsheetTitle || 'Google Sheet Database',
        id: data.spreadsheetId,
        connectedAt: new Date().toISOString(),
      };
      setStoredSheetMeta(meta);
      return { success: true, title: meta.title };
    }
    return { success: false, error: data.message || 'Unknown response' };
  } catch (err: any) {
    // If POST ping fails, try GET fallback
    try {
      const getRes = await fetch(url.trim());
      if (getRes.ok) {
        const getData = await getRes.json();
        if (getData.status === 'success') {
          const meta: SheetMeta = {
            title: getData.spreadsheetTitle || 'Google Sheet Database',
            id: getData.spreadsheetId,
            connectedAt: new Date().toISOString(),
          };
          setStoredSheetMeta(meta);
          return { success: true, title: meta.title };
        }
      }
    } catch (e) {}
    return { success: false, error: err.message || 'Failed to connect to Google Apps Script' };
  }
}

/**
 * Fetch all expenses from Google Sheet
 */
export async function fetchExpensesFromSheet(url: string): Promise<{ expenses: Expense[]; sheetTitle?: string }> {
  const cleanUrl = url.trim();
  const res = await fetch(cleanUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch from sheet: HTTP ${res.status}`);
  }

  const data = await res.json();
  if (data.status === 'error') {
    throw new Error(data.message || 'Error loading expenses from Google Sheet');
  }

  if (data.spreadsheetTitle) {
    setStoredSheetMeta({
      title: data.spreadsheetTitle,
      id: data.spreadsheetId,
      connectedAt: new Date().toISOString(),
    });
  }

  return {
    expenses: data.expenses || [],
    sheetTitle: data.spreadsheetTitle,
  };
}

/**
 * Add or update an expense in Google Sheet
 */
export async function saveExpenseToSheet(url: string, expense: Partial<Expense>): Promise<void> {
  await postToAppsScript(url, {
    action: 'save',
    expense,
  });
}

/**
 * Delete a single expense row from Google Sheet
 */
export async function deleteExpenseFromSheet(url: string, rowIndex: number): Promise<void> {
  await postToAppsScript(url, {
    action: 'delete',
    rowIndex,
  });
}

/**
 * Batch delete multiple expense rows from Google Sheet
 */
export async function batchDeleteExpensesFromSheet(url: string, rowIndices: number[]): Promise<void> {
  await postToAppsScript(url, {
    action: 'batch-delete',
    rowIndices,
  });
}

/**
 * Batch update categories for multiple rows in Google Sheet
 */
export async function batchUpdateCategoryInSheet(
  url: string,
  rowIndices: number[],
  category: string
): Promise<void> {
  await postToAppsScript(url, {
    action: 'batch-update-category',
    rowIndices,
    category,
  });
}

/**
 * Seed sample data into Google Sheet
 */
export async function seedSampleExpensesInSheet(url: string): Promise<void> {
  await postToAppsScript(url, {
    action: 'seed',
  });
}
