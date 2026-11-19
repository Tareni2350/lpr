import { useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';

export interface SampleOption {
  id: string;
  label: string;
  subtitle: string;
  src: string;
}

export const SAMPLE_IMAGES: SampleOption[] = [
  {
    id: 'clear',
    label: 'Daylight Hatchback',
    subtitle: 'Clear plate · KA 05 MJ 4821',
    src: '/src/assets/images/sample_clear_plate_1795066835804.jpg',
  },
  {
    id: 'blurry',
    label: 'Dusk Traffic Cam',
    subtitle: 'Angled / soft · MH 12 DE 1433',
    src: '/src/assets/images/sample_blurry_plate_1795066834835.jpg',
  },
];

interface UploadDropzoneProps {
  disabled?: boolean;
  compact?: boolean;
  onFileSelected: (file: File) => void;
  onSampleSelected: (sample: SampleOption) => void;
}

export function UploadDropzone({
  disabled = false,
  compact = false,
  onFileSelected,
  onSampleSelected,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onFileSelected(file);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload vehicle image"
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border border-dashed rounded-xl bg-white transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
          compact ? 'px-6 py-6' : 'px-6 py-12'
        } ${
          isDragging
            ? 'border-blue-600 bg-blue-50/40'
            : 'border-slate-300 hover:border-slate-400'
        } ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex flex-col items-center text-center max-w-md mx-auto">
          <div className="w-11 h-11 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center mb-3.5 text-slate-700">
            <Upload className="w-5 h-5" aria-hidden="true" />
          </div>
          <p className="text-base font-semibold text-slate-900">
            Drop a vehicle image here, or browse files
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Supports JPG, PNG, and WebP. Detects angled plates, enhances blurry
            crops, and validates Indian formats.
          </p>
          <span className="mt-4 inline-flex items-center px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium whitespace-nowrap shrink-0">
            Select Image
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <span className="text-xs font-medium text-slate-500">
          Or test immediately with a sample vehicle photo:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {SAMPLE_IMAGES.map((sample) => (
            <button
              key={sample.id}
              type="button"
              disabled={disabled}
              onClick={() => onSampleSelected(sample)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-left transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <ImageIcon
                className="w-3.5 h-3.5 text-slate-500 shrink-0"
                aria-hidden="true"
              />
              <span className="text-xs font-medium text-slate-800">
                {sample.label}
              </span>
              <span className="text-xs text-slate-400" aria-hidden="true">
                ·
              </span>
              <span className="font-mono text-xs text-slate-500">
                {sample.subtitle.split('·')[1]?.trim()}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
