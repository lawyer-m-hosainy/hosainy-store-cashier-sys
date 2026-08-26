import { CheckCircle, XCircle, X } from 'lucide-react';
import { useToast } from '../store/useToast';

export default function Toaster() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-6 z-[100] space-y-2 w-80" dir="rtl">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-start gap-3 p-4 rounded-xl shadow-lg text-sm font-medium ${
            t.type === 'error' ? 'bg-red-600 text-white' : 'bg-neutral-900 text-white'
          }`}
        >
          {t.type === 'error' ? <XCircle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 flex-shrink-0" />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismissToast(t.id)} className="text-white/70 hover:text-white flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
