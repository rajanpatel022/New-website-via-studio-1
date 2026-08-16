import React from 'react';
import { FileSpreadsheet, Lock, ShieldCheck, ArrowRight, Zap, Link as LinkIcon } from 'lucide-react';

interface AuthBannerProps {
  onOpenConnector: () => void;
}

export const AuthBanner: React.FC<AuthBannerProps> = ({ onOpenConnector }) => {
  return (
    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/50 rounded-2xl p-6 sm:p-8 text-slate-100 shadow-xl my-6">
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
        <div className="space-y-3 max-w-2xl text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span>Google Sheets Live Database</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Connect your Google Sheet in 60 seconds
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Store your income and expenses directly in your own Google Sheet. View interactive charts, category breakdowns, and monthly financial summaries with zero backend hosting needed.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> 100% Private Data
            </span>
            <span className="flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Real-time Sheets Sync
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-400" /> Stored in Your Google Drive
            </span>
          </div>
        </div>

        <div className="shrink-0 text-center">
          <button
            onClick={onOpenConnector}
            type="button"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-sm font-bold shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <LinkIcon className="w-5 h-5" />
            <span>Connect Google Sheet</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
};
