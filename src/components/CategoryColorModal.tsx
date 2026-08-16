import React, { useState, useEffect } from 'react';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types';
import {
  DEFAULT_CATEGORY_COLORS,
  COLOR_PALETTE_PRESETS,
  getCustomCategoryColors,
  saveCategoryColor,
  resetCategoryColors,
  getCategoryColor,
} from '../lib/expenseUtils';
import { Palette, X, RotateCcw, Search, Check, Sparkles, Tag } from 'lucide-react';

interface CategoryColorModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCustomCategories?: string[];
}

export const CategoryColorModal: React.FC<CategoryColorModalProps> = ({
  isOpen,
  onClose,
  existingCustomCategories = [],
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'expense' | 'income'>('all');
  const [search, setSearch] = useState('');
  const [customColors, setCustomColors] = useState<Record<string, string>>({});
  const [activePickerCategory, setActivePickerCategory] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCustomColors(getCustomCategoryColors());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Combine standard and custom categories
  const expenseList = EXPENSE_CATEGORIES.filter((c) => c !== 'Custom / Other...');
  const incomeList = INCOME_CATEGORIES.filter((c) => c !== 'Custom / Other...');
  const extraCustomList = existingCustomCategories.filter(
    (c) => c && !expenseList.includes(c) && !incomeList.includes(c)
  );

  const categoriesToDisplay = [
    ...(activeTab === 'all' || activeTab === 'expense'
      ? expenseList.map((c) => ({ name: c, type: 'Expense' as const }))
      : []),
    ...(activeTab === 'all' || activeTab === 'income'
      ? incomeList.map((c) => ({ name: c, type: 'Income' as const }))
      : []),
    ...(activeTab === 'all'
      ? extraCustomList.map((c) => ({ name: c, type: 'Custom' as const }))
      : []),
  ].filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));

  const handleColorSelect = (category: string, hexColor: string) => {
    saveCategoryColor(category, hexColor);
    setCustomColors((prev) => ({ ...prev, [category]: hexColor }));
  };

  const handleReset = () => {
    if (confirm('Reset all category colors to default?')) {
      resetCategoryColors();
      setCustomColors({});
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">Category Color Coding</h3>
              <p className="text-xs text-slate-400">
                Choose custom colors and palette coding for your transaction categories
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex flex-wrap items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                activeTab === 'all'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Categories
            </button>
            <button
              onClick={() => setActiveTab('expense')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                activeTab === 'expense'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Expenses
            </button>
            <button
              onClick={() => setActiveTab('income')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                activeTab === 'income'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Income
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Reset button */}
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-amber-400 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            title="Reset all colors to default"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Defaults</span>
          </button>
        </div>

        {/* Category List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 divide-y divide-slate-800/60">
          {categoriesToDisplay.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              No categories matching "{search}"
            </div>
          ) : (
            categoriesToDisplay.map((item) => {
              const currentColor = getCategoryColor(item.name, customColors);
              const isCustomized = !!customColors[item.name];

              return (
                <div
                  key={item.name}
                  className="pt-3 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    {/* Color Swatch Preview */}
                    <div
                      className="w-7 h-7 rounded-lg shadow-inner flex items-center justify-center border border-white/10 shrink-0"
                      style={{ backgroundColor: currentColor }}
                    >
                      <Tag className="w-3.5 h-3.5 text-white drop-shadow" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-200">
                          {item.name}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold uppercase ${
                            item.type === 'Income'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : item.type === 'Expense'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-indigo-500/20 text-indigo-400'
                          }`}
                        >
                          {item.type}
                        </span>
                        {isCustomized && (
                          <span className="text-[10px] text-amber-400 font-medium bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                            Customized
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {currentColor.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {/* Preset Swatches + Color Picker */}
                  <div className="flex items-center gap-1.5 flex-wrap sm:justify-end">
                    {COLOR_PALETTE_PRESETS.slice(0, 8).map((preset) => (
                      <button
                        key={preset}
                        onClick={() => handleColorSelect(item.name, preset)}
                        className={`w-5 h-5 rounded-full transition-transform hover:scale-125 cursor-pointer relative flex items-center justify-center ${
                          currentColor.toLowerCase() === preset.toLowerCase()
                            ? 'ring-2 ring-white scale-110'
                            : 'opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: preset }}
                        title={`Select ${preset}`}
                      >
                        {currentColor.toLowerCase() === preset.toLowerCase() && (
                          <Check className="w-3 h-3 text-white drop-shadow stroke-[3]" />
                        )}
                      </button>
                    ))}

                    {/* Native Color Picker for custom Hex selection */}
                    <label
                      className="relative w-6 h-6 rounded-lg border border-slate-700 bg-slate-800 flex items-center justify-center cursor-pointer hover:border-emerald-400 transition-colors"
                      title="Open full color picker"
                    >
                      <input
                        type="color"
                        value={currentColor}
                        onChange={(e) => handleColorSelect(item.name, e.target.value)}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                      <Palette className="w-3.5 h-3.5 text-slate-300" />
                    </label>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            Colors are saved automatically and applied across tables and charts.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
