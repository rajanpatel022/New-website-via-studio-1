/**
 * Google Apps Script for SheetExpense Tracker
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet (or create a new blank one at https://sheets.new)
 * 2. In the top menu, click "Extensions" > "Apps Script"
 * 3. Delete any existing code in the editor and paste this entire file
 * 4. Click the blue "Deploy" button in top-right > "New deployment"
 * 5. Click the gear icon (Select type) > Choose "Web app"
 * 6. Set Description: "SheetExpense API"
 * 7. Set "Execute as": "Me (your email)"
 * 8. Set "Who has access": "Anyone"  <--- (IMPORTANT: Allows your web app to read/write)
 * 9. Click "Deploy", authorize permissions when prompted, and COPY the Web App URL!
 * 10. Paste that Web App URL into your SheetExpense web application.
 */

function setupHeaders(sheet) {
  var headers = [
    'ID',
    'Date',
    'Type',
    'Category',
    'Description',
    'Amount',
    'Payment Method',
    'Notes',
    'Created At'
  ];
  
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

    var headers = data[0];
    var expenses = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0] && !row[1] && !row[4]) continue; // Skip blank rows

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

      var expense = {
        id: String(row[0] || 'exp_' + (i + 1)),
        date: formattedDate,
        type: String(row[2] || 'expense').toLowerCase(),
        category: String(row[3] || 'Miscellaneous'),
        description: String(row[4] || ''),
        amount: parseFloat(row[5]) || 0,
        paymentMethod: String(row[6] || 'Other'),
        notes: String(row[7] || ''),
        rowIndex: i + 1 // 1-based row index in Google Sheets
      };

      expenses.push(expense);
    }

    return responseJSON({
      status: 'success',
      spreadsheetTitle: SpreadsheetApp.getActiveSpreadsheet().getName(),
      spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
      expenses: expenses
    });
  } catch (err) {
    return responseJSON({
      status: 'error',
      message: err.toString()
    });
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

    // 1. ACTION: Ping / Test connection
    if (action === 'ping') {
      return responseJSON({
        status: 'success',
        message: 'Connected to Google Sheet successfully',
        spreadsheetTitle: SpreadsheetApp.getActiveSpreadsheet().getName(),
        spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId()
      });
    }

    // 2. ACTION: Delete single expense
    if (action === 'delete') {
      var rowIndex = parseInt(payload.rowIndex, 10);
      if (rowIndex && rowIndex > 1 && rowIndex <= sheet.getLastRow()) {
        sheet.deleteRow(rowIndex);
        return responseJSON({ status: 'success', message: 'Expense deleted' });
      } else {
        return responseJSON({ status: 'error', message: 'Invalid rowIndex' });
      }
    }

    // 3. ACTION: Batch Delete
    if (action === 'batch-delete') {
      var rowIndices = payload.rowIndices || [];
      // Sort descending so row deletions don't shift subsequent indices
      rowIndices.sort(function(a, b) { return b - a; });
      for (var k = 0; k < rowIndices.length; k++) {
        var r = parseInt(rowIndices[k], 10);
        if (r > 1 && r <= sheet.getLastRow()) {
          sheet.deleteRow(r);
        }
      }
      return responseJSON({ status: 'success', message: 'Rows deleted' });
    }

    // 4. ACTION: Batch Update Category
    if (action === 'batch-update-category') {
      var rowIndices = payload.rowIndices || [];
      var newCat = payload.category;
      for (var j = 0; j < rowIndices.length; j++) {
        var r = parseInt(rowIndices[j], 10);
        if (r > 1 && r <= sheet.getLastRow()) {
          sheet.getRange(r, 4).setValue(newCat); // Column 4 is Category
        }
      }
      return responseJSON({ status: 'success', message: 'Categories updated' });
    }

    // 5. ACTION: Seed Sample Data
    if (action === 'seed') {
      var sampleData = [
        ['exp_seed_1', '2026-02-01', 'income', 'Salary', 'Monthly Paycheck', 5000, 'Bank Transfer', 'Direct deposit', new Date().toISOString()],
        ['exp_seed_2', '2026-02-02', 'expense', 'Housing & Rent', 'Apartment Rent', 1200, 'Bank Transfer', 'February rent', new Date().toISOString()],
        ['exp_seed_3', '2026-02-04', 'expense', 'Groceries', 'Supermarket & Produce', 145.50, 'Credit Card', 'Weekly grocery run', new Date().toISOString()],
        ['exp_seed_4', '2026-02-06', 'expense', 'Utilities & Bills', 'Electricity & Internet', 110, 'UPI', 'Broadband and power', new Date().toISOString()],
        ['exp_seed_5', '2026-02-08', 'expense', 'Dining & Drinks', 'Dinner with friends', 68.20, 'UPI', 'Italian bistro', new Date().toISOString()],
        ['exp_seed_6', '2026-02-10', 'income', 'Freelance & Consulting', 'Web design project', 850, 'Bank Transfer', 'Milestone payment', new Date().toISOString()],
        ['exp_seed_7', '2026-02-12', 'expense', 'Transportation', 'Fuel & Metro card recharge', 45, 'Credit Card', 'Monthly transit', new Date().toISOString()],
        ['exp_seed_8', '2026-02-14', 'expense', 'Entertainment', 'Movie tickets & streaming', 32, 'Digital Wallet', 'Cinema night', new Date().toISOString()]
      ];

      for (var s = 0; s < sampleData.length; s++) {
        sheet.appendRow(sampleData[s]);
      }
      return responseJSON({ status: 'success', message: 'Sample data seeded' });
    }

    // 6. ACTION: Save / Update single expense
    var expense = payload.expense || payload;
    var expId = expense.id || 'exp_' + Utilities.getUuid().substring(0, 8);
    var expDate = expense.date || Utilities.formatDate(new Date(), 'GMT', 'yyyy-MM-dd');
    var expType = expense.type || 'expense';
    var expCategory = expense.category || 'Miscellaneous';
    var expDesc = expense.description || '';
    var expAmount = parseFloat(expense.amount) || 0;
    var expPayment = expense.paymentMethod || 'Other';
    var expNotes = expense.notes || '';
    var rowIndex = parseInt(expense.rowIndex, 10);

    var rowValues = [
      expId,
      expDate,
      expType,
      expCategory,
      expDesc,
      expAmount,
      expPayment,
      expNotes,
      new Date().toISOString()
    ];

    if (rowIndex && rowIndex > 1 && rowIndex <= sheet.getLastRow()) {
      // Update existing row
      sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      // Append new row
      sheet.appendRow(rowValues);
    }

    return responseJSON({
      status: 'success',
      message: 'Expense saved',
      expense: {
        id: expId,
        date: expDate,
        type: expType,
        category: expCategory,
        description: expDesc,
        amount: expAmount,
        paymentMethod: expPayment,
        notes: expNotes
      }
    });

  } catch (err) {
    return responseJSON({
      status: 'error',
      message: err.toString()
    });
  }
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
