// Centralized Gemini Model Configuration
// Updated for production Gemini API models

export const MODELS = {
  // === TEXT GENERATION ===
  TEXT_DEFAULT: 'gemini-flash-lite-latest',           // Primary fast & reliable text model
  TEXT_PREMIUM: 'gemini-pro-latest',             // Deep reasoning & complex strategy model
  TEXT_FALLBACK: 'gemini-flash-lite-latest',           // Stable fallback model
  
  // === IMAGE GENERATION ===
  // Gemini Native Image Gen (Nano Banana series)
  IMAGE_DEFAULT: 'gemini-3.1-flash-image',  // Recommended default
  IMAGE_FAST: 'gemini-3.1-flash-image',     // Fastest option
  IMAGE_NANO_BANANA_2: 'gemini-3.1-flash-image',
  
  // Imagen Family
  IMAGEN_4_STANDARD: 'imagen-4.0-generate-001',      // High quality
  IMAGEN_4_ULTRA: 'imagen-4.0-ultra-generate-001',    // Highest quality  
  IMAGEN_4_FAST: 'imagen-4.0-fast-generate-001',      // Quick generation
  IMAGEN_3_STANDARD: 'imagen-3.0-generate-002',      // Stable Imagen 3
} as const;

// Automatic model normalizer to map deprecated/unsupported model strings to valid active endpoints
export const normalizeModelName = (modelName: string): string => {
  if (!modelName) return MODELS.TEXT_DEFAULT;
  const m = modelName.toLowerCase();
  
  // Map deprecated 2.5 flash / 3.x flash strings that return 404 to active 2.0-flash
  if (m.includes('2.5-flash') || m.includes('3.6-flash') || m.includes('3.5-flash')) {
    return MODELS.TEXT_DEFAULT;
  }
  // Map deprecated 2.5 pro to 1.5-pro
  if (m.includes('2.5-pro') || m.includes('3.1-pro')) {
    return MODELS.TEXT_PREMIUM;
  }
  // Map deprecated image model names
  if (m.includes('3-pro-image') || m.includes('2.5-flash-image')) {
    return MODELS.IMAGE_DEFAULT;
  }
  return modelName;
};

// Image model fallback chain for resilience
export const IMAGE_FALLBACK_MODELS = [
  MODELS.IMAGE_DEFAULT,
  MODELS.IMAGEN_4_FAST,
  MODELS.IMAGEN_3_STANDARD,
] as const;

// Model display names for UI dropdowns
export const IMAGE_MODEL_OPTIONS = [
  { value: MODELS.IMAGE_DEFAULT, label: 'Gemini Image Gen (Recommended)', tier: 'free' as const },
  { value: MODELS.IMAGEN_4_FAST, label: 'Imagen 4 Fast', tier: 'paid' as const },
  { value: MODELS.IMAGEN_4_STANDARD, label: 'Imagen 4 Standard (HD)', tier: 'paid' as const },
  { value: MODELS.IMAGEN_4_ULTRA, label: 'Imagen 4 Ultra (Best Quality)', tier: 'paid' as const },
] as const;

export const TEXT_MODEL_OPTIONS = [
  { value: MODELS.TEXT_DEFAULT, label: 'Gemini 2.0 Flash (Fast)', tier: 'free' as const },
  { value: MODELS.TEXT_PREMIUM, label: 'Gemini 1.5 Pro (Premium)', tier: 'paid' as const },
] as const;

// Check if a model is in the Imagen family (requires different API handling)
export const isImagenModel = (model: string): boolean => 
  model.startsWith('imagen-');

// Check if a model is a paid-tier model
export const isPaidModel = (model: string): boolean => 
  model.includes('pro') || model.startsWith('imagen-') || model.includes('ultra');





