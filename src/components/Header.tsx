import React, { useState, useRef, useEffect } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Settings,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Palette,
  MoreVertical,
  Layers,
  Check,
} from 'lucide-react';

interface HeaderProps {
  isConnected: boolean;
  sheetTitle?: string;
  activeSheetName?: string;
  onOpenConnector: () => void;
  onOpenNewExpenseModal: () => void;
  onOpenCategoryColors?: () => void;
  onOpenSheetSwitcher?: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  sheetTitle,
  activeSheetName,
  onOpenConnector,
  onOpenNewExpenseModal,
  onOpenCategoryColors,
  onOpenSheetSwitcher,
  onRefresh,
  isRefreshing,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const currentDisplayName = activeSheetName || sheetTitle || 'Website Sheet';

  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div
            onClick={onOpenSheetSwitcher}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 cursor-pointer hover:scale-105 transition-transform"
            title="Click to Switch Sheet"
          >
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                SheetExpense
              </h1>
              {isConnected && (
                <button
                  onClick={onOpenSheetSwitcher}
                  className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-emerald-300 font-medium transition-colors cursor-pointer"
                  title="Active Sheet (Click to switch)"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="max-w-[120px] truncate">{currentDisplayName}</span>
                </button>
              )}
            </div>
            <p className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              ></span>
              {isConnected ? 'Google Sheets Live' : 'Setup Database'}
            </p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Refresh button */}
          {isConnected && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Refresh expenses from Google Sheet"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          )}

          {/* Add Expense Button */}
          <button
            onClick={onOpenNewExpenseModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">Add Expense</span>
            <span className="sm:hidden">Add</span>
          </button>

          {/* 3-Dot Dropdown Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
              title="More options & settings"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown Card */}
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl z-50 py-1.5 text-xs text-slate-200 animate-fade-in divide-y divide-slate-800">
                {/* Current Active Sheet Header */}
                <div className="px-3.5 py-2.5 bg-slate-950/40">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Current Active Sheet
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span className="font-semibold text-sm text-slate-100 truncate">
                      {currentDisplayName}
                    </span>
                  </div>
                </div>

                {/* Main Menu Items */}
                <div className="py-1">
                  {/* Select / Switch Sheet */}
                  {onOpenSheetSwitcher && (
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenSheetSwitcher();
                      }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-slate-800/80 flex items-center gap-2.5 text-slate-200 hover:text-emerald-300 transition-colors cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                        <Layers className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="font-semibold">Select / Switch Sheet</p>
                        <p className="text-[11px] text-slate-400">
                          Toggle between multiple Google Sheets
                        </p>
                      </div>
                    </button>
                  )}

                  {/* Category Colors */}
                  {onOpenCategoryColors && (
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenCategoryColors();
                      }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-slate-800/80 flex items-center gap-2.5 text-slate-200 hover:text-emerald-300 transition-colors cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                        <Palette className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <p className="font-semibold">Category Colors</p>
                        <p className="text-[11px] text-slate-400">
                          Color pickers & palette coding
                        </p>
                      </div>
                    </button>
                  )}

                  {/* Sheet Connection / Advanced Settings */}
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenConnector();
                    }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-slate-800/80 flex items-center gap-2.5 text-slate-200 hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                      <Settings className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="font-semibold">Connection & Setup</p>
                      <p className="text-[11px] text-slate-400">
                        Google Apps Script Web App info
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

