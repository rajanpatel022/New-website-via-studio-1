export type TransactionType = 'expense' | 'income';

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  description: string;
  amount: number;
  paymentMethod: string; // Credit Card, Debit Card, Cash, Bank Transfer, UPI, etc.
  type?: TransactionType; // 'expense' (-) or 'income' (+)
  notes?: string;
  rowIndex?: number; // Spreadsheets row number for updates/deletes
}

export type ExpenseCategory =
  | 'Housing & Rent'
  | 'Groceries'
  | 'Dining & Drinks'
  | 'Transportation'
  | 'Utilities & Bills'
  | 'Entertainment'
  | 'Shopping'
  | 'Health & Fitness'
  | 'Travel'
  | 'Miscellaneous'
  | string;

export const EXPENSE_CATEGORIES: string[] = [
  'Housing & Rent',
  'Groceries',
  'Dining & Drinks',
  'Transportation',
  'Utilities & Bills',
  'Entertainment',
  'Shopping',
  'Health & Fitness',
  'Travel',
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
  'UPI',
  'Credit Card',
  'Debit Card',
  'Cash',
  'Bank Transfer',
  'Digital Wallet',
  'Other',
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
