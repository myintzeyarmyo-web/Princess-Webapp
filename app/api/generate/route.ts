import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

// In-memory cache: maps apiKey -> { models: string[], fetchedAt: number }
const modelCache: Map<string, { models: string[]; fetchedAt: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fetch all available model names for a given API key
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

// Pick the best text model from what's available on this key
// Priority order: gemini-2.5-flash > gemini-2.5-pro > gemini-flash-latest > any flash model
function pickBestTextModel(available: string[], requestedModel: string): string {
  // If the requested model is literally available, use it
  if (available.includes(requestedModel)) return requestedModel;

  // Priority list of known-good text models
  const priority = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite-preview-02-25',
    'gemini-flash-latest',
    'gemini-pro-latest',
    'gemini-flash-lite-latest',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ];

  for (const m of priority) {
    if (available.includes(m)) return m;
  }

  // Last resort: any model with 'flash' in the name that isn't image/tts/audio/live
  const anyFlash = available.find(
    (m) =>
      m.includes('flash') &&
      !m.includes('image') &&
      !m.includes('tts') &&
      !m.includes('audio') &&
      !m.includes('live')
  );
  if (anyFlash) return anyFlash;

  // Absolute last resort: return whatever was requested and hope for the best
  return requestedModel;
}

export async function POST(request: NextRequest) {
  try {
    let apiKey = request.headers.get('x-api-key') || process.env.GEMINI_API_KEY || '';
    apiKey = apiKey.trim().replace(/^["']|["']$/g, '');
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'No API key configured. Please add your Gemini API key.' },
        { status: 401 }
      );
    }

    const keySnippet = apiKey.substring(0, 8) + '...';
    const body = await request.json();
    const { model, contents, config } = body;

    if (!model || !contents) {
      return NextResponse.json(
        { error: 'Missing required fields: model and contents' },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Build generation config
    const generateConfig: any = {};
    if (config) {
      if (config.temperature !== undefined)
        generateConfig.temperature = config.temperature;
      if (config.maxOutputTokens)
        generateConfig.maxOutputTokens = config.maxOutputTokens;
      if (config.topP !== undefined) generateConfig.topP = config.topP;
      if (config.topK !== undefined) generateConfig.topK = config.topK;
      if (config.responseMimeType)
        generateConfig.responseMimeType = config.responseMimeType;
      if (config.responseSchema)
        generateConfig.responseSchema = config.responseSchema;
      if (config.responseModalities)
        generateConfig.responseModalities = config.responseModalities;
    }

    const isImageGen = config?.responseModalities?.includes('IMAGE');

    // Build contents in SDK format
    let sdkContents: any;
    if (Array.isArray(contents)) {
      sdkContents = contents;
    } else if (typeof contents === 'string') {
      sdkContents = contents;
    } else if (contents.parts) {
      sdkContents = [contents];
    } else {
      sdkContents = contents;
    }

    // === DYNAMIC MODEL RESOLUTION ===
    const availableModels = await getAvailableModels(apiKey);
    const targetModel =
      availableModels.length > 0
        ? pickBestTextModel(availableModels, model)
        : model;

    console.log(`[generate] key="${keySnippet}" requested="${model}" resolved="${targetModel}"`);

    const response = await ai.models.generateContent({
      model: targetModel,
      contents: sdkContents,
      config: generateConfig,
    });

    // Handle image generation responses
    if (isImageGen && response.candidates?.[0]?.content?.parts) {
      const parts = response.candidates[0].content.parts;
      const result: any = { text: '', candidates: response.candidates };
      for (const part of parts) {
        if (part.text) result.text += part.text;
        if (part.inlineData) {
          result.image = {
            data: part.inlineData.data,
            mimeType: part.inlineData.mimeType,
          };
        }
      }
      return NextResponse.json(result);
    }

    // Handle text responses
    const text = response.text || '';
    return NextResponse.json({ text, candidates: response.candidates });
  } catch (error: any) {
    console.error('API Generate Error:', error?.message || error);

    const status = error.status || error.httpStatusCode || 500;
    const errorMessage = error.message || 'Internal server error';
    const errorStatus =
      error.errorDetails?.[0]?.reason ||
      (status === 429
        ? 'RESOURCE_EXHAUSTED'
        : status === 503
          ? 'UNAVAILABLE'
          : 'INTERNAL');

    return NextResponse.json(
      {
        error: errorMessage,
        status: errorStatus,
        error_details: {
          code: status,
          status: errorStatus,
          message: errorMessage,
        },
      },
      { status }
    );
  }
}
