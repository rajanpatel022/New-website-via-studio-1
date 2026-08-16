import React, { useState } from 'react';
import { GoogleSheetFile } from '../types';
import { X, Plus, FileSpreadsheet, Check, Loader2, RefreshCw } from 'lucide-react';

interface SheetSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheets: GoogleSheetFile[];
  currentSheet: GoogleSheetFile | null;
  onSelectSheet: (sheet: GoogleSheetFile) => void;
  onCreateNewSheet: (title: string) => Promise<void>;
  onRefreshSheets: () => void;
  isLoading: boolean;
}

export const SheetSelectorModal: React.FC<SheetSelectorModalProps> = ({
  isOpen,
  onClose,
  sheets,
  currentSheet,
  onSelectSheet,
  onCreateNewSheet,
  onRefreshSheets,
  isLoading,
}) => {
  const [newTitle, setNewTitle] = useState('Expense Tracker Database');
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsCreating(true);
    try {
      await onCreateNewSheet(newTitle.trim());
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base">Select Google Sheet Database</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Create New Sheet Form */}
          <form onSubmit={handleCreate} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-3">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Create New Spreadsheet
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Spreadsheet Title..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={isCreating || !newTitle.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold shadow-md transition-all shrink-0"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Create</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Creates a fresh Google Sheet pre-configured with expense table headers & formatting.
            </p>
          </form>

          {/* Existing Sheets List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Existing Spreadsheets in Google Drive
              </span>
              <button
                onClick={onRefreshSheets}
                disabled={isLoading}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {isLoading ? (
              <div className="py-8 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                <span>Loading Google Drive sheets...</span>
              </div>
            ) : sheets.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm bg-slate-800/30 rounded-xl border border-dashed border-slate-800">
                No Google Sheets found. Create a new one above!
              </div>
            ) : (
              <div className="space-y-2">
                {sheets.map((sheet) => {
                  const isSelected = currentSheet?.id === sheet.id;
                  return (
                    <button
                      key={sheet.id}
                      onClick={() => {
                        onSelectSheet(sheet);
                        onClose();
                      }}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                          : 'bg-slate-800/40 hover:bg-slate-800 border-slate-700/60 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <FileSpreadsheet className={`w-5 h-5 shrink-0 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{sheet.name}</p>
                          {sheet.modifiedTime && (
                            <p className="text-xs text-slate-500">
                              Modified: {new Date(sheet.modifiedTime).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
