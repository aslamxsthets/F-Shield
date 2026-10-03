import React from 'react';
import { AlertCircle, CheckCircle2, Info, LoaderCircle, UploadCloud, X } from 'lucide-react';

export interface AppNotice {
  id: number;
  title: string;
  message: string;
  tone: 'error' | 'success' | 'info';
}

interface AppFeedbackProps {
  loading: boolean;
  notices: AppNotice[];
  onDismiss: (id: number) => void;
}

const noticeStyles = {
  error: { icon: AlertCircle, classes: 'border-rose-200 bg-white text-rose-900', iconClasses: 'text-rose-600' },
  success: { icon: CheckCircle2, classes: 'border-emerald-200 bg-white text-emerald-900', iconClasses: 'text-emerald-600' },
  info: { icon: Info, classes: 'border-sky-200 bg-white text-sky-900', iconClasses: 'text-sky-600' },
};

export const AppFeedback: React.FC<AppFeedbackProps> = ({ loading, notices, onDismiss }) => (
  <>
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(calc(100vw-2rem),26rem)] flex-col gap-2" aria-live="polite" aria-relevant="additions">
      {notices.map(notice => {
        const style = noticeStyles[notice.tone];
        const Icon = style.icon;
        return (
          <div key={notice.id} className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${style.classes}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.iconClasses}`} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">{notice.title}</div>
              <div className="mt-0.5 break-words text-xs leading-relaxed">{notice.message}</div>
            </div>
            <button type="button" onClick={() => onDismiss(notice.id)} className="-mr-1 -mt-1 rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label="Dismiss notification">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>

    {loading && (
      <div className="fixed inset-0 z-[90] grid place-items-center bg-stone-950/35 p-5 backdrop-blur-sm" role="status" aria-live="polite">
        <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
          <div className="h-1.5 bg-stone-100">
            <div className="h-full w-2/5 animate-pulse bg-gradient-to-r from-amber-500 to-orange-600" />
          </div>
          <div className="px-6 py-7 text-center">
            <div className="relative mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-amber-200 bg-amber-50">
              <UploadCloud className="h-7 w-7 text-amber-700" />
              <LoaderCircle className="absolute -right-2 -top-2 h-5 w-5 animate-spin text-stone-700" />
            </div>
            <h2 className="text-base font-bold text-stone-900">Working on your request</h2>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">F-Shield is securely processing and syncing your data.</p>
          </div>
        </div>
      </div>
    )}
  </>
);