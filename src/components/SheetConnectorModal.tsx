import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Check,
  Loader2,
  Copy,
  ExternalLink,
  HelpCircle,
  Link as LinkIcon,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Unlink,
} from 'lucide-react';
import { testSheetConnection, setStoredScriptUrl, clearStoredScriptUrl, SheetMeta } from '../lib/sheetService';

interface SheetConnectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  sheetMeta: SheetMeta | null;
  onConnected: (url: string) => void;
  onDisconnected: () => void;
}

const APPS_SCRIPT_CODE = `/**
 * Google Apps Script for SheetExpense Tracker
 * Paste this in Extensions > Apps Script in your Google Sheet,
 * then Deploy > New deployment > Web app (Execute as: Me, Access: Anyone)
 */

function setupHeaders(sheet) {
  var headers = ['ID', 'Date', 'Type', 'Category', 'Extra', 'Amount', 'Payment Method', 'Created At'];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#0f172a');
    headerRange.setFontColor('#f8fafc');
    sheet.setFrozenRows(1);
  }
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Expenses') || ss.getActiveSheet();
  if (sheet.getName() !== 'Expenses' && ss.getSheets().length === 1) {
    sheet.setName('Expenses');
  }
  setupHeaders(sheet);
  return sheet;
}

function findColumnIndex(headers, keywords) {
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).toLowerCase().trim();
    for (var k = 0; k < keywords.length; k++) {
      if (h === keywords[k] || h.indexOf(keywords[k]) !== -1) {
        return i;
      }
    }
  }
  return -1;
}

function doGet(e) {
  try {
    var sheet = getSheet();
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return responseJSON({
        status: 'success',
        spreadsheetTitle: SpreadsheetApp.getActiveSpreadsheet().getName(),
        spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
        expenses: []
      });
    }

    var headerRow = data[0];
    var idCol = findColumnIndex(headerRow, ['id', 'uuid', 'txn']);
    var dateCol = findColumnIndex(headerRow, ['date', 'time', 'timestamp']);
    var typeCol = findColumnIndex(headerRow, ['type']);
    var catCol = findColumnIndex(headerRow, ['category', 'cat', 'tag']);
    var extraCol = findColumnIndex(headerRow, ['extra', 'notes', 'note', 'memo', 'remarks', 'comment', 'description', 'detail']);
    var amtCol = findColumnIndex(headerRow, ['amount', 'amt', 'cost', 'price', 'value', 'total', 'sum', 'inr', 'rs']);
    var payCol = findColumnIndex(headerRow, ['payment', 'method', 'mode', 'paid', 'account']);

    var expenses = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row || row.length === 0) continue;

      // Extract Date
      var formattedDate = '';
      var rawDate = (dateCol !== -1) ? row[dateCol] : row[1];
      if (rawDate instanceof Date) {
        var yyyy = rawDate.getFullYear();
        var mm = String(rawDate.getMonth() + 1).padStart(2, '0');
        var dd = String(rawDate.getDate()).padStart(2, '0');
        formattedDate = yyyy + '-' + mm + '-' + dd;
      } else if (rawDate) {
        formattedDate = String(rawDate).trim();
      }

      // Extract ID
      var rowId = (idCol !== -1 && row[idCol]) ? String(row[idCol]) : ('exp_' + (i + 1));

      // Extract Type
      var rawType = (typeCol !== -1 && row[typeCol]) ? String(row[typeCol]).toLowerCase().trim() : 'expense';
      var rowType = (rawType === 'income' || rawType === 'inc') ? 'income' : 'expense';

      // Extract Category
      var rowCat = (catCol !== -1 && row[catCol]) ? String(row[catCol]).trim() : 'Miscellaneous';
      if (!rowCat) rowCat = 'Miscellaneous';

      // Extract Amount (strictly numeric)
      var rowAmt = 0;
      if (amtCol !== -1 && row[amtCol] !== undefined && row[amtCol] !== '') {
        rowAmt = parseFloat(String(row[amtCol]).replace(/[^0-9.-]+/g, '')) || 0;
      } else {
        // Fallback: Find first numeric column if amtCol failed
        for (var c = 0; c < row.length; c++) {
          if (c !== idCol && c !== dateCol && typeof row[c] === 'number' && !isNaN(row[c])) {
            rowAmt = row[c];
            break;
          }
        }
      }

      // Extract Payment Method
      var rowPay = 'Other';
      if (payCol !== -1 && row[payCol] !== undefined && row[payCol] !== '') {
        rowPay = String(row[payCol]).trim();
      }

      // Extract Extra / Notes
      var rowNotes = '';
      if (extraCol !== -1 && row[extraCol] !== undefined && row[extraCol] !== '') {
        rowNotes = String(row[extraCol]).trim();
      }

      // Skip completely blank rows
      if (!formattedDate && rowAmt === 0 && !rowNotes && rowCat === 'Miscellaneous') continue;

      expenses.push({
        id: rowId,
        date: formattedDate || Utilities.formatDate(new Date(), 'GMT', 'yyyy-MM-dd'),
        type: rowType,
        category: rowCat,
        amount: Math.abs(rowAmt),
        paymentMethod: rowPay || 'Other',
        notes: rowNotes,
        rowIndex: i + 1
      });
    }

    return responseJSON({
      status: 'success',
      spreadsheetTitle: SpreadsheetApp.getActiveSpreadsheet().getName(),
      spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
      expenses: expenses
    });
  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  try {
    var sheet = getSheet();
    var payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }
    var action = payload.action || 'save';

    if (action === 'ping') {
      return responseJSON({
        status: 'success',
        spreadsheetTitle: SpreadsheetApp.getActiveSpreadsheet().getName(),
        spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId()
      });
    }

    if (action === 'delete') {
      var rowIndex = parseInt(payload.rowIndex, 10);
      if (rowIndex > 1 && rowIndex <= sheet.getLastRow()) {
        sheet.deleteRow(rowIndex);
        return responseJSON({ status: 'success' });
      }
    }

    if (action === 'batch-delete') {
      var rowIndices = payload.rowIndices || [];
      rowIndices.sort(function(a, b) { return b - a; });
      for (var k = 0; k < rowIndices.length; k++) {
        var r = parseInt(rowIndices[k], 10);
        if (r > 1 && r <= sheet.getLastRow()) sheet.deleteRow(r);
      }
      return responseJSON({ status: 'success' });
    }

    if (action === 'batch-update-category') {
      var rowIndices = payload.rowIndices || [];
      var newCat = payload.category;
      var lastCol = Math.max(sheet.getLastColumn(), 1);
      var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      var catCol = findColumnIndex(headerRow, ['category', 'cat', 'tag']);
      var targetCol = (catCol !== -1) ? (catCol + 1) : 4;

      for (var j = 0; j < rowIndices.length; j++) {
        var r = parseInt(rowIndices[j], 10);
        if (r > 1 && r <= sheet.getLastRow()) sheet.getRange(r, targetCol).setValue(newCat);
      }
      return responseJSON({ status: 'success' });
    }

    if (action === 'seed') {
      var sample = [
        ['exp_1', '2026-02-01', 'income', 'Salary', 'Direct deposit', 55000, 'Bank Transfer', new Date().toISOString()],
        ['exp_2', '2026-02-02', 'expense', 'Housing & Rent', 'Monthly apartment rent', 15000, 'Bank Transfer', new Date().toISOString()],
        ['exp_3', '2026-02-04', 'expense', 'Groceries', 'Supermarket & weekly food', 3200, 'UPI', new Date().toISOString()],
        ['exp_4', '2026-02-06', 'expense', 'Utilities & Bills', 'Electricity & broadband bill', 1850, 'UPI', new Date().toISOString()],
        ['exp_5', '2026-02-08', 'expense', 'Dining & Drinks', 'Weekend dinner with family', 1450, 'Credit Card', new Date().toISOString()]
      ];
      for (var s = 0; s < sample.length; s++) sheet.appendRow(sample[s]);
      return responseJSON({ status: 'success' });
    }

    var exp = payload.expense || payload;
    var expId = exp.id || 'exp_' + Utilities.getUuid().substring(0, 8);
    var expDate = exp.date || Utilities.formatDate(new Date(), 'GMT', 'yyyy-MM-dd');
    var expType = exp.type || 'expense';
    var expCat = exp.category || 'Miscellaneous';
    var expAmt = parseFloat(exp.amount) || 0;
    var expPay = exp.paymentMethod || 'Other';
    var expNotes = exp.notes || '';
    var rIndex = parseInt(exp.rowIndex, 10);

    // Dynamically match existing sheet headers so column order is NEVER broken
    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var rowValues = new Array(headers.length);

    for (var c = 0; c < headers.length; c++) {
      var h = String(headers[c]).toLowerCase().trim();
      if (h === 'id' || h.indexOf('uuid') !== -1 || h.indexOf('txn') !== -1) {
        rowValues[c] = expId;
      } else if (h.indexOf('date') !== -1 || h.indexOf('time') !== -1) {
        rowValues[c] = expDate;
      } else if (h === 'type') {
        rowValues[c] = expType;
      } else if (h.indexOf('cat') !== -1 || h.indexOf('tag') !== -1) {
        rowValues[c] = expCat;
      } else if (h.indexOf('amount') !== -1 || h.indexOf('amt') !== -1 || h.indexOf('cost') !== -1 || h.indexOf('price') !== -1) {
        rowValues[c] = expAmt;
      } else if (h.indexOf('pay') !== -1 || h.indexOf('method') !== -1 || h.indexOf('mode') !== -1) {
        rowValues[c] = expPay;
      } else if (h.indexOf('extra') !== -1 || h.indexOf('note') !== -1 || h.indexOf('remark') !== -1 || h.indexOf('memo') !== -1 || h.indexOf('desc') !== -1) {
        rowValues[c] = expNotes;
      } else if (h.indexOf('creat') !== -1) {
        rowValues[c] = new Date().toISOString();
      } else {
        rowValues[c] = '';
      }
    }

    // Fallback if headers were empty or single column
    if (rowValues.length < 5) {
      rowValues = [expId, expDate, expType, expCat, expNotes, expAmt, expPay, new Date().toISOString()];
    }

    if (rIndex > 1 && rIndex <= sheet.getLastRow()) {
      sheet.getRange(rIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }
    return responseJSON({ status: 'success' });
  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}`;

export const SheetConnectorModal: React.FC<SheetConnectorModalProps> = ({
  isOpen,
  onClose,
  currentUrl,
  sheetMeta,
  onConnected,
  onDisconnected,
}) => {
  const [urlInput, setUrlInput] = useState<string>(currentUrl || '');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [showInstructions, setShowInstructions] = useState<boolean>(!currentUrl);

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      setErrorMsg('Please enter your Google Apps Script Web App URL.');
      return;
    }

    if (!urlInput.includes('script.google.com')) {
      setErrorMsg('Invalid URL. It should start with https://script.google.com/macros/s/.../exec');
      return;
    }

    setIsTesting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const result = await testSheetConnection(urlInput.trim());
    setIsTesting(false);

    if (result.success) {
      setStoredScriptUrl(urlInput.trim());
      setSuccessMsg(`Connected successfully to "${result.title || 'Google Sheet'}"!`);
      setTimeout(() => {
        onConnected(urlInput.trim());
        onClose();
      }, 1000);
    } else {
      setErrorMsg(result.error || 'Could not reach your Google Apps Script. Check deployment settings (Who has access: Anyone).');
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleDisconnect = () => {
    clearStoredScriptUrl();
    setUrlInput('');
    onDisconnected();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Google Sheet Database Setup</h3>
              <p className="text-xs text-slate-400">Direct sync via Google Apps Script (No server needed)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Active Connection Status */}
          {currentUrl ? (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-200">
                    Connected to {sheetMeta?.title || 'Google Sheet'}
                  </p>
                  <p className="text-xs text-emerald-400/80 truncate max-w-sm sm:max-w-md">
                    {currentUrl}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDisconnect}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition-colors"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          ) : null}

          {/* Connection Form */}
          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Google Apps Script Web App URL
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isTesting || !urlInput.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold shadow-md shadow-emerald-600/20 transition-all shrink-0 cursor-pointer"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Testing...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{currentUrl ? 'Update' : 'Connect'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error or Success feedback */}
            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{successMsg}</span>
              </div>
            )}
          </form>

          {/* Quick Setup Instructions Accordion */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
            <button
              type="button"
              onClick={() => setShowInstructions(!showInstructions)}
              className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/40 transition-colors"
            >
              <span className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-indigo-400" />
                <span>How to get your Google Apps Script URL (60 seconds)</span>
              </span>
              <span className="text-slate-400 text-xs">{showInstructions ? 'Hide' : 'Show Guide'}</span>
            </button>

            {showInstructions && (
              <div className="p-4 space-y-4 text-xs text-slate-300">
                <ol className="space-y-3 list-decimal list-inside text-slate-300">
                  <li className="leading-relaxed">
                    Create or open a Google Sheet at{' '}
                    <a
                      href="https://sheets.new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-400 hover:underline inline-flex items-center gap-1 font-semibold"
                    >
                      sheets.new <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li className="leading-relaxed">
                    In the top menu, click <strong>Extensions</strong> → <strong>Apps Script</strong>.
                  </li>
                  <li className="leading-relaxed">
                    Copy the ready-to-use script below, paste it into the editor (replace all existing code), and click Save:
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-sm cursor-pointer"
                      >
                        {copiedCode ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-300" />
                            <span>Copied to Clipboard!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Google Apps Script Code</span>
                          </>
                        )}
                      </button>
                    </div>
                  </li>
                  <li className="leading-relaxed">
                    Click the blue <strong>Deploy</strong> button (top right) → <strong>New deployment</strong>.
                  </li>
                  <li className="leading-relaxed">
                    Click the Gear icon ⚙️ → Select <strong>Web app</strong>.
                  </li>
                  <li className="leading-relaxed">
                    Set <strong>Execute as</strong> to <em>"Me"</em> and <strong>Who has access</strong> to <em>"Anyone"</em>.
                  </li>
                  <li className="leading-relaxed">
                    Click <strong>Deploy</strong>, authorize permissions, copy the <strong>Web app URL</strong>, and paste it in the box above!
                  </li>
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
