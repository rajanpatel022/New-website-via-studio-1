import React, { useState, useEffect } from 'react';
import { Expense, EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS, TransactionType } from '../types';
import {
  isIncomeTransaction,
  getCategoryColor,
  saveCategoryColor,
  COLOR_PALETTE_PRESETS,
} from '../lib/expenseUtils';
import {
  X,
  Loader2,
  Calendar,
  IndianRupee,
  Tag,
  CreditCard,
  Check,
  ArrowDownCircle,
  ArrowUpCircle,
  Palette,
  AlignLeft,
} from 'lucide-react';

interface ExpenseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Partial<Expense>) => Promise<void>;
  editingExpense?: Expense | null;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  isOpen,
  onClose,
  onSave,
  editingExpense,
}) => {
  // Transaction Type State
  const [transactionType, setTransactionType] = useState<TransactionType>('expense');

  // Form State
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('Total Spend');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Other');
  const [notes, setNotes] = useState<string>('');

  // Category Color State
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);
  const [categoryColor, setCategoryColor] = useState<string>('#ef4444');

  // Saving State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Active targeted category name
  const effectiveCategoryName =
    category === 'Custom / Other...'
      ? customCategory.trim() || 'Custom Category'
      : category;

  useEffect(() => {
    if (effectiveCategoryName) {
      setCategoryColor(getCategoryColor(effectiveCategoryName));
    }
  }, [category, customCategory]);

  useEffect(() => {
    if (editingExpense) {
      const isInc = isIncomeTransaction(editingExpense);
      const initialType: TransactionType = isInc ? 'income' : 'expense';
      setTransactionType(initialType);

      setDate(editingExpense.date || new Date().toISOString().split('T')[0]);
      setAmount(editingExpense.amount ? String(Math.abs(editingExpense.amount)) : '');

      const catList = initialType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      const cat = editingExpense.category || (initialType === 'income' ? 'Salary' : 'Total Spend');
      const isStd = catList.includes(cat) && cat !== 'Custom / Other...';
      if (isStd) {
        setCategory(cat);
        setCustomCategory('');
        setCategoryColor(getCategoryColor(cat));
      } else {
        setCategory('Custom / Other...');
        setCustomCategory(cat);
        setCategoryColor(getCategoryColor(cat));
      }

      setPaymentMethod(editingExpense.paymentMethod || 'Other');
      setNotes(editingExpense.notes || '');
    } else {
      resetForm();
    }
  }, [editingExpense, isOpen]);

  const handleTypeChange = (newType: TransactionType) => {
    setTransactionType(newType);
    if (newType === 'income') {
      setCategory('Salary');
      setCategoryColor(getCategoryColor('Salary'));
    } else {
      setCategory('Total Spend');
      setCategoryColor(getCategoryColor('Total Spend'));
    }
    setCustomCategory('');
  };

  const handleColorChange = (newHex: string) => {
    setCategoryColor(newHex);
    if (effectiveCategoryName && effectiveCategoryName !== 'Custom / Other...') {
      saveCategoryColor(effectiveCategoryName, newHex);
    }
  };

  const resetForm = () => {
    setTransactionType('expense');
    setDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setCategory('Total Spend');
    setCategoryColor(getCategoryColor('Total Spend'));
    setCustomCategory('');
    setPaymentMethod('Other');
    setNotes('');
    setShowColorPicker(false);
    setFormError(null);
  };

  if (!isOpen) return null;

  const activeCategoryList = transactionType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Please enter a valid positive amount.');
      return;
    }

    if (category === 'Custom / Other...' && !customCategory.trim()) {
      setFormError('Please enter a custom category name.');
      return;
    }

    const finalCategory = category === 'Custom / Other...' ? customCategory.trim() : category;

    setIsSubmitting(true);
    try {
      await onSave({
        id: editingExpense?.id,
        rowIndex: editingExpense?.rowIndex,
        date,
        amount: numAmount,
        type: transactionType,
        category: finalCategory || (transactionType === 'income' ? 'Miscellaneous Income' : 'Miscellaneous'),
        paymentMethod: paymentMethod || 'Other',
        notes: notes.trim(),
      });
      onClose();
      resetForm();
    } catch (err: any) {
      console.error('Error saving transaction:', err);
      setFormError(err.message || 'Failed to save transaction to Google Sheet. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base">
              {editingExpense ? 'Edit Transaction' : 'Add New Transaction'}
            </h3>
            <span className={`px-2 py-0.5 text-[10px] uppercase font-extrabold rounded-full ${
              transactionType === 'income' 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}>
              {transactionType === 'income' ? '+ Income' : '- Expense'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <span className="font-semibold">⚠️ {formError}</span>
              </div>
            )}

            {/* Transaction Type Segmented Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Transaction Type
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleTypeChange('expense')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    transactionType === 'expense'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ArrowDownCircle className="w-4 h-4 text-rose-400" />
                  <span>Expense (-)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeChange('income')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    transactionType === 'income'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
                  <span>Income (+)</span>
                </button>
              </div>
            </div>

            {/* Date & Amount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                  <IndianRupee className="w-3.5 h-3.5" /> Amount (₹)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className={`w-full bg-slate-950 border rounded-lg pl-8 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none ${
                      transactionType === 'income'
                        ? 'border-emerald-500/50 focus:border-emerald-400'
                        : 'border-slate-700 focus:border-emerald-500'
                    }`}
                  />
                  <span className={`absolute left-3 top-2.5 text-xs font-bold ${
                    transactionType === 'income' ? 'text-emerald-400' : 'text-slate-400'
                  }`}>
                    {transactionType === 'income' ? '+' : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Category & Payment Method */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" /> Category
                  </label>

                  {/* Color Picker Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                    title="Change category color"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full ring-1 ring-white/30 shrink-0"
                      style={{ backgroundColor: categoryColor }}
                    />
                    <Palette className="w-3 h-3 text-slate-400" />
                    <span>Color</span>
                  </button>
                </div>

                <div className="relative flex items-center">
                  <span
                    className="absolute left-3 w-3 h-3 rounded-full pointer-events-none ring-1 ring-white/20"
                    style={{ backgroundColor: categoryColor }}
                  />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    {activeCategoryList.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Color Picker Popover Dropdown */}
                {showColorPicker && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 animate-fade-in">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-300">
                        Choose Color for "{effectiveCategoryName}"
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowColorPicker(false)}
                        className="text-slate-400 hover:text-white p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-8 gap-1.5 mb-2.5">
                      {COLOR_PALETTE_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            handleColorChange(preset);
                          }}
                          className={`w-6 h-6 rounded-full transition-transform hover:scale-125 cursor-pointer relative flex items-center justify-center ${
                            categoryColor.toLowerCase() === preset.toLowerCase()
                              ? 'ring-2 ring-white scale-110'
                              : 'opacity-80 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: preset }}
                          title={preset}
                        >
                          {categoryColor.toLowerCase() === preset.toLowerCase() && (
                            <Check className="w-3 h-3 text-white drop-shadow stroke-[3]" />
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Custom Hex Color Input */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                      <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer bg-slate-950 px-2 py-1 rounded border border-slate-700 hover:border-slate-500">
                        <input
                          type="color"
                          value={categoryColor}
                          onChange={(e) => handleColorChange(e.target.value)}
                          className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 p-0"
                        />
                        <span className="text-[11px] font-mono text-slate-300">
                          {categoryColor.toUpperCase()}
                        </span>
                      </label>
                      <span className="text-[10px] text-slate-500">Custom Picker</span>
                    </div>
                  </div>
                )}

                {category === 'Custom / Other...' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder="Type custom category name..."
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-emerald-500/60 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5" /> Payment Method / Account
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm} value={pm}>
                      {pm}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Extra Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
                  <AlignLeft className="w-3.5 h-3.5" /> Extra
                </label>
                <span className="text-[10px] text-slate-500 font-normal">Optional</span>
              </div>
              <input
                type="text"
                placeholder="Any extra details, remarks, or notes (optional)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Submit Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg font-semibold text-sm shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50 text-white bg-emerald-600 hover:bg-emerald-500 cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>{editingExpense ? 'Update Record' : 'Save to Sheet'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
