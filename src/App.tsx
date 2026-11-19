import { useRef, useState } from 'react';
import { AlertCircle, RotateCcw, Upload } from 'lucide-react';
import { PipelineProgress } from './components/PipelineProgress';
import { ResultsView } from './components/ResultsView';
import {
  UploadDropzone,
  type SampleOption,
} from './components/UploadDropzone';
import type {
  AnalysisResult,
  PipelineProgressEvent,
  PipelineStage,
} from './types/lpr';

interface SourcePayload {
  imageBase64: string;
  mimeType: string;
  fileName: string;
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(blob);
  });
}

export default function App() {
  const headerFileInputRef = useRef<HTMLInputElement | null>(null);
  const [sourcePayload, setSourcePayload] = useState<SourcePayload | null>(
    null
  );
  const [stage, setStage] = useState<PipelineStage>('idle');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const isProcessing =
    stage !== 'idle' && stage !== 'complete' && stage !== 'error';

  const runAnalysis = async (
    payload: SourcePayload,
    forceEnhance = false
  ) => {
    setSourcePayload(payload);
    setErrorMessage(null);
    if (!forceEnhance) {
      setResult(null);
    }
    setStage('detect');
    setProgress(8);
    setStatusMessage('Uploading image to recognition pipeline…');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: payload.imageBase64,
          mimeType: payload.mimeType,
          forceEnhance,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server error (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processLine = (rawLine: string) => {
        const trimmed = rawLine.trim();
        if (!trimmed) return;

        const event = JSON.parse(trimmed) as PipelineProgressEvent;
        if (event.type === 'progress') {
          setStage(event.stage);
          setProgress(event.progress);
          setStatusMessage(event.message);
        } else if (event.type === 'complete' && event.result) {
          setStage('complete');
          setProgress(100);
          setStatusMessage(event.message);
          setResult(event.result);
        } else if (event.type === 'error') {
          setStage('error');
          setProgress(0);
          setStatusMessage(event.message);
          setErrorMessage(
            event.error || 'Failed to analyze the uploaded image.'
          );
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          processLine(line);
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        processLine(buffer);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Unexpected network error.';
      setStage('error');
      setProgress(0);
      setErrorMessage(msg);
    }
  };

  const handleFileSelected = async (file: File) => {
    const dataUrl = await readBlobAsDataUrl(file);
    await runAnalysis({
      imageBase64: dataUrl,
      mimeType: file.type || 'image/jpeg',
      fileName: file.name,
    });
  };

  const handleSampleSelected = async (sample: SampleOption) => {
    try {
      const res = await fetch(sample.src);
      if (!res.ok) {
        throw new Error('Could not load sample vehicle photo.');
      }
      const blob = await res.blob();
      const dataUrl = await readBlobAsDataUrl(blob);
      await runAnalysis({
        imageBase64: dataUrl,
        mimeType: blob.type || 'image/jpeg',
        fileName: `${sample.id}.jpg`,
      });
    } catch (err: unknown) {
      setStage('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to load sample image.'
      );
    }
  };

  const handleReset = () => {
    setSourcePayload(null);
    setStage('idle');
    setProgress(0);
    setStatusMessage('');
    setErrorMessage(null);
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Clean Top Bar */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleReset();
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            EnhanceLPR
          </a>

          <div className="flex items-center gap-3 shrink-0">
            {(result || errorMessage) && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Clear</span>
              </button>
            )}
            <input
              ref={headerFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileSelected(file);
                  e.target.value = '';
                }
              }}
              className="hidden"
            />
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => headerFileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Upload Image</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-6">
        {!result && !isProcessing && (
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
              Indian License Plate Recognition
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl">
              Upload a vehicle photo to detect the plate region, crop and
              enhance blurry captures, extract characters, and validate against
              standard Indian RTO and BH-Series formats.
            </p>
          </div>
        )}

        {/* Upload Area (prominent initially, compact when viewing results) */}
        {!result && (
          <UploadDropzone
            disabled={isProcessing}
            onFileSelected={handleFileSelected}
            onSampleSelected={handleSampleSelected}
          />
        )}

        {/* Live Pipeline Progress */}
        {isProcessing && (
          <PipelineProgress
            stage={stage}
            progress={progress}
            message={statusMessage}
          />
        )}

        {/* Error Feedback */}
        {errorMessage && !isProcessing && (
          <div
            role="alert"
            className="bg-white border border-rose-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                className="w-5 h-5 text-rose-600 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Unable to Process Image
                </h2>
                <p className="text-sm text-slate-600 mt-0.5">{errorMessage}</p>
              </div>
            </div>
            {sourcePayload && (
              <button
                type="button"
                onClick={() => runAnalysis(sourcePayload)}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                Retry Analysis
              </button>
            )}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            <ResultsView
              result={result}
              isProcessing={isProcessing}
              onForceEnhance={() => {
                if (sourcePayload) {
                  runAnalysis(sourcePayload, true);
                }
              }}
            />

            <div className="pt-2">
              <UploadDropzone
                compact
                disabled={isProcessing}
                onFileSelected={handleFileSelected}
                onSampleSelected={handleSampleSelected}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
