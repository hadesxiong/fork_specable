import { AlertCircle, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useEditorStore } from '../../store';

type ActivePanel = 'editor' | 'preview';

interface MobileStatusBarProps {
  activePanel: ActivePanel;
  onPanelChange: (panel: ActivePanel) => void;
}

export function MobileStatusBar({ activePanel, onPanelChange }: MobileStatusBarProps) {
  const isValidating = useEditorStore((state) => state.isValidating);
  const errors = useEditorStore((state) => state.errors);
  const warnings = useEditorStore((state) => state.warnings);

  const errorCount = errors.length;
  const warningCount = warnings.length;

  return (
    <footer className="h-12 flex items-center justify-between px-4 bg-zinc-900 border-t border-zinc-800 shrink-0">
      <div className="flex items-center gap-3">
        {(['editor', 'preview'] as const).map((panel) => (
          <button
            key={panel}
            onClick={() => onPanelChange(panel)}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              activePanel === panel ? 'bg-purple-400' : 'bg-zinc-600'
            }`}
            aria-label={`Switch to ${panel}`}
          />
        ))}
      </div>

      <div
        className="flex items-center gap-3 text-xs"
        aria-label={`${errorCount} errors, ${warningCount} warnings`}
      >
        {isValidating ? (
          <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
        ) : (
          <>
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                <AlertCircle className="w-4 h-4" />
                {errorCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                {warningCount}
              </span>
            )}
            {errorCount === 0 && warningCount === 0 && (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            )}
          </>
        )}
      </div>
    </footer>
  );
}
