import { Expense, SpendingSummary, MonthlyTrendData, CategoryTrendData, INCOME_CATEGORIES } from '../types';

export const DEFAULT_CATEGORY_COLORS: Record<string, string> = {
  // Expenses
  'Housing & Rent': '#6366f1', // Indigo
  'Groceries': '#10b981', // Emerald
  'Dining & Drinks': '#f59e0b', // Amber
  'Transportation': '#3b82f6', // Blue
  'Utilities & Bills': '#06b6d4', // Cyan
  'Entertainment': '#ec4899', // Pink
  'Shopping': '#8b5cf6', // Purple
  'Health & Fitness': '#14b8a6', // Teal
  'Travel': '#f97316', // Orange
  'Miscellaneous': '#64748b', // Slate
  // Income
  'Salary': '#10b981', // Emerald
  'Freelance & Consulting': '#06b6d4', // Cyan
  'Investments & Returns': '#3b82f6', // Blue
  'Business Revenue': '#8b5cf6', // Purple
  'Rental Income': '#f59e0b', // Amber
  'Gifts & Allowance': '#ec4899', // Pink
  'Refunds & Cashback': '#14b8a6', // Teal
  'Side Hustle': '#84cc16', // Lime
  'Miscellaneous Income': '#059669', // Dark Emerald
};

export const COLOR_PALETTE_PRESETS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#84cc16', // Lime
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#0284c7', // Sky
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#64748b', // Slate
];

const CATEGORY_COLORS_STORAGE_KEY = 'sheet_expense_custom_category_colors';

export function getCustomCategoryColors(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CATEGORY_COLORS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load custom category colors:', e);
  }
  return {};
}

export function saveCategoryColor(category: string, color: string): void {
  try {
    const current = getCustomCategoryColors();
    current[category] = color;
    localStorage.setItem(CATEGORY_COLORS_STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new CustomEvent('category-colors-updated', { detail: { category, color } }));
  } catch (e) {
    console.error('Failed to save category color:', e);
  }
}

export function resetCategoryColors(): void {
  try {
    localStorage.removeItem(CATEGORY_COLORS_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('category-colors-updated', { detail: {} }));
  } catch (e) {
    console.error('Failed to reset category colors:', e);
  }
}

export function getCategoryColor(category: string, customMap?: Record<string, string>): string {
  if (!category) return '#64748b';
  if (customMap && customMap[category]) {
    return customMap[category];
  }
  const custom = getCustomCategoryColors();
  if (custom[category]) {
    return custom[category];
  }
  if (DEFAULT_CATEGORY_COLORS[category]) {
    return DEFAULT_CATEGORY_COLORS[category];
  }

  // Generate deterministic pleasant color for unknown / custom categories
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTE_PRESETS.length;
  return COLOR_PALETTE_PRESETS[index];
}

export const CATEGORY_COLORS: Record<string, string> = new Proxy(DEFAULT_CATEGORY_COLORS, {
  get(target, prop: string) {
    if (typeof prop !== 'string') return undefined;
    return getCategoryColor(prop);
  },
});

export function isIncomeTransaction(exp: Expense): boolean {
  if (exp.type === 'income') return true;
  if (exp.type === 'expense') return false;
  if (exp.amount < 0) return true;
  if (INCOME_CATEGORIES.includes(exp.category) && exp.category !== 'Custom / Other...') return true;
  if (exp.category?.toLowerCase().includes('income') || exp.category?.toLowerCase().includes('salary')) return true;
  return false;
}

export function calculateSpendingSummary(expenses: Expense[]): SpendingSummary {
  if (!expenses.length) {
    return {
      totalSpent: 0,
      totalIncome: 0,
      netCashFlow: 0,
      thisMonthSpent: 0,
      thisMonthIncome: 0,
      thisMonthNet: 0,
      lastMonthSpent: 0,
      monthOverMonthPercent: 0,
      topCategory: null,
      expenseCount: 0,
      incomeCount: 0,
      avgExpenseAmount: 0,
    };
  }

  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastYearMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  let totalSpent = 0;
  let totalIncome = 0;
  let thisMonthSpent = 0;
  let thisMonthIncome = 0;
  let lastMonthSpent = 0;
  let expenseCount = 0;
  let incomeCount = 0;
  const categoryTotals: Record<string, number> = {};

  expenses.forEach((exp) => {
    const isIncome = isIncomeTransaction(exp);
    const amt = Math.abs(exp.amount || 0);

    const yearMonth = exp.date ? exp.date.substring(0, 7) : '';

    if (isIncome) {
      totalIncome += amt;
      incomeCount += 1;
      if (yearMonth === currentYearMonth) {
        thisMonthIncome += amt;
      }
    } else {
      totalSpent += amt;
      expenseCount += 1;
      if (yearMonth === currentYearMonth) {
        thisMonthSpent += amt;
      } else if (yearMonth === lastYearMonth) {
        lastMonthSpent += amt;
      }
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + amt;
    }
  });

  // Calculate Month-over-Month change for spending
  let monthOverMonthPercent = 0;
  if (lastMonthSpent > 0) {
    monthOverMonthPercent = Math.round(((thisMonthSpent - lastMonthSpent) / lastMonthSpent) * 100);
  } else if (thisMonthSpent > 0) {
    monthOverMonthPercent = 100;
  }

  // Find Top Expense Category
  let topCategory: { category: string; amount: number } | null = null;
  Object.entries(categoryTotals).forEach(([cat, amt]) => {
    if (!topCategory || amt > topCategory.amount) {
      topCategory = { category: cat, amount: amt };
    }
  });

  const netCashFlow = totalIncome - totalSpent;
  const thisMonthNet = thisMonthIncome - thisMonthSpent;

  return {
    totalSpent: Math.round(totalSpent * 100) / 100,
    totalIncome: Math.round(totalIncome * 100) / 100,
    netCashFlow: Math.round(netCashFlow * 100) / 100,
    thisMonthSpent: Math.round(thisMonthSpent * 100) / 100,
    thisMonthIncome: Math.round(thisMonthIncome * 100) / 100,
    thisMonthNet: Math.round(thisMonthNet * 100) / 100,
    lastMonthSpent: Math.round(lastMonthSpent * 100) / 100,
    monthOverMonthPercent,
    topCategory,
    expenseCount,
    incomeCount,
    avgExpenseAmount: expenseCount > 0 ? Math.round((totalSpent / expenseCount) * 100) / 100 : 0,
  };
}

export function getMonthlyTrends(expenses: Expense[]): MonthlyTrendData[] {
  if (!expenses.length) return [];

  interface MonthBucket {
    totalExpenses: number;
    totalIncome: number;
    expenseCount: number;
    incomeCount: number;
    highestExpense: number;
    categories: Record<string, number>;
  }

  const monthMap: Record<string, MonthBucket> = {};

  expenses.forEach((exp) => {
    if (!exp.date) return;
    const yearMonth = exp.date.substring(0, 7); // 'YYYY-MM'
    if (!monthMap[yearMonth]) {
      monthMap[yearMonth] = {
        totalExpenses: 0,
        totalIncome: 0,
        expenseCount: 0,
        incomeCount: 0,
        highestExpense: 0,
        categories: {},
      };
    }

    const amt = Math.abs(exp.amount || 0);
    const isIncome = isIncomeTransaction(exp);

    if (isIncome) {
      monthMap[yearMonth].totalIncome += amt;
      monthMap[yearMonth].incomeCount += 1;
    } else {
      monthMap[yearMonth].totalExpenses += amt;
      monthMap[yearMonth].expenseCount += 1;
      if (amt > monthMap[yearMonth].highestExpense) {
        monthMap[yearMonth].highestExpense = amt;
      }
      monthMap[yearMonth].categories[exp.category] =
        (monthMap[yearMonth].categories[exp.category] || 0) + amt;
    }
  });

  // Sort chronologically by YYYY-MM
  const sortedMonths = Object.keys(monthMap).sort();

  return sortedMonths.map((ym) => {
    const [year, month] = ym.split('-');
    const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const monthName = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const bucket = monthMap[ym];
    const totalExp = Math.round(bucket.totalExpenses * 100) / 100;
    const totalInc = Math.round(bucket.totalIncome * 100) / 100;
    const net = Math.round((totalInc - totalExp) * 100) / 100;
    const savingsRate =
      totalInc > 0 ? Math.max(-100, Math.min(100, Math.round(((totalInc - totalExp) / totalInc) * 100))) : 0;
    const avgExp =
      bucket.expenseCount > 0 ? Math.round((totalExp / bucket.expenseCount) * 100) / 100 : 0;

    const item: MonthlyTrendData = {
      month: monthName,
      yearMonth: ym,
      total: totalExp, // default for backwards compatibility
      totalExpenses: totalExp,
      totalIncome: totalInc,
      netCashFlow: net,
      savingsRate,
      avgExpense: avgExp,
      highestExpense: Math.round(bucket.highestExpense * 100) / 100,
      count: bucket.expenseCount + bucket.incomeCount,
      expenseCount: bucket.expenseCount,
      incomeCount: bucket.incomeCount,
    };

    // Attach category breakdown to item
    Object.entries(bucket.categories).forEach(([cat, val]) => {
      item[cat] = Math.round(val * 100) / 100;
    });

    return item;
  });
}

export function getCategoryTrends(expenses: Expense[], selectedYearMonth?: string): CategoryTrendData[] {
  const filtered = selectedYearMonth && selectedYearMonth !== 'all'
    ? expenses.filter((e) => e.date?.startsWith(selectedYearMonth))
    : expenses;

  if (!filtered.length) return [];

  const totals: Record<string, number> = {};
  let overall = 0;

  filtered.forEach((exp) => {
    const amt = exp.amount || 0;
    totals[exp.category] = (totals[exp.category] || 0) + amt;
    overall += amt;
  });

  return Object.entries(totals)
    .map(([category, amount]) => ({
      name: category,
      value: Math.round(amount * 100) / 100,
      color: CATEGORY_COLORS[category] || '#64748b',
      percentage: overall > 0 ? Math.round((amount / overall) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}
