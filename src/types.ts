export type TransactionType = 'expense' | 'income';

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  amount: number;
  paymentMethod: string; // Credit Card, Debit Card, Cash, Bank Transfer, UPI, etc.
  type?: TransactionType; // 'expense' (-) or 'income' (+)
  notes?: string;
  rowIndex?: number; // Spreadsheets row number for updates/deletes
}

export type ExpenseCategory =
  | 'Total Spend'
  | 'Total Cash'
  | 'Total UPI'
  | 'Housing & Rent'
  | 'Transportation'
  | 'Utilities & Bills'
  | 'Entertainment'
  | 'Shopping'
  | 'Miscellaneous'
  | string;

export const EXPENSE_CATEGORIES: string[] = [
  'Total Spend',
  'Total Cash',
  'Total UPI',
  'Housing & Rent',
  'Transportation',
  'Utilities & Bills',
  'Entertainment',
  'Shopping',
  'Miscellaneous',
  'Custom / Other...',
];

export const INCOME_CATEGORIES: string[] = [
  'Salary',
  'Freelance & Consulting',
  'Investments & Returns',
  'Business Revenue',
  'Rental Income',
  'Gifts & Allowance',
  'Refunds & Cashback',
  'Side Hustle',
  'Miscellaneous Income',
  'Custom / Other...',
];

export const PAYMENT_METHODS = [
  'Other',
  'UPI',
  'Credit Card',
  'Debit Card',
  'Cash',
  'Bank Transfer',
  'Digital Wallet',
];

export interface GoogleSheetFile {
  id: string;
  name: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface AuthStatus {
  authenticated: boolean;
  email?: string;
  picture?: string;
  error?: string;
}

export interface SpendingSummary {
  totalSpent: number; // Total Expenses (-)
  totalIncome: number; // Total Income (+)
  netCashFlow: number; // Total Income - Total Spent
  thisMonthSpent: number;
  thisMonthIncome: number;
  thisMonthNet: number;
  lastMonthSpent: number;
  monthOverMonthPercent: number;
  topCategory: { category: string; amount: number } | null;
  expenseCount: number;
  incomeCount: number;
  avgExpenseAmount: number;
}

export interface MonthlyTrendData {
  month: string; // e.g., 'Jan 2026'
  yearMonth: string; // e.g., '2026-01'
  total: number;
  count: number;
  [category: string]: any; // Allow category breakdown per month
}

export interface CategoryTrendData {
  name: string;
  value: number;
  color: string;
  percentage: number;
}
