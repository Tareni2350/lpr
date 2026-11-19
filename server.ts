import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { validateIndianPlate } from './src/lib/indianPlateValidator.ts';
import type {
  AnalysisResult,
  BoundingBox,
  PipelineProgressEvent,
} from './src/types/lpr.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const GEMINI_MODEL = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please verify your environment secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      const isTransient =
        message.includes('429') ||
        message.includes('503') ||
        message.includes('RESOURCE_EXHAUSTED') ||
        message.includes('UNAVAILABLE');
      if (!isTransient || attempt === retries) {
        throw err;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, 600 * Math.pow(2, attempt))
      );
    }
  }
  throw lastError;
}

/**
 * Computes an objective sharpness score using discrete 2D Laplacian energy
 * on the grayscale plate crop. Higher values indicate crisper character edges.
 */
async function measureSharpness(buffer: Buffer): Promise<number> {
  const { data, info } = await sharp(buffer)
    .grayscale()
    .resize({ width: 320, withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  if (w < 3 || h < 3) return 0;

  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const laplacian =
        data[idx - w] +
        data[idx + w] +
        data[idx - 1] +
        data[idx + 1] -
        4 * data[idx];
      sum += laplacian;
      sumSq += laplacian * laplacian;
      count++;
    }
  }

  if (count === 0) return 0;
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return Number(Math.sqrt(Math.max(0, variance)).toFixed(1));
}

function sendEvent(res: Response, event: PipelineProgressEvent): void {
  res.write(JSON.stringify(event) + '\n');
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/analyze', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    try {
      const { imageBase64, mimeType, forceEnhance } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        forceEnhance?: boolean;
      };

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        sendEvent(res, {
          type: 'error',
          stage: 'error',
          progress: 0,
          message: 'No image data received.',
          error: 'Please upload a valid vehicle image (JPG, PNG, or WebP).',
        });
        res.end();
        return;
      }

      const rawBase64 = imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64;
      const inputBuffer = Buffer.from(rawBase64, 'base64');

      // Normalize EXIF orientation so detection coordinates and cropping match 1:1
      const { data: orientedBuffer, info: orientedInfo } = await sharp(
        inputBuffer
      )
        .rotate()
        .jpeg({ quality: 92 })
        .toBuffer({ resolveWithObject: true });

      const originalWidth = orientedInfo.width;
      const originalHeight = orientedInfo.height;
      const orientedImageDataUrl = `data:image/jpeg;base64,${orientedBuffer.toString('base64')}`;
      const orientedBase64 = orientedBuffer.toString('base64');

      const ai = getAiClient();

      // STAGE 1: Detect license plate bounding box
      sendEvent(res, {
        type: 'progress',
        stage: 'detect',
        progress: 18,
        message: 'Locating vehicle license plate region…',
      });

      const detectResponse = await withRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType?.startsWith('image/')
                    ? 'image/jpeg'
                    : 'image/jpeg',
                  data: orientedBase64,
                },
              },
              {
                text:
                  'Locate the primary vehicle license plate in this image. ' +
                  'Return tight normalized bounding box coordinates (0 to 1000 scale, where ymin/xmin is top-left and ymax/xmax is bottom-right). ' +
                  'If the plate is angled or tilted, encompass the full plate corners tightly. ' +
                  'If multiple vehicles exist, pick the most prominent foreground vehicle license plate. ' +
                  'Set plateDetected to false only if no license plate is visible at all.',
              },
            ],
          },
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                plateDetected: { type: Type.BOOLEAN },
                ymin: { type: Type.INTEGER },
                xmin: { type: Type.INTEGER },
                ymax: { type: Type.INTEGER },
                xmax: { type: Type.INTEGER },
                angleAssessment: { type: Type.STRING },
                detectionNotes: { type: Type.STRING },
              },
              required: [
                'plateDetected',
                'ymin',
                'xmin',
                'ymax',
                'xmax',
                'angleAssessment',
                'detectionNotes',
              ],
            },
          },
        })
      );

      const detectJson = JSON.parse((detectResponse.text ?? '{}').trim()) as {
        plateDetected: boolean;
        ymin: number;
        xmin: number;
        ymax: number;
        xmax: number;
        angleAssessment: string;
        detectionNotes: string;
      };

      if (
        !detectJson.plateDetected ||
        detectJson.xmax <= detectJson.xmin ||
        detectJson.ymax <= detectJson.ymin
      ) {
        sendEvent(res, {
          type: 'error',
          stage: 'error',
          progress: 18,
          message: 'No license plate detected in the image.',
          error:
            detectJson.detectionNotes ||
            'Could not locate a visible vehicle license plate. Try uploading a clearer photo showing the front or rear of the vehicle.',
        });
        res.end();
        return;
      }

      const boundingBox: BoundingBox = {
        ymin: clamp(detectJson.ymin, 0, 1000),
        xmin: clamp(detectJson.xmin, 0, 1000),
        ymax: clamp(detectJson.ymax, 0, 1000),
        xmax: clamp(detectJson.xmax, 0, 1000),
      };

      // STAGE 2: Crop detected plate with gentle padding
      sendEvent(res, {
        type: 'progress',
        stage: 'crop',
        progress: 38,
        message: 'Cropping detected license plate region…',
      });

      const rawLeft = Math.floor((boundingBox.xmin / 1000) * originalWidth);
      const rawTop = Math.floor((boundingBox.ymin / 1000) * originalHeight);
      const rawRight = Math.ceil((boundingBox.xmax / 1000) * originalWidth);
      const rawBottom = Math.ceil((boundingBox.ymax / 1000) * originalHeight);

      const boxW = Math.max(16, rawRight - rawLeft);
      const boxH = Math.max(12, rawBottom - rawTop);
      const padX = Math.round(boxW * 0.08);
      const padY = Math.round(boxH * 0.14);

      const left = clamp(rawLeft - padX, 0, originalWidth - 1);
      const top = clamp(rawTop - padY, 0, originalHeight - 1);
      const right = clamp(rawRight + padX, left + 1, originalWidth);
      const bottom = clamp(rawBottom + padY, top + 1, originalHeight);
      const cropW = right - left;
      const cropH = bottom - top;

      const { data: croppedBuffer, info: cropInfo } = await sharp(
        orientedBuffer
      )
        .extract({ left, top, width: cropW, height: cropH })
        .png()
        .toBuffer({ resolveWithObject: true });

      const croppedPlateDataUrl = `data:image/png;base64,${croppedBuffer.toString('base64')}`;

      // STAGE 3: Assess blurriness & resolution
      sendEvent(res, {
        type: 'progress',
        stage: 'assess_blur',
        progress: 56,
        message: 'Evaluating plate sharpness and resolution…',
        partial: {
          croppedPlateDataUrl,
        },
      });

      const sharpnessScore = await measureSharpness(croppedBuffer);
      const isLowResolution = cropInfo.width < 180 || cropInfo.height < 55;
      const isSoftEdges = sharpnessScore < 45;
      const isBlurry = isLowResolution || isSoftEdges;

      const blurReason = isLowResolution && isSoftEdges
        ? `Low crop resolution (${cropInfo.width}×${cropInfo.height}px) and soft edge contrast (score ${sharpnessScore}).`
        : isLowResolution
          ? `Low crop resolution (${cropInfo.width}×${cropInfo.height}px) benefits from upscaling and edge sharpening.`
          : isSoftEdges
            ? `Soft character edges detected (sharpness score ${sharpnessScore} < 45 threshold).`
            : `Crisp edges and adequate resolution (${cropInfo.width}×${cropInfo.height}px, score ${sharpnessScore}).`;

      const blurAssessment = {
        sharpnessScore,
        isBlurry,
        reason: blurReason,
        croppedWidth: cropInfo.width,
        croppedHeight: cropInfo.height,
      };

      // STAGE 4: Conditional enhancement
      const shouldEnhance = Boolean(isBlurry || forceEnhance);
      let enhancedBuffer: Buffer | null = null;
      let enhancedPlateDataUrl: string | null = null;

      if (shouldEnhance) {
        sendEvent(res, {
          type: 'progress',
          stage: 'enhance',
          progress: 72,
          message: forceEnhance && !isBlurry
            ? 'Applying manual clarity & contrast enhancement…'
            : 'Blurry or low-resolution plate detected — enhancing clarity…',
          partial: { blurAssessment },
        });

        const targetWidth = Math.max(cropInfo.width * 2, 560);
        enhancedBuffer = await sharp(croppedBuffer)
          .resize({
            width: targetWidth,
            kernel: sharp.kernel.lanczos3,
          })
          .normalize({ lower: 2, upper: 98 })
          .modulate({ brightness: 1.05 })
          .sharpen({ sigma: 1.4, m1: 1.1, m2: 2.2 })
          .png()
          .toBuffer();

        enhancedPlateDataUrl = `data:image/png;base64,${enhancedBuffer.toString('base64')}`;
      } else {
        sendEvent(res, {
          type: 'progress',
          stage: 'enhance',
          progress: 72,
          message: 'Plate is already sharp — skipping enhancement.',
          partial: { blurAssessment },
        });
      }

      // STAGE 5: OCR extraction on processed plate
      sendEvent(res, {
        type: 'progress',
        stage: 'ocr',
        progress: 86,
        message: 'Extracting license plate characters via OCR…',
        partial: {
          enhancementApplied: shouldEnhance,
          enhancedPlateDataUrl,
        },
      });

      const plateForOcr = enhancedBuffer ?? croppedBuffer;
      const ocrResponse = await withRetry(() =>
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: plateForOcr.toString('base64'),
                },
              },
              {
                text:
                  'Read the Indian vehicle license plate characters from this cropped plate image. ' +
                  'Return ONLY the registration number characters in rawText (uppercase letters and digits, e.g. "KA 05 MJ 4821" or "MH 12 DE 1433" or "22 BH 1234 AA"). ' +
                  'Ignore the small blue "IND" country sticker/mark on the left edge if present. ' +
                  'Be careful not to confuse 0/O, 1/I, 5/S, 8/B, 2/Z — follow Indian plate positional rules where the first 2 characters are letters, next 2 are digits, followed by 1-3 letters, and 4 trailing digits (except BH series: 2 digits + BH + 4 digits + 1-2 letters). ' +
                  'Also identify the plate background color category.',
              },
            ],
          },
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                rawText: { type: Type.STRING },
                plateCategory: {
                  type: Type.STRING,
                  description:
                    'One of: White (Private), Yellow (Commercial), Green (Electric), Black (Rental), Blue (Diplomatic), Red (Temporary), Unknown',
                },
                ocrConfidence: {
                  type: Type.STRING,
                  description: 'High, Medium, or Low',
                },
                observations: { type: Type.STRING },
              },
              required: [
                'rawText',
                'plateCategory',
                'ocrConfidence',
                'observations',
              ],
            },
          },
        })
      );

      const ocrJson = JSON.parse((ocrResponse.text ?? '{}').trim()) as {
        rawText: string;
        plateCategory: string;
        ocrConfidence: 'High' | 'Medium' | 'Low';
        observations: string;
      };

      // STAGE 6: Indian Format Validation
      sendEvent(res, {
        type: 'progress',
        stage: 'validate',
        progress: 96,
        message: 'Validating extracted text against Indian RTO formats…',
      });

      const validation = validateIndianPlate(ocrJson.rawText || '');

      const finalResult: AnalysisResult = {
        originalWidth,
        originalHeight,
        orientedImageDataUrl,
        boundingBox,
        angleAssessment: detectJson.angleAssessment || 'Standard view',
        detectionNotes: detectJson.detectionNotes || '',
        croppedPlateDataUrl,
        blurAssessment,
        enhancementApplied: shouldEnhance,
        enhancedPlateDataUrl,
        rawOcrText: ocrJson.rawText || '',
        plateCategory: ocrJson.plateCategory || 'Unknown',
        ocrConfidence:
          ocrJson.ocrConfidence === 'High' ||
          ocrJson.ocrConfidence === 'Medium' ||
          ocrJson.ocrConfidence === 'Low'
            ? ocrJson.ocrConfidence
            : 'Medium',
        ocrObservations: ocrJson.observations || '',
        validation,
      };

      sendEvent(res, {
        type: 'complete',
        stage: 'complete',
        progress: 100,
        message: validation.isValid
          ? `Validated ${validation.formattedPlate}`
          : 'Analysis complete — format review required',
        result: finalResult,
      });
      res.end();
    } catch (err: unknown) {
      console.error('Analyze pipeline error:', err);
      const rawMessage = err instanceof Error ? err.message : String(err);
      let userMessage = 'Failed to process the vehicle image.';
      if (
        rawMessage.includes('API_KEY_INVALID') ||
        rawMessage.includes('PERMISSION_DENIED') ||
        rawMessage.includes('GEMINI_API_KEY')
      ) {
        userMessage =
          'Gemini API key is missing or invalid. Please check Settings > Secrets.';
      } else if (rawMessage.includes('RESOURCE_EXHAUSTED')) {
        userMessage =
          'API rate limit reached. Please wait a moment and try again.';
      } else if (rawMessage) {
        userMessage = rawMessage;
      }

      sendEvent(res, {
        type: 'error',
        stage: 'error',
        progress: 0,
        message: 'Processing error',
        error: userMessage,
      });
      res.end();
    }
  });

  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EnhanceLPR server listening on http://localhost:${PORT}`);
  });
}

startServer();
