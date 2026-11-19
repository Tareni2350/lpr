export type PipelineStage =
  | 'idle'
  | 'detect'
  | 'crop'
  | 'assess_blur'
  | 'enhance'
  | 'ocr'
  | 'validate'
  | 'complete'
  | 'error';

export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface ValidationCheck {
  label: string;
  passed: boolean;
  detail: string;
}

export interface PlateValidationResult {
  isValid: boolean;
  formatType:
    | 'Standard State/UT RTO'
    | 'Bharat (BH) Series'
    | 'Delhi Legacy / Single-Digit RTO'
    | 'Invalid / Non-Standard';
  rawInput: string;
  normalizedCompact: string;
  formattedPlate: string;
  stateCode: string | null;
  stateName: string | null;
  rtoCode: string | null;
  seriesCode: string | null;
  registrationNumber: string | null;
  registrationYear: string | null;
  strippedIndPrefix: boolean;
  checks: ValidationCheck[];
  summary: string;
}

export interface BlurAssessment {
  sharpnessScore: number;
  isBlurry: boolean;
  reason: string;
  croppedWidth: number;
  croppedHeight: number;
}

export interface AnalysisResult {
  originalWidth: number;
  originalHeight: number;
  orientedImageDataUrl: string;
  boundingBox: BoundingBox;
  angleAssessment: string;
  detectionNotes: string;
  croppedPlateDataUrl: string;
  blurAssessment: BlurAssessment;
  enhancementApplied: boolean;
  enhancedPlateDataUrl: string | null;
  rawOcrText: string;
  plateCategory: string;
  ocrConfidence: 'High' | 'Medium' | 'Low';
  ocrObservations: string;
  validation: PlateValidationResult;
}

export interface PipelineProgressEvent {
  type: 'progress' | 'partial' | 'complete' | 'error';
  stage: PipelineStage;
  progress: number;
  message: string;
  partial?: Partial<AnalysisResult>;
  result?: AnalysisResult;
  error?: string;
}
