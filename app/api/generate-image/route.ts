import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

// In-memory cache: maps apiKey -> { models: string[], fetchedAt: number }
const modelCache: Map<string, { models: string[]; fetchedAt: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function getAvailableModels(apiKey: string): Promise<string[]> {
  const cached = modelCache.get(apiKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.models;
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    const models: string[] = (data.models || []).map((m: any) =>
      (m.name || '').replace('models/', '')
    );
    modelCache.set(apiKey, { models, fetchedAt: Date.now() });
    return models;
  } catch {
    return [];
  }
}

function pickBestImageModel(available: string[], requested: string): string {
  if (available.includes(requested)) return requested;

  const priority = [
    'gemini-2.5-flash-image',
    'gemini-3.1-flash-image',
    'gemini-3.1-flash-image-preview',
    'gemini-3-pro-image',
    'gemini-3-pro-image-preview',
  ];
  for (const m of priority) {
    if (available.includes(m)) return m;
  }

  // Fallback: any model with 'image' in name that isn't TTS/audio
  const anyImage = available.find(
    (m) => m.includes('image') && !m.includes('tts') && !m.includes('audio')
  );
  return anyImage || requested;
}

function pickBestImagenModel(available: string[], requested: string): string {
  if (available.includes(requested)) return requested;

  const priority = [
    'imagen-4.0-generate-001',
    'imagen-4.0-fast-generate-001',
    'imagen-4.0-ultra-generate-001',
  ];
  for (const m of priority) {
    if (available.includes(m)) return m;
  }
  return requested;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey =
      request.headers.get('x-api-key') || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'No API key configured.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { model, prompt, referenceImages, config } = body;

    if (!model || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: model and prompt' },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const availableModels = await getAvailableModels(apiKey);

    const isImagen = model.startsWith('imagen-');

    if (isImagen) {
      const targetModel =
        availableModels.length > 0
          ? pickBestImagenModel(availableModels, model)
          : model;

      console.log(`[generate-image] imagen requested="${model}" resolved="${targetModel}"`);

      const imageConfig: any = {
        numberOfImages: 1,
        aspectRatio: config?.aspectRatio || '1:1',
      };
      if (config?.negativePrompt) {
        imageConfig.negativePrompt = config.negativePrompt;
      }

      const response = await ai.models.generateImages({
        model: targetModel,
        prompt,
        config: imageConfig,
      });

      if (response.generatedImages && response.generatedImages.length > 0) {
        const img = response.generatedImages[0];
        return NextResponse.json({
          image: {
            data: img.image?.imageBytes || '',
            mimeType: 'image/png',
          },
        });
      }

      return NextResponse.json(
        { error: 'No image generated. The model may have refused the prompt.' },
        { status: 422 }
      );
    } else {
      // === GEMINI NATIVE IMAGE GEN ===
      const targetModel =
        availableModels.length > 0
          ? pickBestImageModel(availableModels, model)
          : model;

      console.log(`[generate-image] gemini requested="${model}" resolved="${targetModel}"`);

      const parts: any[] = [];

      if (referenceImages && referenceImages.length > 0) {
        for (const refImg of referenceImages) {
          parts.push({
            inlineData: {
              mimeType: refImg.mimeType || 'image/jpeg',
              data: refImg.data,
            },
          });
        }
      }

      const aspectRatioString = config?.aspectRatio 
        ? `\n\n[CRITICAL REQUIREMENT: You MUST generate this image in exactly ${config.aspectRatio} aspect ratio. Ensure the image dimensions perfectly match this ratio.]` 
        : '';
      parts.push({ text: prompt + aspectRatioString });

      const response = await ai.models.generateContent({
        model: targetModel,
        contents: [{ role: 'user', parts }],
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          temperature: config?.temperature || 1.0,
        },
      });

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            return NextResponse.json({
              image: {
                data: part.inlineData.data,
                mimeType: part.inlineData.mimeType || 'image/png',
              },
              text: response.candidates[0].content.parts
                .filter((p: any) => p.text)
                .map((p: any) => p.text)
                .join(''),
            });
          }
        }
      }

      const text = response.text || '';
      return NextResponse.json({
        text,
        error:
          'No image data found in response. The model may have refused or returned text only.',
      });
    }
  } catch (error: any) {
    console.error('Image Generation Error:', error?.message || error);

    const status = error.status || error.httpStatusCode || 500;
    const errorMessage = error.message || 'Image generation failed';

    return NextResponse.json(
      {
        error: errorMessage,
        status: status >= 500 ? 'UNAVAILABLE' : 'FAILED',
        error_details: { code: status, message: errorMessage },
      },
      { status }
    );
  }
}
