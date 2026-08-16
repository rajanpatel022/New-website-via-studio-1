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

    var headerRow = data[0].map(function(h) { return String(h).trim().toLowerCase(); });
    var hasOldDesc = headerRow.indexOf('description') !== -1;
    var typeCol = headerRow.indexOf('type');
    var catCol = headerRow.indexOf('category');
    var extraCol = headerRow.indexOf('extra') !== -1 ? headerRow.indexOf('extra') : headerRow.indexOf('notes');
    var amtCol = headerRow.indexOf('amount');
    var payCol = headerRow.indexOf('payment method');

    var expenses = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0] && !row[1] && !row[3]) continue;

      var rawDate = row[1];
      var formattedDate = '';
      if (rawDate instanceof Date) {
        var yyyy = rawDate.getFullYear();
        var mm = String(rawDate.getMonth() + 1).padStart(2, '0');
        var dd = String(rawDate.getDate()).padStart(2, '0');
        formattedDate = yyyy + '-' + mm + '-' + dd;
      } else if (rawDate) {
        formattedDate = String(rawDate).trim();
      }

      var rowType = (typeCol !== -1 && row[typeCol]) ? String(row[typeCol]).toLowerCase() : (String(row[2] || 'expense').toLowerCase());
      var rowCat = (catCol !== -1 && row[catCol]) ? String(row[catCol]) : (row[3] ? String(row[3]) : 'Miscellaneous');
      
      var rowAmt = 0;
      if (amtCol !== -1) {
        rowAmt = parseFloat(row[amtCol]) || 0;
      } else if (hasOldDesc) {
        rowAmt = parseFloat(row[5]) || 0;
      } else {
        rowAmt = parseFloat(row[4]) || 0;
      }

      var rowPay = 'Other';
      if (payCol !== -1 && row[payCol]) {
        rowPay = String(row[payCol]);
      } else if (hasOldDesc) {
        rowPay = String(row[6] || 'Other');
      } else {
        rowPay = String(row[5] || 'Other');
      }

      var rowNotes = '';
      if (extraCol !== -1 && row[extraCol]) {
        rowNotes = String(row[extraCol]);
      } else if (hasOldDesc) {
        rowNotes = String(row[7] || '');
      } else if (row[4] && isNaN(parseFloat(row[4]))) {
        rowNotes = String(row[4]);
      }

      expenses.push({
        id: String(row[0] || 'exp_' + (i + 1)),
        date: formattedDate,
        type: rowType,
        category: rowCat,
        amount: rowAmt,
        paymentMethod: rowPay,
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
      for (var j = 0; j < rowIndices.length; j++) {
        var r = parseInt(rowIndices[j], 10);
        if (r > 1 && r <= sheet.getLastRow()) sheet.getRange(r, 4).setValue(newCat);
      }
      return responseJSON({ status: 'success' });
    }

    if (action === 'seed') {
      var sample = [
        ['exp_1', '2026-02-01', 'income', 'Salary', 55000, 'Bank Transfer', 'Direct deposit', new Date().toISOString()],
        ['exp_2', '2026-02-02', 'expense', 'Housing & Rent', 15000, 'Bank Transfer', 'Monthly apartment rent', new Date().toISOString()],
        ['exp_3', '2026-02-04', 'expense', 'Groceries', 3200, 'UPI', 'Supermarket & weekly food', new Date().toISOString()],
        ['exp_4', '2026-02-06', 'expense', 'Utilities & Bills', 1850, 'UPI', 'Electricity & broadband bill', new Date().toISOString()],
        ['exp_5', '2026-02-08', 'expense', 'Dining & Drinks', 1450, 'Credit Card', 'Weekend dinner with family', new Date().toISOString()]
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

    // Check sheet header layout
    var firstRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(function(h) { return String(h).trim().toLowerCase(); });
    var hasOldDescriptionHeader = firstRow.indexOf('description') !== -1;
    var extraAtIndex4 = firstRow.indexOf('extra') === 4;

    var rowValues;
    if (hasOldDescriptionHeader) {
      rowValues = [expId, expDate, expType, expCat, '', expAmt, expPay, expNotes, new Date().toISOString()];
    } else if (extraAtIndex4) {
      rowValues = [expId, expDate, expType, expCat, expNotes, expAmt, expPay, new Date().toISOString()];
    } else {
      rowValues = [expId, expDate, expType, expCat, expAmt, expPay, expNotes, new Date().toISOString()];
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
