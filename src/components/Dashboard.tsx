import React, { useState, useEffect } from 'react';
import { Expense } from '../types';
import {
  calculateSpendingSummary,
  getCategoryTrends,
  formatCurrency,
  CATEGORY_COLORS,
} from '../lib/expenseUtils';
import { DraggableMetricCards } from './DraggableMetricCards';
import { TrendChart } from './TrendChart';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  IndianRupee,
  TrendingUp,
  TrendingDown,
  PieChart as PieIcon,
  Calendar,
  Layers,
  CreditCard,
  BarChart3,
  Receipt,
  Target,
  Pencil,
  Check,
  AlertTriangle,
  X,
  Sparkles,
} from 'lucide-react';

interface DashboardProps {
  expenses: Expense[];
  onOpenNewExpenseModal: () => void;
  onSeedSampleData?: () => void;
  isSeeding?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  expenses,
  onOpenNewExpenseModal,
  onSeedSampleData,
  isSeeding,
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Monthly Budget Target State
  const [monthlyBudget, setMonthlyBudget] = useState<number>(() => {
    const saved = localStorage.getItem('sheet_expense_monthly_budget');
    return saved ? parseFloat(saved) || 50000 : 50000;
  });
  const [isBudgetEnabled, setIsBudgetEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('sheet_expense_budget_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isEditingBudget, setIsEditingBudget] = useState<boolean>(false);
  const [tempBudgetInput, setTempBudgetInput] = useState<string>(String(monthlyBudget));

  useEffect(() => {
    localStorage.setItem('sheet_expense_monthly_budget', String(monthlyBudget));
  }, [monthlyBudget]);

  useEffect(() => {
    localStorage.setItem('sheet_expense_budget_enabled', JSON.stringify(isBudgetEnabled));
  }, [isBudgetEnabled]);

  const handleSaveBudget = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = parseFloat(tempBudgetInput);
    if (!isNaN(val) && val > 0) {
      setMonthlyBudget(val);
      setIsEditingBudget(false);
    }
  };

  const summary = calculateSpendingSummary(expenses);
  const categoryTrends = getCategoryTrends(expenses, selectedMonth);

  // Budget progress calculations
  const spentThisMonth = summary.thisMonthSpent;
  const budgetPercentage = monthlyBudget > 0 ? Math.round((spentThisMonth / monthlyBudget) * 100) : 0;
  const remainingBudget = monthlyBudget - spentThisMonth;
  const isOverBudget = remainingBudget < 0;

  // Determine progress bar color theme based on percentage
  const getProgressColor = () => {
    if (budgetPercentage >= 100) return 'bg-rose-500 shadow-rose-500/50';
    if (budgetPercentage >= 80) return 'bg-amber-500 shadow-amber-500/50';
    return 'bg-emerald-500 shadow-emerald-500/50';
  };

  const getProgressBadge = () => {
    if (isOverBudget) {
      return {
        label: `Over Budget by ${formatCurrency(Math.abs(remainingBudget))}`,
        className: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        icon: AlertTriangle,
      };
    }
    if (budgetPercentage >= 80) {
      return {
        label: `${budgetPercentage}% used (Near Limit)`,
        className: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        icon: AlertTriangle,
      };
    }
    return {
      label: `On Track (${100 - budgetPercentage}% remaining)`,
      className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      icon: Sparkles,
    };
  };

  const badgeInfo = getProgressBadge();
  const BadgeIcon = badgeInfo.icon;

  // Filter options for months
  const availableMonths: string[] = Array.from(
    new Set<string>(expenses.map((e) => e.date?.substring(0, 7)).filter((d): d is string => Boolean(d)))
  ).sort().reverse();

  // Payment Method Breakdown
  const paymentMethodData = React.useMemo(() => {
    const filtered = selectedMonth !== 'all'
      ? expenses.filter((e) => e.date?.startsWith(selectedMonth))
      : expenses;

    const pmTotals: Record<string, number> = {};
    filtered.forEach((e) => {
      const pm = e.paymentMethod || 'Other';
      pmTotals[pm] = (pmTotals[pm] || 0) + (e.amount || 0);
    });

    return Object.entries(pmTotals)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);
  }, [expenses, selectedMonth]);

  return (
    <div className="space-y-6">
      {/* Monthly Budget Tracker Banner / Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-xl relative overflow-hidden transition-all">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-colors ${
                isBudgetEnabled
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-slate-800/80 border-slate-700 text-slate-500'
              }`}>
                <Target className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Monthly Budget Target</span>
                {!isBudgetEnabled && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-xs font-semibold border border-slate-700">
                    Disabled
                  </span>
                )}
              </h3>
              {isBudgetEnabled && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeInfo.className}`}>
                  <BadgeIcon className="w-3 h-3" />
                  {badgeInfo.label}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {isBudgetEnabled
                ? "Track your current month's spending against your monthly target"
                : "Monthly budget tracking is turned off. Toggle on to monitor your monthly limit."}
            </p>
          </div>

          {/* Controls: On/Off Toggle & Budget Target Settings */}
          <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">
            {/* On/Off Switch */}
            <div className="flex items-center gap-2.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-xs font-semibold text-slate-400">
                {isBudgetEnabled ? 'ON' : 'OFF'}
              </span>
              <button
                type="button"
                onClick={() => setIsBudgetEnabled(!isBudgetEnabled)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isBudgetEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
                role="switch"
                aria-checked={isBudgetEnabled}
                title={isBudgetEnabled ? 'Turn Off Monthly Budget Target' : 'Turn On Monthly Budget Target'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isBudgetEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Target Value & Edit Button (Shown only when enabled) */}
            {isBudgetEnabled && (
              <>
                {isEditingBudget ? (
                  <form onSubmit={handleSaveBudget} className="flex items-center gap-2">
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        step="50"
                        min="1"
                        value={tempBudgetInput}
                        onChange={(e) => setTempBudgetInput(e.target.value)}
                        className="w-28 bg-slate-950 border border-emerald-500 rounded-lg pl-6 pr-2 py-1 text-xs font-bold text-slate-100 focus:outline-none"
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                      title="Save Budget Target"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingBudget(false)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-800">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">Target Budget</span>
                      <span className="text-sm font-extrabold text-slate-100">{formatCurrency(monthlyBudget)}</span>
                    </div>
                    <button
                      onClick={() => {
                        setTempBudgetInput(String(monthlyBudget));
                        setIsEditingBudget(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors ml-1"
                      title="Set Monthly Budget Target"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Progress Bar & Details (Shown only when enabled) */}
        {isBudgetEnabled && (
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300">
                Spent: <span className="text-white font-extrabold">{formatCurrency(spentThisMonth)}</span>
              </span>
              <span className="text-slate-400">
                {budgetPercentage}% of {formatCurrency(monthlyBudget)}
              </span>
              <span className={isOverBudget ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                {isOverBudget
                  ? `Over by ${formatCurrency(Math.abs(remainingBudget))}`
                  : `Remaining: ${formatCurrency(remainingBudget)}`}
              </span>
            </div>

            {/* Outer Track */}
            <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
              {/* Inner Bar */}
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor()}`}
                style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Top Drag & Drop KPI Metric Cards */}
      <DraggableMetricCards summary={summary} expenses={expenses} />

      {/* Trend Multi-Metric Comparison Chart */}
      <TrendChart
        expenses={expenses}
        onSeedSampleData={onSeedSampleData}
        isSeeding={isSeeding}
      />

      {/* Grid: Category Breakdown Pie + Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution Chart */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-purple-400" />
              Category Breakdown
            </h3>

            {/* Filter by month */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Months</option>
              {availableMonths.map((ym) => {
                const [y, m] = ym.split('-');
                const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
                return (
                  <option key={ym} value={ym}>
                    {d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </option>
                );
              })}
            </select>
          </div>

          {categoryTrends.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-slate-500 text-sm">
              No data for selected period
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryTrends}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryTrends.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '0.5rem',
                        color: '#f8fafc',
                      }}
                      formatter={(val: any) => [formatCurrency(Number(val)), 'Spent']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {categoryTrends.map((cat) => (
                  <div key={cat.name} className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-slate-800/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }}></span>
                      <span className="text-slate-300 font-medium truncate">{cat.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-slate-100">{formatCurrency(cat.value)}</span>
                      <span className="text-slate-500 ml-1.5">({cat.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Payment Methods Bar Chart */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-400" />
              Payment Methods
            </h3>
            <span className="text-xs text-slate-400">Total by Method</span>
          </div>

          {paymentMethodData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-slate-500 text-sm">
              No data for selected period
            </div>
          ) : (
            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentMethodData} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `₹${v}`} />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} width={90} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.5rem',
                      color: '#f8fafc',
                    }}
                    formatter={(val: any) => [formatCurrency(Number(val)), 'Amount']}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
