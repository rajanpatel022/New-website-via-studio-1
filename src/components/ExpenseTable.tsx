import React, { useState, useMemo } from 'react';
import { Expense, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types';
import { formatCurrency, CATEGORY_COLORS, isIncomeTransaction } from '../lib/expenseUtils';
import {
  Search,
  Filter,
  ArrowUpDown,
  Edit2,
  Trash2,
  Download,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Tag,
  Loader2,
  CheckSquare,
  Square,
  X,
  ArrowUpCircle,
  ArrowDownCircle,
  Plus,
  Minus,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface ExpenseTableProps {
  expenses: Expense[];
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (rowIndex?: number, id?: string) => Promise<void> | void;
  onBatchDeleteExpenses?: (rowIndices: number[]) => Promise<void>;
  onBatchUpdateCategory?: (rowIndices: number[], category: string) => Promise<void>;
  sheetWebViewLink?: string;
}

export const ExpenseTable: React.FC<ExpenseTableProps> = ({
  expenses,
  onEditExpense,
  onDeleteExpense,
  onBatchDeleteExpenses,
  onBatchUpdateCategory,
  sheetWebViewLink,
}) => {
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortField, setSortField] = useState<'date' | 'amount' | 'category'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(20);

  // Multi-Selection state
  const [selectedRowIndices, setSelectedRowIndices] = useState<number[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [bulkCategorySelect, setBulkCategorySelect] = useState<string>('Total Spend');
  const [bulkCustomCategory, setBulkCustomCategory] = useState<string>('');

  // Delete confirmation modals state (Replaces blocking window.confirm for iframe reliability)
  const [itemToDelete, setItemToDelete] = useState<Expense | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState<boolean>(false);
  const [isDeletingItem, setIsDeletingItem] = useState<boolean>(false);

  // Counts & Totals for Tab Badges
  const typeStats = useMemo(() => {
    let incomeTotal = 0;
    let expenseTotal = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    expenses.forEach((e) => {
      const amt = Math.abs(e.amount || 0);
      if (isIncomeTransaction(e)) {
        incomeTotal += amt;
        incomeCount += 1;
      } else {
        expenseTotal += amt;
        expenseCount += 1;
      }
    });

    return {
      incomeTotal,
      expenseTotal,
      incomeCount,
      expenseCount,
      netTotal: incomeTotal - expenseTotal,
    };
  }, [expenses]);

  // Dynamic filter categories combining standard & custom lists
  const filterCategories = useMemo(() => {
    const customList = expenses.map((e) => e.category).filter(Boolean);
    const combined = new Set([
      ...EXPENSE_CATEGORIES.filter((c) => c !== 'Custom / Other...'),
      ...INCOME_CATEGORIES.filter((c) => c !== 'Custom / Other...'),
      ...customList,
    ]);
    return Array.from(combined).sort();
  }, [expenses]);

  // Filtering & Sorting
  const filteredAndSortedExpenses = useMemo(() => {
    return expenses
      .filter((exp) => {
        const isInc = isIncomeTransaction(exp);
        if (typeFilter === 'income' && !isInc) return false;
        if (typeFilter === 'expense' && isInc) return false;

        const matchesSearch =
          exp.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (exp.notes && exp.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (exp.paymentMethod && exp.paymentMethod.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesCategory =
          selectedCategory === 'all' || exp.category === selectedCategory;

        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];

        if (sortField === 'amount') {
          valA = Math.abs(Number(valA)) || 0;
          valB = Math.abs(Number(valB)) || 0;
        } else if (sortField === 'date') {
          valA = new Date(valA).getTime() || 0;
          valB = new Date(valB).getTime() || 0;
        } else {
          valA = String(valA).toLowerCase();
          valB = String(valB).toLowerCase();
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [expenses, typeFilter, searchQuery, selectedCategory, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedExpenses.length / itemsPerPage) || 1;
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedExpenses.slice(start, start + itemsPerPage);
  }, [filteredAndSortedExpenses, currentPage]);

  const toggleSort = (field: 'date' | 'amount' | 'category') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Selection handlers
  const toggleSelectRow = (rowIndex: number) => {
    setSelectedRowIndices((prev) =>
      prev.includes(rowIndex) ? prev.filter((i) => i !== rowIndex) : [...prev, rowIndex]
    );
  };

  const toggleSelectAllOnPage = () => {
    const pageRowIndices = paginatedExpenses
      .map((e) => e.rowIndex)
      .filter((r): r is number => r !== undefined);

    const allSelected = pageRowIndices.every((r) => selectedRowIndices.includes(r));
    if (allSelected) {
      setSelectedRowIndices((prev) => prev.filter((r) => !pageRowIndices.includes(r)));
    } else {
      setSelectedRowIndices((prev) => Array.from(new Set([...prev, ...pageRowIndices])));
    }
  };

  const clearSelection = () => {
    setSelectedRowIndices([]);
  };

  // Bulk execution handlers
  const handleExecuteBulkDelete = () => {
    if (selectedRowIndices.length === 0 || !onBatchDeleteExpenses) return;
    setShowBulkDeleteConfirm(true);
  };

  const confirmAndPerformBulkDelete = async () => {
    if (!onBatchDeleteExpenses || selectedRowIndices.length === 0) return;
    setIsBatchProcessing(true);
    try {
      await onBatchDeleteExpenses(selectedRowIndices);
      setSelectedRowIndices([]);
      setShowBulkDeleteConfirm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const confirmAndPerformSingleDelete = async () => {
    if (!itemToDelete) return;
    setIsDeletingItem(true);
    try {
      await onDeleteExpense(itemToDelete.rowIndex, itemToDelete.id);
      setItemToDelete(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeletingItem(false);
    }
  };

  const handleExecuteBulkCategory = async () => {
    if (selectedRowIndices.length === 0 || !onBatchUpdateCategory) return;

    const targetCategory =
      bulkCategorySelect === 'Custom / Other...' ? bulkCustomCategory.trim() : bulkCategorySelect;

    if (!targetCategory) {
      return;
    }

    setIsBatchProcessing(true);
    try {
      await onBatchUpdateCategory(selectedRowIndices, targetCategory);
      setSelectedRowIndices([]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const exportToCSV = () => {
    if (!expenses.length) return;
    const headers = ['ID', 'Date', 'Type', 'Category', 'Extra', 'Payment Method', 'Amount (₹)'];
    const rows = expenses.map((e) => [
      e.id,
      e.date,
      `"${isIncomeTransaction(e) ? 'Income' : 'Expense'}"`,
      `"${e.category}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`,
      `"${e.paymentMethod || 'Other'}"`,
      e.amount,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Expense_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-xl space-y-4">
      {/* Transaction Type Segmented Tab Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 self-start">
          <button
            onClick={() => {
              setTypeFilter('all');
              setCurrentPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              typeFilter === 'all'
                ? 'bg-slate-800 text-slate-100 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>All Transactions ({expenses.length})</span>
          </button>

          <button
            onClick={() => {
              setTypeFilter('income');
              setCurrentPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              typeFilter === 'income'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow'
                : 'text-slate-400 hover:text-emerald-400'
            }`}
          >
            <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Income (+)</span>
            <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-extrabold">
              {typeStats.incomeCount}
            </span>
          </button>

          <button
            onClick={() => {
              setTypeFilter('expense');
              setCurrentPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              typeFilter === 'expense'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow'
                : 'text-slate-400 hover:text-rose-400'
            }`}
          >
            <ArrowDownCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Expenses (-)</span>
            <span className="px-1.5 py-0.2 bg-rose-500/20 text-rose-300 rounded text-[10px] font-extrabold">
              {typeStats.expenseCount}
            </span>
          </button>
        </div>

        {/* Quick Cash Flow Summary Pill */}
        <div className="flex items-center gap-3 bg-slate-950 px-3.5 py-1.5 rounded-xl border border-slate-800 text-xs self-end sm:self-auto">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <Plus className="w-3 h-3 stroke-[3]" />
            <span>{formatCurrency(typeStats.incomeTotal)}</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5 text-rose-400 font-bold">
            <Minus className="w-3 h-3 stroke-[3]" />
            <span>{formatCurrency(typeStats.expenseTotal)}</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className={`font-extrabold flex items-center gap-1 ${
            typeStats.netTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            <span className="text-[10px] text-slate-500 uppercase">Net:</span>
            <span>{formatCurrency(typeStats.netTotal)}</span>
          </div>
        </div>
      </div>

      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            {typeFilter === 'income' ? 'Income Ledger (+)' : typeFilter === 'expense' ? 'Expense Ledger (-)' : 'Transaction Ledger'}
          </h3>
          <p className="text-xs text-slate-400">
            Real-time rows stored in Google Sheets ({filteredAndSortedExpenses.length} entries)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64 min-w-[180px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Categories</option>
              {filterCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Rows Per Page Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <span className="text-slate-400 font-medium">Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-transparent font-bold text-emerald-400 focus:outline-none cursor-pointer"
            >
              <option value={10} className="bg-slate-900 text-slate-200">10 rows</option>
              <option value={20} className="bg-slate-900 text-slate-200">20 rows</option>
              <option value={50} className="bg-slate-900 text-slate-200">50 rows</option>
              <option value={100} className="bg-slate-900 text-slate-200">100 rows</option>
              <option value={10000} className="bg-slate-900 text-slate-200">All rows</option>
            </select>
          </div>

          {/* Export CSV */}
          <button
            onClick={exportToCSV}
            disabled={!expenses.length}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-40"
            title="Export CSV file"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* View in Google Sheets Link */}
          {sheetWebViewLink && (
            <a
              href={sheetWebViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold border border-emerald-500/30 flex items-center gap-1.5 transition-colors"
            >
              <span>Google Sheets</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Bulk Actions Floating Toolbar */}
      {selectedRowIndices.length > 0 && (
        <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/50 text-slate-100 flex flex-wrap items-center justify-between gap-3 shadow-xl transition-all animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-extrabold text-xs border border-emerald-500/40">
              {selectedRowIndices.length} Selected
            </span>
            <button
              onClick={clearSelection}
              className="text-xs text-slate-400 hover:text-slate-200 underline font-medium flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Deselect All</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Bulk Category Selector */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg p-1">
              <select
                value={bulkCategorySelect}
                onChange={(e) => setBulkCategorySelect(e.target.value)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none px-2 py-1"
                disabled={isBatchProcessing}
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-slate-900">
                    {cat}
                  </option>
                ))}
              </select>
              {bulkCategorySelect === 'Custom / Other...' && (
                <input
                  type="text"
                  placeholder="New Category..."
                  value={bulkCustomCategory}
                  onChange={(e) => setBulkCustomCategory(e.target.value)}
                  disabled={isBatchProcessing}
                  className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 min-w-[120px]"
                />
              )}
              <button
                onClick={handleExecuteBulkCategory}
                disabled={isBatchProcessing}
                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 disabled:opacity-50 transition-colors"
                title="Change category for selected items"
              >
                {isBatchProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Tag className="w-3 h-3" />}
                <span>Apply Category</span>
              </button>
            </div>

            {/* Bulk Delete Button */}
            <button
              onClick={handleExecuteBulkDelete}
              disabled={isBatchProcessing}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50 transition-colors"
              title="Delete selected expense rows"
            >
              {isBatchProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>Delete ({selectedRowIndices.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase font-semibold tracking-wider border-b border-slate-800">
            <tr>
              {/* Select All Checkbox Header */}
              <th className="px-3 py-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={
                    paginatedExpenses.length > 0 &&
                    paginatedExpenses.every(
                      (e) => e.rowIndex !== undefined && selectedRowIndices.includes(e.rowIndex)
                    )
                  }
                  onChange={toggleSelectAllOnPage}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-950 cursor-pointer accent-emerald-500"
                  title="Select/Deselect all rows on this page"
                />
              </th>
              <th className="px-4 py-3 cursor-pointer hover:text-slate-200" onClick={() => toggleSort('date')}>
                <div className="flex items-center gap-1">
                  <span>Date</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="px-4 py-3 cursor-pointer hover:text-slate-200" onClick={() => toggleSort('category')}>
                <div className="flex items-center gap-1">
                  <span>Category</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="px-4 py-3">Extra</th>
              <th className="px-4 py-3">Payment Method</th>
              <th className="px-4 py-3 cursor-pointer hover:text-slate-200 text-right" onClick={() => toggleSort('amount')}>
                <div className="flex items-center justify-end gap-1">
                  <span>Amount</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
            {paginatedExpenses.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No matching transaction records found.
                </td>
              </tr>
            ) : (
              paginatedExpenses.map((exp) => {
                const isSelected = exp.rowIndex ? selectedRowIndices.includes(exp.rowIndex) : false;
                const isInc = isIncomeTransaction(exp);

                return (
                  <tr
                    key={exp.id + exp.rowIndex}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-emerald-950/30 hover:bg-emerald-950/40'
                        : isInc
                        ? 'hover:bg-emerald-950/20'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Checkbox Column */}
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => exp.rowIndex && toggleSelectRow(exp.rowIndex)}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-950 cursor-pointer accent-emerald-500"
                      />
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 font-medium text-slate-200 whitespace-nowrap">
                      {exp.date}
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: `${CATEGORY_COLORS[exp.category] || '#64748b'}20`,
                          color: CATEGORY_COLORS[exp.category] || '#94a3b8',
                          border: `1px solid ${CATEGORY_COLORS[exp.category] || '#64748b'}40`,
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: CATEGORY_COLORS[exp.category] || '#64748b' }}
                        />
                        <span>{exp.category}</span>
                      </span>
                    </td>

                    {/* Extra */}
                    <td className="px-4 py-3">
                      {exp.notes ? (
                        <span className="text-xs text-slate-300 truncate max-w-[220px] block" title={exp.notes}>
                          {exp.notes}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>

                    {/* Payment Method */}
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {exp.paymentMethod || 'Other'}
                    </td>

                    {/* Amount */}
                    <td className={`px-4 py-3 text-right font-extrabold whitespace-nowrap ${
                      isInc ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {isInc ? `+ ${formatCurrency(Math.abs(exp.amount))}` : `- ${formatCurrency(Math.abs(exp.amount))}`}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEditExpense(exp)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 transition-colors cursor-pointer"
                          title="Edit transaction"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setItemToDelete(exp)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 transition-colors cursor-pointer"
                          title="Delete transaction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {filteredAndSortedExpenses.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              Showing {paginatedExpenses.length} of {filteredAndSortedExpenses.length} entries (Page {currentPage} of {totalPages})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>Rows per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-emerald-400 font-semibold focus:outline-none cursor-pointer"
              >
                <option value={10} className="bg-slate-900 text-slate-200">10</option>
                <option value={20} className="bg-slate-900 text-slate-200">20</option>
                <option value={50} className="bg-slate-900 text-slate-200">50</option>
                <option value={100} className="bg-slate-900 text-slate-200">100</option>
                <option value={10000} className="bg-slate-900 text-slate-200">All</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 disabled:opacity-40 hover:bg-slate-700"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 disabled:opacity-40 hover:bg-slate-700"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Item Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-100">Delete Transaction?</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Are you sure you want to permanently remove this transaction from your records?
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
              <div className="space-y-1">
                <div className="font-semibold text-slate-200 flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: CATEGORY_COLORS[itemToDelete.category] || '#64748b' }}
                  />
                  <span>{itemToDelete.category}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {itemToDelete.date} • {itemToDelete.paymentMethod || 'Other'}
                  {itemToDelete.notes ? ` • "${itemToDelete.notes}"` : ''}
                </div>
              </div>
              <div className={`text-sm font-extrabold whitespace-nowrap ${
                isIncomeTransaction(itemToDelete) ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {isIncomeTransaction(itemToDelete) ? `+ ${formatCurrency(Math.abs(itemToDelete.amount))}` : `- ${formatCurrency(Math.abs(itemToDelete.amount))}`}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={isDeletingItem}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAndPerformSingleDelete}
                disabled={isDeletingItem}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeletingItem ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeletingItem ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="text-base font-bold text-slate-100">Delete {selectedRowIndices.length} Transactions?</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  This will permanently delete the {selectedRowIndices.length} selected transaction row(s) from your Google Sheet database.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={isBatchProcessing}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAndPerformBulkDelete}
                disabled={isBatchProcessing}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isBatchProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isBatchProcessing ? 'Deleting...' : `Delete ${selectedRowIndices.length} Rows`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
