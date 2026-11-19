import { Check, Loader2 } from 'lucide-react';
import type { PipelineStage } from '../types/lpr';

interface PipelineProgressProps {
  stage: PipelineStage;
  progress: number;
  message: string;
}

const STEPS: { id: PipelineStage; label: string }[] = [
  { id: 'detect', label: 'Detect Plate' },
  { id: 'crop', label: 'Crop Region' },
  { id: 'assess_blur', label: 'Assess Blur' },
  { id: 'enhance', label: 'Enhance' },
  { id: 'ocr', label: 'OCR & Validate' },
];

const STAGE_ORDER: Record<PipelineStage, number> = {
  idle: -1,
  detect: 0,
  crop: 1,
  assess_blur: 2,
  enhance: 3,
  ocr: 4,
  validate: 4,
  complete: 5,
  error: -1,
};

export function PipelineProgress({
  stage,
  progress,
  message,
}: PipelineProgressProps) {
  const currentIdx = STAGE_ORDER[stage];

  return (
    <section
      aria-label="Analysis progress"
      className="bg-white border border-slate-200 rounded-xl p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 text-sm font-medium text-slate-900">
          <Loader2
            className="w-4 h-4 text-blue-600 animate-spin shrink-0"
            aria-hidden="true"
          />
          <span>{message}</span>
        </div>
        <span className="font-mono text-xs font-medium text-slate-600 tabular-nums">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Compositor-only transform progress bar */}
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-blue-600 origin-left transition-transform duration-300 ease-out"
          style={{ transform: `scaleX(${Math.max(0.04, progress / 100)})` }}
        />
      </div>

      <ol className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {STEPS.map((step, idx) => {
          const isDone = currentIdx > idx || stage === 'complete';
          const isActive = currentIdx === idx && stage !== 'complete';

          return (
            <li
              key={step.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                isDone
                  ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800'
                  : isActive
                    ? 'border-blue-200 bg-blue-50/60 text-blue-800'
                    : 'border-slate-200 bg-slate-50/50 text-slate-500'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[11px] font-mono shrink-0 ${
                  isDone
                    ? 'bg-emerald-600 text-white'
                    : isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                }`}
              >
                {isDone ? (
                  <Check className="w-2.5 h-2.5" aria-hidden="true" />
                ) : (
                  idx + 1
                )}
              </span>
              <span className="truncate">{step.label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
