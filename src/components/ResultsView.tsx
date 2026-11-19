import { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type { AnalysisResult } from '../types/lpr';

interface ResultsViewProps {
  result: AnalysisResult;
  isProcessing: boolean;
  onForceEnhance: () => void;
}

export function ResultsView({
  result,
  isProcessing,
  onForceEnhance,
}: ResultsViewProps) {
  const [showOverlay, setShowOverlay] = useState(true);
  const [copied, setCopied] = useState(false);

  const {
    boundingBox,
    orientedImageDataUrl,
    originalWidth,
    originalHeight,
    croppedPlateDataUrl,
    enhancedPlateDataUrl,
    enhancementApplied,
    blurAssessment,
    angleAssessment,
    rawOcrText,
    plateCategory,
    ocrConfidence,
    ocrObservations,
    validation,
  } = result;

  const boxWidth = Math.max(1, boundingBox.xmax - boundingBox.xmin);
  const boxHeight = Math.max(1, boundingBox.ymax - boundingBox.ymin);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(validation.formattedPlate);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Visual Inspection */}
      <div className="lg:col-span-6 space-y-5">
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-200">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Detected Plate Region
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                {originalWidth} × {originalHeight}px · {angleAssessment}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowOverlay((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {showOverlay ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Hide Box</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Show Box</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-slate-100 relative flex items-center justify-center">
            <div className="relative w-full">
              <img
                src={orientedImageDataUrl}
                alt="Uploaded vehicle with detected license plate"
                referrerPolicy="no-referrer"
                className="w-full h-auto block max-h-[380px] object-contain mx-auto"
              />
              {showOverlay && (
                <svg
                  viewBox="0 0 1000 1000"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                >
                  <rect
                    x={boundingBox.xmin}
                    y={boundingBox.ymin}
                    width={boxWidth}
                    height={boxHeight}
                    fill="rgba(37, 99, 235, 0.14)"
                    stroke="#2563EB"
                    strokeWidth={6}
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              )}
            </div>
          </div>
        </section>

        {/* Cropped & Enhanced Plate Stages */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Plate Crop & Clarity Processing
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {blurAssessment.reason}
              </p>
            </div>
            {!enhancementApplied && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={onForceEnhance}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Enhance Anyway</span>
              </button>
            )}
          </div>

          <div
            className={`grid gap-4 ${
              enhancementApplied && enhancedPlateDataUrl
                ? 'grid-cols-1 sm:grid-cols-2'
                : 'grid-cols-1'
            }`}
          >
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                <span className="font-medium text-slate-700">
                  Cropped Plate
                </span>
                <span className="font-mono tabular-nums">
                  {blurAssessment.croppedWidth} × {blurAssessment.croppedHeight}
                  px
                </span>
              </div>
              <div className="border border-slate-200 rounded-lg bg-slate-50 p-3 flex items-center justify-center min-h-[96px]">
                <img
                  src={croppedPlateDataUrl}
                  alt="Cropped license plate region"
                  referrerPolicy="no-referrer"
                  className="max-h-24 w-auto object-contain rounded"
                />
              </div>
            </div>

            {enhancementApplied && enhancedPlateDataUrl && (
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                  <span className="font-medium text-blue-700">
                    Enhanced for OCR
                  </span>
                  <span className="font-mono tabular-nums">
                    Sharpened · Contrast Normalized
                  </span>
                </div>
                <div className="border border-blue-200 rounded-lg bg-blue-50/30 p-3 flex items-center justify-center min-h-[96px]">
                  <img
                    src={enhancedPlateDataUrl}
                    alt="Enhanced license plate region"
                    referrerPolicy="no-referrer"
                    className="max-h-24 w-auto object-contain rounded"
                  />
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Right Column: Extracted Plate & Format Validation */}
      <div className="lg:col-span-6 space-y-5">
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          {/* Primary HSRP Plate Readout */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-stretch border-2 border-slate-900 rounded-lg overflow-hidden bg-white shadow-xs">
              <div className="bg-blue-700 text-white px-2 py-2.5 flex flex-col items-center justify-center text-[10px] font-bold tracking-wider leading-none select-none">
                <span>IND</span>
              </div>
              <div className="px-4 py-2.5 flex items-center">
                <span className="font-mono text-2xl sm:text-3xl font-bold tracking-wider text-slate-900 tabular-nums">
                  {validation.formattedPlate}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Copy Number</span>
                </>
              )}
            </button>
          </div>

          {/* Explicit Validation Status */}
          <div
            className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-sm ${
              validation.isValid
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/70 border-amber-200 text-amber-900'
            }`}
          >
            {validation.isValid ? (
              <CheckCircle2
                className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0"
                aria-hidden="true"
              />
            ) : (
              <AlertTriangle
                className="w-4 h-4 text-amber-600 mt-0.5 shrink-0"
                aria-hidden="true"
              />
            )}
            <div>
              <p className="font-semibold">
                {validation.isValid
                  ? `Valid Indian License Plate · ${validation.formatType}`
                  : 'Format Validation Warning'}
              </p>
              <p className="text-xs mt-0.5 opacity-90">{validation.summary}</p>
            </div>
          </div>

          {/* Structured License Plate Data */}
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-2">
              License Plate Data
            </h2>
            <dl className="divide-y divide-slate-200 border-t border-b border-slate-200 text-sm">
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Formatted Number</dt>
                <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                  {validation.formattedPlate}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Compact String</dt>
                <dd className="font-mono text-slate-900 tabular-nums">
                  {validation.normalizedCompact || '—'}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Format Standard</dt>
                <dd className="font-medium text-slate-900 text-right">
                  {validation.formatType}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-slate-500">State / Territory</dt>
                <dd className="font-medium text-slate-900 text-right">
                  {validation.stateName
                    ? `${validation.stateName} (${validation.stateCode})`
                    : 'Unrecognized'}
                </dd>
              </div>
              {validation.rtoCode && (
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-slate-500">RTO District Code</dt>
                  <dd className="font-mono text-slate-900 tabular-nums">
                    {validation.rtoCode}
                  </dd>
                </div>
              )}
              {validation.registrationYear && (
                <div className="py-2.5 flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Registration Year</dt>
                  <dd className="font-mono text-slate-900 tabular-nums">
                    {validation.registrationYear}
                  </dd>
                </div>
              )}
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Series & Sequence</dt>
                <dd className="font-mono text-slate-900 tabular-nums">
                  {validation.seriesCode || validation.registrationNumber
                    ? `${validation.seriesCode ?? '—'} · ${validation.registrationNumber ?? '—'}`
                    : '—'}
                </dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Plate Category</dt>
                <dd className="text-slate-900 text-right">{plateCategory}</dd>
              </div>
              <div className="py-2.5 flex items-center justify-between gap-4">
                <dt className="text-slate-500">Clarity & OCR</dt>
                <dd className="text-slate-900 text-right tabular-nums">
                  {blurAssessment.isBlurry ? 'Blurry' : 'Sharp'} (score{' '}
                  {blurAssessment.sharpnessScore}) · {ocrConfidence} confidence
                </dd>
              </div>
            </dl>
          </div>

          {/* Indian Format Rule Checklist */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">
              Format Validation Rules
            </h3>
            <ul className="space-y-2">
              {validation.checks.map((check) => (
                <li
                  key={check.label}
                  className="flex items-start gap-2.5 text-xs"
                >
                  {check.passed ? (
                    <CheckCircle2
                      className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                  ) : (
                    <XCircle
                      className="w-4 h-4 text-rose-600 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                  )}
                  <div>
                    <span className="font-medium text-slate-800">
                      {check.label}
                    </span>
                    <span className="text-slate-400 mx-1.5" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-slate-600">{check.detail}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {(rawOcrText || ocrObservations) && (
            <div className="pt-2 border-t border-slate-200 text-xs text-slate-500 space-y-1">
              <div>
                <span className="font-medium text-slate-700">
                  Raw OCR Output:
                </span>{' '}
                <span className="font-mono text-slate-800">
                  {rawOcrText || '—'}
                </span>
                {validation.strippedIndPrefix && (
                  <span> (leading IND sticker omitted)</span>
                )}
              </div>
              {ocrObservations && <p>{ocrObservations}</p>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
