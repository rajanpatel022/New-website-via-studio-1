import React, { useState, useEffect } from 'react';
import { Expense, SpendingSummary } from '../types';
import { formatCurrency, isIncomeTransaction } from '../lib/expenseUtils';
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Receipt,
  Calendar,
  Percent,
  Calculator,
  Flame,
  Clock,
  Layers,
  GripVertical,
  X,
  Plus,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';

export type MetricCardId =
  | 'total_income'
  | 'total_expenses'
  | 'net_cash_flow'
  | 'this_month_spent'
  | 'this_month_income'
  | 'savings_rate'
  | 'avg_expense'
  | 'highest_expense'
  | 'today_spent'
  | 'transaction_count';

interface MetricCardDef {
  id: MetricCardId;
  title: string;
  category: 'core' | 'monthly' | 'analytics';
  description: string;
  defaultEnabled: boolean;
}

export const ALL_AVAILABLE_METRIC_CARDS: MetricCardDef[] = [
  {
    id: 'total_income',
    title: 'Total Income (+)',
    category: 'core',
    description: 'Sum of all positive earnings, salary, and deposits',
    defaultEnabled: true,
  },
  {
    id: 'total_expenses',
    title: 'Total Expenses (-)',
    category: 'core',
    description: 'Sum of all debit spends and outgoing transactions',
    defaultEnabled: true,
  },
  {
    id: 'net_cash_flow',
    title: 'Net Cash Flow',
    category: 'core',
    description: 'Difference between total income and total expenses',
    defaultEnabled: true,
  },
  {
    id: 'this_month_spent',
    title: 'This Month Spent',
    category: 'monthly',
    description: 'Current calendar month outgoing expenses and MoM trend',
    defaultEnabled: true,
  },
  {
    id: 'this_month_income',
    title: 'This Month Income',
    category: 'monthly',
    description: 'Earnings recorded in the current calendar month',
    defaultEnabled: false,
  },
  {
    id: 'savings_rate',
    title: 'Savings Rate %',
    category: 'analytics',
    description: 'Percentage of total earnings saved vs spent',
    defaultEnabled: false,
  },
  {
    id: 'avg_expense',
    title: 'Avg. Expense Size',
    category: 'analytics',
    description: 'Average ticket size per individual expense item',
    defaultEnabled: false,
  },
  {
    id: 'highest_expense',
    title: 'Highest Single Expense',
    category: 'analytics',
    description: 'Largest single outgoing purchase on record',
    defaultEnabled: false,
  },
  {
    id: 'today_spent',
    title: "Today's Spent",
    category: 'monthly',
    description: 'Total expenses recorded for the current day',
    defaultEnabled: false,
  },
  {
    id: 'transaction_count',
    title: 'Total Transactions',
    category: 'analytics',
    description: 'Total number of recorded ledger rows in Google Sheet',
    defaultEnabled: false,
  },
];

const DEFAULT_ACTIVE_CARDS: MetricCardId[] = [
  'total_income',
  'total_expenses',
  'net_cash_flow',
  'this_month_spent',
];

const STORAGE_KEY = 'sheet_expense_kpi_cards_order_v1';

interface DraggableMetricCardsProps {
  summary: SpendingSummary;
  expenses: Expense[];
}

export const DraggableMetricCards: React.FC<DraggableMetricCardsProps> = ({
  summary,
  expenses,
}) => {
  const [activeCards, setActiveCards] = useState<MetricCardId[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load metric card layout:', e);
    }
    return DEFAULT_ACTIVE_CARDS;
  });

  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [draggedCardIndex, setDraggedCardIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activeCards));
    } catch (e) {
      console.error('Failed to save metric cards layout:', e);
    }
  }, [activeCards]);

  // Derived calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todayExpenses = expenses.filter(
    (e) => e.date === todayStr && !isIncomeTransaction(e)
  );
  const todaySpent = todayExpenses.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const expenseItems = expenses.filter((e) => !isIncomeTransaction(e));
  const highestExpense = expenseItems.reduce(
    (max, curr) => (curr.amount > max ? curr.amount : max),
    0
  );

  const savingsRate =
    summary.totalIncome > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(((summary.totalIncome - summary.totalSpent) / summary.totalIncome) * 100)
          )
        )
      : 0;

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedCardIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedCardIndex === null || draggedCardIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedCardIndex === null || draggedCardIndex === targetIndex) {
      setDraggedCardIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...activeCards];
    const [movedItem] = updated.splice(draggedCardIndex, 1);
    updated.splice(targetIndex, 0, movedItem);

    setActiveCards(updated);
    setDraggedCardIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedCardIndex(null);
    setDragOverIndex(null);
  };

  const moveCard = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeCards.length) return;

    const updated = [...activeCards];
    const [item] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, item);
    setActiveCards(updated);
  };

  const removeCard = (id: MetricCardId) => {
    if (activeCards.length <= 1) {
      alert('You must keep at least one summary card.');
      return;
    }
    setActiveCards((prev) => prev.filter((cardId) => cardId !== id));
  };

  const toggleCard = (id: MetricCardId) => {
    if (activeCards.includes(id)) {
      removeCard(id);
    } else {
      setActiveCards((prev) => [...prev, id]);
    }
  };

  const resetToDefault = () => {
    setActiveCards(DEFAULT_ACTIVE_CARDS);
    setIsAddMenuOpen(false);
  };

  // Render individual card content
  const renderCardContent = (id: MetricCardId, index: number) => {
    switch (id) {
      case 'total_income':
        return (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                Total Income (+)
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <IndianRupee className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-400">
                +{formatCurrency(summary.totalIncome)}
              </h3>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <span>{summary.incomeCount} income records</span>
              </p>
            </div>
          </>
        );

      case 'total_expenses':
        return (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" />
                Total Expenses (-)
              </span>
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <IndianRupee className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-rose-300">
                -{formatCurrency(summary.totalSpent)}
              </h3>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <span>{summary.expenseCount} expense records</span>
              </p>
            </div>
          </>
        );

      case 'net_cash_flow':
        return (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Net Cash Flow
              </span>
              <div
                className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                  summary.netCashFlow >= 0
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                }`}
              >
                <Receipt className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3
                className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                  summary.netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {summary.netCashFlow >= 0 ? '+' : ''}
                {formatCurrency(summary.netCashFlow)}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {summary.netCashFlow >= 0 ? 'Positive net balance' : 'Net deficit'}
              </p>
            </div>
          </>
        );

      case 'this_month_spent':
        return (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                This Month Spent
              </span>
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {formatCurrency(summary.thisMonthSpent)}
              </h3>
              <div className="flex items-center gap-1.5 text-xs mt-1">
                {summary.monthOverMonthPercent <= 0 ? (
                  <span className="inline-flex items-center text-emerald-400 font-semibold gap-0.5">
                    <TrendingDown className="w-3.5 h-3.5" />
                    {Math.abs(summary.monthOverMonthPercent)}% vs last month
                  </span>
                ) : (
                  <span className="inline-flex items-center text-rose-400 font-semibold gap-0.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    +{summary.monthOverMonthPercent}% vs last month
                  </span>
                )}
              </div>
            </div>
          </>
        );

      case 'this_month_income':
        return (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">
                This Month Income
              </span>
              <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-teal-300">
                +{formatCurrency(summary.thisMonthIncome)}
              </h3>
              <p className="text-xs text-slate-400 mt-1">Current calendar month earnings</p>
            </div>
          </>
        );

      case 'savings_rate':
        return (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                Savings Rate %
              </span>
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Percent className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-sky-300">
                {savingsRate}%
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {savingsRate >= 20 ? 'Strong savings discipline' : 'Opportunity to save more'}
              </p>
            </div>
          </>
        );

      case 'avg_expense':
        return (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                Avg. Expense Size
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Calculator className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-amber-300">
                {formatCurrency(summary.avgExpenseAmount)}
              </h3>
              <p className="text-xs text-slate-400 mt-1">Per outgoing transaction</p>
            </div>
          </>
        );

      case 'highest_expense':
        return (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
                Highest Expense
              </span>
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                <Flame className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-orange-300">
                {formatCurrency(highestExpense)}
              </h3>
              <p className="text-xs text-slate-400 mt-1">Single largest ticket purchase</p>
            </div>
          </>
        );

      case 'today_spent':
        return (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">
                Today's Spent
              </span>
              <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-violet-300">
                {formatCurrency(todaySpent)}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {todayExpenses.length} transactions today
              </p>
            </div>
          </>
        );

      case 'transaction_count':
        return (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                Total Transactions
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-indigo-300">
                {expenses.length}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {summary.expenseCount} exp / {summary.incomeCount} inc
              </p>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      {/* Top Action Bar for Cards Customization */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          Key Performance Indicators ({activeCards.length})
        </span>

        <div className="flex items-center gap-2">
          {/* Add / Manage Cards Button */}
          <div className="relative">
            <button
              onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Customize Cards</span>
            </button>

            {/* Add / Toggle Dropdown Modal */}
            {isAddMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-40 p-3.5 text-xs text-slate-200 animate-fade-in divide-y divide-slate-800">
                <div className="flex items-center justify-between pb-2.5">
                  <div>
                    <h4 className="font-bold text-sm text-slate-100">Manage Summary Cards</h4>
                    <p className="text-[11px] text-slate-400">
                      Toggle cards to show, drag cards on grid to reorder
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAddMenuOpen(false)}
                    className="p-1 rounded-md text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="py-2 space-y-1.5 max-h-64 overflow-y-auto">
                  {ALL_AVAILABLE_METRIC_CARDS.map((card) => {
                    const isEnabled = activeCards.includes(card.id);
                    return (
                      <button
                        key={card.id}
                        onClick={() => toggleCard(card.id)}
                        className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                          isEnabled
                            ? 'bg-emerald-950/40 border border-emerald-500/30 text-slate-100'
                            : 'bg-slate-950/40 hover:bg-slate-800/60 border border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-xs text-slate-200 truncate">
                            {card.title}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">
                            {card.description}
                          </p>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                            isEnabled
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-slate-800 border-slate-700 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 flex items-center justify-between text-[11px]">
                  <button
                    onClick={resetToDefault}
                    className="text-slate-400 hover:text-amber-400 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Defaults</span>
                  </button>
                  <button
                    onClick={() => setIsAddMenuOpen(false)}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Draggable Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {activeCards.map((cardId, index) => {
          const isDragging = draggedCardIndex === index;
          const isOver = dragOverIndex === index;

          return (
            <div
              key={cardId}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`group relative p-5 rounded-2xl bg-slate-900 border text-slate-100 shadow-lg overflow-hidden transition-all select-none cursor-grab active:cursor-grabbing ${
                isDragging
                  ? 'opacity-40 scale-95 border-emerald-500/60'
                  : isOver
                  ? 'border-emerald-400 ring-2 ring-emerald-400/30 scale-[1.02]'
                  : 'border-slate-800 hover:border-slate-700 hover:shadow-xl'
              }`}
            >
              {/* Drag Handle & Reorder / Delete Controls (Visible on hover) */}
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950/80 backdrop-blur-md px-1.5 py-0.5 rounded-lg border border-slate-700/80 z-20">
                {/* Move Left */}
                {index > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveCard(index, 'left');
                    }}
                    className="p-1 text-slate-400 hover:text-white rounded transition-colors"
                    title="Move left"
                  >
                    <ArrowLeft className="w-3 h-3" />
                  </button>
                )}

                {/* Drag Grip Indicator */}
                <div
                  className="p-1 text-slate-400 hover:text-emerald-400 cursor-grab"
                  title="Drag and drop to reorder"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </div>

                {/* Move Right */}
                {index < activeCards.length - 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveCard(index, 'right');
                    }}
                    className="p-1 text-slate-400 hover:text-white rounded transition-colors"
                    title="Move right"
                  >
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}

                {/* Delete / Hide Card */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeCard(cardId);
                  }}
                  className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors"
                  title="Hide this card"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Card Main Content */}
              {renderCardContent(cardId, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
};
