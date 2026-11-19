# EnhanceLPR: AI-Powered License Plate Recognition

EnhanceLPR is a focused web application for detecting, enhancing, extracting, and validating Indian vehicle license plates from uploaded photographs.

## Features

- **Image Upload & Sample Presets**: Drag and drop or browse JPG, PNG, and WebP vehicle images, or test immediately with bundled daylight and dusk traffic-cam sample photos.
- **Automated AI & CV Pipeline**:
  1. **Detect Plate**: Uses Gemini (`gemini-4-hydrogen`) with structured JSON output to locate tight bounding-box coordinates (`ymin, xmin, ymax, xmax`), even for angled plates.
  2. **Crop Region**: Auto-orients EXIF metadata and crops the detected license plate region on the server using `sharp` with protective margin padding.
  3. **Assess Blur**: Computes a discrete 2D Laplacian edge-sharpness score and inspects crop pixel dimensions to determine whether the plate is crisp or blurry/low-resolution.
  4. **Conditional Enhancement**: When the cropped plate is blurry or low-resolution (or when manually requested via **Enhance Anyway**), applies Lanczos3 upscaling, percentile contrast normalization, and unsharp-mask sharpening.
  5. **OCR Extraction**: Extracts the registration characters and plate color category from the processed crop.
  6. **Indian Format Validation**: Normalizes the extracted string (stripping accidental `IND` HSRP sticker prefixes) and validates it against official Indian license plate standards.
- **Live Step-by-Step Progress**: Streams real-time NDJSON stage updates from the backend to show the active stage and overall completion percentage.
- **Structured Visual Feedback**: Displays the original vehicle photo with a toggleable bounding-box overlay, the cropped plate, the enhanced plate (when applied), formatted registration output (`AA 00 AA 0000` / `00 BH 0000 AA`), State/UT decoding, and a rule-by-rule validation checklist.

## Supported Indian License Plate Formats

| Format Type | Pattern | Example | Notes |
| :--- | :--- | :--- | :--- |
| **Standard State / UT RTO** | `AA 00 AA 0000` | `KA 05 MJ 4821` | 2-letter State/UT code, 2-digit RTO code, 1–3 series letters, 4-digit number |
| **Delhi Single-Digit RTO** | `DL 0A AA 0000` | `DL 1C AA 1234` | Legacy/Delhi single-digit RTO format |
| **Bharat (BH) Series** | `00 BH 0000 AA` | `22 BH 1234 AA` | 2-digit year, `BH` identifier, 4 digits, 1–2 letters (excluding `I` and `O`) |

All 36 Indian States and Union Territories (including `TG` and `TS` for Telangana, `OD`/`OR` for Odisha, `UK`/`UA` for Uttarakhand, and `LA` for Ladakh) are verified during validation.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons
- **Backend**: Express (`server.ts`) with NDJSON streaming
- **AI & Vision**: `@google/genai` (`gemini-4-hydrogen`) for bounding-box localization & OCR; `sharp` for EXIF orientation, cropping, Laplacian blur scoring, and conditional image enhancement

## Project Structure

```text
├── server.ts                         # Express server, Vite middleware, and /api/analyze pipeline
├── src/
│   ├── App.tsx                       # Main application state, streaming client, and layout
│   ├── components/
│   │   ├── PipelineProgress.tsx      # 5-stage progress indicator
│   │   ├── ResultsView.tsx           # Bounding box viewer, crop/enhancement comparison, and plate data
│   │   └── UploadDropzone.tsx        # Drag-and-drop uploader and sample presets
│   ├── lib/
│   │   └── indianPlateValidator.ts   # Normalization, State/UT lookup, and format validation rules
│   └── types/
│       └── lpr.ts                    # Shared TypeScript interfaces
└── README.md
```

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Ensure `GEMINI_API_KEY` is set in your environment (see `.env.example`).

3. **Run in development**:
   ```bash
   npm run dev
   ```
   The application runs on `http://localhost:3000`.

4. **Build for production**:
   ```bash
   npm run build
   ```
