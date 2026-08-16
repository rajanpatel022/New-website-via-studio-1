import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Expense } from '../types';
import {
  getMonthlyTrends,
  formatCurrency,
  CATEGORY_COLORS,
} from '../lib/expenseUtils';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Receipt,
  Layers,
  Percent,
  Calculator,
  Flame,
  BarChart3,
  SlidersHorizontal,
  Check,
  RotateCcw,
  X,
  Sparkles,
  PieChart as PieIcon,
  Eye,
  ChevronDown,
  Plus,
  BookmarkPlus,
  Trash2,
} from 'lucide-react';

export type TrendMetricId =
  | 'totalExpenses'
  | 'totalIncome'
  | 'netCashFlow'
  | 'savingsRate'
  | 'avgExpense'
  | 'highestExpense'
  | 'count'
  | string; // For categories

export interface TrendPreset {
  id: string;
  name: string;
  metricIds: TrendMetricId[];
  isCustom?: boolean;
}

interface MetricOption {
  id: TrendMetricId;
  label: string;
  group: 'financial' | 'ratios' | 'category';
  color: string;
  type: 'currency' | 'percent' | 'count';
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
}

const BASE_METRIC_OPTIONS: MetricOption[] = [
  {
    id: 'totalExpenses',
    label: 'Total Expenses (-)',
    group: 'financial',
    color: '#f43f5e', // Rose-500
    type: 'currency',
    description: 'Monthly sum of outgoing expenses and spends',
    icon: TrendingDown,
  },
  {
    id: 'totalIncome',
    label: 'Total Income (+)',
    group: 'financial',
    color: '#10b981', // Emerald-500
    type: 'currency',
    description: 'Monthly incoming earnings, salary, and deposits',
    icon: TrendingUp,
  },
  {
    id: 'netCashFlow',
    label: 'Net Cash Flow',
    group: 'financial',
    color: '#3b82f6', // Blue-500
    type: 'currency',
    description: 'Monthly surplus or deficit (Income - Expenses)',
    icon: Receipt,
  },
  {
    id: 'savingsRate',
    label: 'Savings Rate %',
    group: 'ratios',
    color: '#06b6d4', // Cyan-500
    type: 'percent',
    description: 'Percentage of earnings saved vs spent per month',
    icon: Percent,
  },
  {
    id: 'avgExpense',
    label: 'Avg. Expense Size',
    group: 'financial',
    color: '#f59e0b', // Amber-500
    type: 'currency',
    description: 'Average spent per individual expense transaction',
    icon: Calculator,
  },
  {
    id: 'highestExpense',
    label: 'Highest Single Expense',
    group: 'financial',
    color: '#f97316', // Orange-500
    type: 'currency',
    description: 'Peak individual purchase amount in that month',
    icon: Flame,
  },
  {
    id: 'count',
    label: 'Transaction Count',
    group: 'ratios',
    color: '#a855f7', // Purple-500
    type: 'count',
    description: 'Total number of transactions logged per month',
    icon: Layers,
  },
];

const DEFAULT_PRESETS: TrendPreset[] = [
  {
    id: 'preset_expenses',
    name: 'Expenses Only',
    metricIds: ['totalExpenses'],
  },
  {
    id: 'preset_income_vs_expense',
    name: 'Income vs Expenses (2)',
    metricIds: ['totalExpenses', 'totalIncome'],
  },
  {
    id: 'preset_cash_flow',
    name: 'Cash Flow & Net (3)',
    metricIds: ['totalExpenses', 'totalIncome', 'netCashFlow'],
  },
  {
    id: 'preset_all_core',
    name: 'All Core Metrics (4)',
    metricIds: ['totalExpenses', 'totalIncome', 'netCashFlow', 'savingsRate'],
  },
  {
    id: 'preset_categories',
    name: 'Top Categories',
    metricIds: ['__dynamic_top_categories__'],
  },
];

const STORAGE_METRICS_KEY = 'sheet_expense_trend_custom_metrics_v2';
const STORAGE_PRESETS_KEY = 'sheet_expense_trend_custom_presets_v1';
const DEFAULT_SELECTED_METRICS: TrendMetricId[] = ['totalExpenses'];

interface TrendChartProps {
  expenses: Expense[];
  onSeedSampleData?: () => void;
  isSeeding?: boolean;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  expenses,
  onSeedSampleData,
  isSeeding,
}) => {
  const [selectedMetrics, setSelectedMetrics] = useState<TrendMetricId[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_METRICS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load custom trend metrics:', e);
    }
    return DEFAULT_SELECTED_METRICS;
  });

  const [presets, setPresets] = useState<TrendPreset[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_PRESETS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load trend presets:', e);
    }
    return DEFAULT_PRESETS;
  });

  const [isCustomizeOpen, setIsCustomizeOpen] = useState<boolean>(false);
  const [isAddingPreset, setIsAddingPreset] = useState<boolean>(false);
  const [newPresetName, setNewPresetName] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const newPresetInputRef = useRef<HTMLInputElement>(null);

  // Save selected metrics to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_METRICS_KEY, JSON.stringify(selectedMetrics));
    } catch (e) {
      console.error('Failed to save trend metrics:', e);
    }
  }, [selectedMetrics]);

  // Save presets to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PRESETS_KEY, JSON.stringify(presets));
    } catch (e) {
      console.error('Failed to save trend presets:', e);
    }
  }, [presets]);

  // Focus input when adding preset
  useEffect(() => {
    if (isAddingPreset && newPresetInputRef.current) {
      newPresetInputRef.current.focus();
    }
  }, [isAddingPreset]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCustomizeOpen(false);
        setIsAddingPreset(false);
      }
    }
    if (isCustomizeOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCustomizeOpen]);

  const monthlyTrends = useMemo(() => getMonthlyTrends(expenses), [expenses]);

  // Discover all distinct categories from expenses
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => {
      if (e.category) set.add(e.category);
    });
    return Array.from(set).sort();
  }, [expenses]);

  // Build full options list dynamically combining base metrics + detected categories
  const allMetricOptions = useMemo<MetricOption[]>(() => {
    const list = [...BASE_METRIC_OPTIONS];
    availableCategories.forEach((cat) => {
      list.push({
        id: cat,
        label: `${cat}`,
        group: 'category',
        color: CATEGORY_COLORS[cat] || '#818cf8',
        type: 'currency',
        description: `Monthly spending strictly for ${cat}`,
      });
    });
    return list;
  }, [availableCategories]);

  // Toggle a metric option
  const toggleMetric = (id: TrendMetricId) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) {
          // Keep at least 1
          return prev;
        }
        return prev.filter((m) => m !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Apply a preset
  const applyPreset = (preset: TrendPreset) => {
    if (preset.metricIds.includes('__dynamic_top_categories__')) {
      const topCats = availableCategories.slice(0, 4);
      setSelectedMetrics(topCats.length > 0 ? topCats : ['totalExpenses']);
    } else {
      setSelectedMetrics(preset.metricIds.length > 0 ? preset.metricIds : ['totalExpenses']);
    }
  };

  // Delete a preset
  const deletePreset = (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPresets((prev) => prev.filter((p) => p.id !== presetId));
  };

  // Start adding new preset
  const handleStartAddPreset = () => {
    setIsAddingPreset(true);
    setNewPresetName('');
  };

  // Save the new preset
  const handleSaveNewPreset = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newPresetName.trim();
    const finalName =
      trimmed ||
      `Custom (${selectedMetrics.length} metric${selectedMetrics.length > 1 ? 's' : ''})`;

    const newPreset: TrendPreset = {
      id: `preset_custom_${Date.now()}`,
      name: finalName,
      metricIds: [...selectedMetrics],
      isCustom: true,
    };

    setPresets((prev) => [...prev, newPreset]);
    setIsAddingPreset(false);
    setNewPresetName('');
  };

  // Check if a preset is active
  const isPresetActive = (preset: TrendPreset) => {
    if (preset.metricIds.includes('__dynamic_top_categories__')) {
      const topCats = availableCategories.slice(0, 4);
      return (
        selectedMetrics.length === topCats.length &&
        topCats.every((c) => selectedMetrics.includes(c))
      );
    }
    return (
      selectedMetrics.length === preset.metricIds.length &&
      preset.metricIds.every((id) => selectedMetrics.includes(id))
    );
  };

  const resetToDefault = () => {
    setSelectedMetrics(DEFAULT_SELECTED_METRICS);
    setPresets(DEFAULT_PRESETS);
    setIsCustomizeOpen(false);
    setIsAddingPreset(false);
  };

  // Check if all selected metrics are pure currency (to format Y Axis nicely)
  const hasOnlyCurrency = useMemo(() => {
    return selectedMetrics.every((id) => {
      const opt = allMetricOptions.find((o) => o.id === id);
      return !opt || opt.type === 'currency';
    });
  }, [selectedMetrics, allMetricOptions]);

  // Helper to format values on tooltips & axes
  const formatTooltipValue = (value: any, name: string) => {
    const opt = allMetricOptions.find((o) => o.id === name || o.label === name);
    const num = Number(value);
    if (isNaN(num)) return [value, name];

    const label = opt?.label || name;
    if (opt?.type === 'percent') {
      return [`${num}%`, label];
    }
    if (opt?.type === 'count') {
      return [`${num} items`, label];
    }
    return [formatCurrency(num), label];
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-xl space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2 text-slate-100">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <span>Trend</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
              {selectedMetrics.length} {selectedMetrics.length === 1 ? 'metric' : 'metrics'}
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Compare single or multiple financial metrics and categories over time
          </p>
        </div>

        {/* Quick Presets & Customize Dropdown Controls */}
        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
          {/* Quick Preset Buttons (First 3 on desktop) */}
          <div className="hidden lg:flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs gap-1">
            {presets.slice(0, 3).map((preset) => {
              const active = isPresetActive(preset);
              return (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    active
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>

          {/* Customize Dropdown Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsCustomizeOpen(!isCustomizeOpen)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                isCustomizeOpen
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-950'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400 group-hover:text-white" />
              <span>Customize</span>
              <span className="w-5 h-5 rounded-full bg-slate-900/80 border border-slate-700 text-[10px] flex items-center justify-center font-bold text-emerald-300">
                {selectedMetrics.length}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                  isCustomizeOpen ? 'rotate-180 text-white' : ''
                }`}
              />
            </button>

            {/* Customize Popover Dropdown */}
            {isCustomizeOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 p-4 text-xs text-slate-200 animate-fade-in divide-y divide-slate-800">
                {/* Popover Header */}
                <div className="flex items-center justify-between pb-3">
                  <div>
                    <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                      Customize Trend Comparison
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Select metrics to plot and manage your quick comparison presets
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsCustomizeOpen(false);
                      setIsAddingPreset(false);
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick Presets Section with Delete Cross & Add Plus Button */}
                <div className="py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Quick Presets ({presets.length})
                    </span>
                    {!isAddingPreset && (
                      <span className="text-[10px] text-slate-500">
                        Click preset to apply, ✕ to delete
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {presets.map((preset) => {
                      const active = isPresetActive(preset);
                      return (
                        <div
                          key={preset.id}
                          onClick={() => applyPreset(preset)}
                          className={`group flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer select-none ${
                            active
                              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-sm'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          <span className="truncate max-w-[130px]">{preset.name}</span>
                          {/* Delete Preset Cross Button */}
                          <button
                            type="button"
                            onClick={(e) => deletePreset(preset.id, e)}
                            className="p-0.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 transition-colors ml-0.5"
                            title={`Delete "${preset.name}" preset`}
                          >
                            <X className="w-3 h-3 stroke-[2.5]" />
                          </button>
                        </div>
                      );
                    })}

                    {/* Add New Preset Plus Button (After last preset) */}
                    {!isAddingPreset ? (
                      <button
                        type="button"
                        onClick={handleStartAddPreset}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-600/40 hover:border-emerald-500 text-emerald-300 text-[11px] font-semibold transition-all cursor-pointer"
                        title="Save current selected metrics as a new custom preset"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Add Preset</span>
                      </button>
                    ) : null}
                  </div>

                  {/* Inline Add Preset Input Box */}
                  {isAddingPreset && (
                    <form
                      onSubmit={handleSaveNewPreset}
                      className="mt-2 p-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-2 animate-fade-in"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1">
                          <BookmarkPlus className="w-3.5 h-3.5" />
                          Save ({selectedMetrics.length}) Selected Metrics as Preset
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsAddingPreset(false)}
                          className="text-slate-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          ref={newPresetInputRef}
                          type="text"
                          value={newPresetName}
                          onChange={(e) => setNewPresetName(e.target.value)}
                          placeholder={`e.g. My Favorites (${selectedMetrics.length})`}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          type="submit"
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition-colors"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddingPreset(false)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Multi-Select Metric List */}
                <div className="py-2.5 space-y-3 max-h-64 overflow-y-auto pr-1">
                  {/* Financial & Core Group */}
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1.5">
                      Core Financial Metrics
                    </span>
                    <div className="space-y-1.5">
                      {allMetricOptions
                        .filter((m) => m.group === 'financial')
                        .map((opt) => {
                          const isSelected = selectedMetrics.includes(opt.id);
                          const Icon = opt.icon || TrendingUp;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => toggleMetric(opt.id)}
                              className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer border ${
                                isSelected
                                  ? 'bg-emerald-950/40 border-emerald-500/40 text-slate-100'
                                  : 'bg-slate-950/40 hover:bg-slate-800/60 border-slate-800 text-slate-400'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <div
                                  className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                                  style={{ backgroundColor: opt.color }}
                                />
                                <div className="min-w-0">
                                  <p className="font-semibold text-xs text-slate-200 truncate flex items-center gap-1.5">
                                    <Icon className="w-3.5 h-3.5 opacity-80" />
                                    {opt.label}
                                  </p>
                                  <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                    {opt.description}
                                  </p>
                                </div>
                              </div>
                              <div
                                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                                  isSelected
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
                  </div>

                  {/* Ratios & Volume Group */}
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1.5">
                      Analytics & Ratios
                    </span>
                    <div className="space-y-1.5">
                      {allMetricOptions
                        .filter((m) => m.group === 'ratios')
                        .map((opt) => {
                          const isSelected = selectedMetrics.includes(opt.id);
                          const Icon = opt.icon || Percent;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => toggleMetric(opt.id)}
                              className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer border ${
                                isSelected
                                  ? 'bg-emerald-950/40 border-emerald-500/40 text-slate-100'
                                  : 'bg-slate-950/40 hover:bg-slate-800/60 border-slate-800 text-slate-400'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <div
                                  className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                                  style={{ backgroundColor: opt.color }}
                                />
                                <div className="min-w-0">
                                  <p className="font-semibold text-xs text-slate-200 truncate flex items-center gap-1.5">
                                    <Icon className="w-3.5 h-3.5 opacity-80" />
                                    {opt.label}
                                  </p>
                                  <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                    {opt.description}
                                  </p>
                                </div>
                              </div>
                              <div
                                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                                  isSelected
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
                  </div>

                  {/* Specific Categories Group */}
                  {availableCategories.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1.5">
                        Individual Categories
                      </span>
                      <div className="grid grid-cols-1 gap-1.5">
                        {allMetricOptions
                          .filter((m) => m.group === 'category')
                          .map((opt) => {
                            const isSelected = selectedMetrics.includes(opt.id);
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => toggleMetric(opt.id)}
                                className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition-colors cursor-pointer border ${
                                  isSelected
                                    ? 'bg-indigo-950/40 border-indigo-500/40 text-slate-100'
                                    : 'bg-slate-950/40 hover:bg-slate-800/60 border-slate-800 text-slate-400'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  <div
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: opt.color }}
                                  />
                                  <span className="font-semibold text-xs text-slate-200 truncate">
                                    {opt.label}
                                  </span>
                                </div>
                                <div
                                  className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                                    isSelected
                                      ? 'bg-indigo-600 border-indigo-500 text-white'
                                      : 'bg-slate-800 border-slate-700 text-transparent'
                                  }`}
                                >
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Popover Footer */}
                <div className="pt-3 flex items-center justify-between text-[11px]">
                  <button
                    onClick={resetToDefault}
                    className="text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Defaults</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsCustomizeOpen(false);
                      setIsAddingPreset(false);
                    }}
                    className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow"
                  >
                    Done ({selectedMetrics.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Selected Metrics Filter Pills & Legends */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
          Comparing:
        </span>
        {selectedMetrics.map((id) => {
          const opt = allMetricOptions.find((o) => o.id === id);
          if (!opt) return null;
          return (
            <div
              key={id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200 shadow-sm"
            >
              <div
                className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0"
                style={{ backgroundColor: opt.color }}
              />
              <span>{opt.label}</span>
              {selectedMetrics.length > 1 && (
                <button
                  onClick={() => toggleMetric(id)}
                  className="text-slate-400 hover:text-rose-400 p-0.5 rounded-full ml-0.5 cursor-pointer"
                  title="Remove from comparison"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {monthlyTrends.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center bg-slate-800/20 rounded-xl border border-dashed border-slate-800 text-center p-6 space-y-3">
          <BarChart3 className="w-10 h-10 text-slate-600" />
          <p className="text-sm text-slate-400 font-medium">No trend records found in Google Sheet.</p>
          {onSeedSampleData && (
            <button
              onClick={onSeedSampleData}
              disabled={isSeeding}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow"
            >
              {isSeeding ? 'Seeding Data...' : 'Seed Sample Spending Data'}
            </button>
          )}
        </div>
      ) : (
        /* Recharts Multi-Series Trend Graph */
        <div className="h-80 w-full pt-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={monthlyTrends}
              margin={{ top: 10, right: 15, left: 0, bottom: 5 }}
            >
              <defs>
                {selectedMetrics.map((id) => {
                  const opt = allMetricOptions.find((o) => o.id === id);
                  const color = opt?.color || '#10b981';
                  const gradId = `grad_${id.replace(/[^a-zA-Z0-9]/g, '_')}`;
                  return (
                    <linearGradient key={id} id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.0} />
                    </linearGradient>
                  );
                })}
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
              <XAxis
                dataKey="month"
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
                dy={6}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
                tickFormatter={(val) => {
                  if (hasOnlyCurrency) {
                    if (Math.abs(val) >= 100000) return `₹${(val / 1000).toFixed(0)}k`;
                    if (Math.abs(val) >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
                    return `₹${val}`;
                  }
                  return String(val);
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  color: '#f8fafc',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                  padding: '10px 14px',
                }}
                formatter={formatTooltipValue}
                labelStyle={{ fontWeight: 'bold', color: '#e2e8f0', marginBottom: '4px' }}
              />

              {/* Render Area/Line for each selected metric */}
              {selectedMetrics.map((id) => {
                const opt = allMetricOptions.find((o) => o.id === id);
                const color = opt?.color || '#10b981';
                const gradId = `grad_${id.replace(/[^a-zA-Z0-9]/g, '_')}`;

                return (
                  <Area
                    key={id}
                    type="monotone"
                    dataKey={id}
                    name={opt?.label || id}
                    stroke={color}
                    strokeWidth={selectedMetrics.length === 1 ? 3 : 2.5}
                    fillOpacity={1}
                    fill={`url(#${gradId})`}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: '#0f172a' }}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
