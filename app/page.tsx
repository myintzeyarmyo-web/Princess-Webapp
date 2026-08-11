'use client';

import { useState, useEffect, useRef } from 'react';
import NextImage from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Calendar, Zap, Image as ImageIcon, Loader2, Download, ArrowLeft, PenTool, Layout, Target, MessageSquare, FileText, Key, Save, Upload, Edit2, Check, X, Copy, Wand2, RefreshCw, Settings, Camera, Undo, Redo, User, Trash2, FolderOpen, Plus, Eye, Database } from 'lucide-react';
import Markdown from 'react-markdown';
import { ThemeToggle } from '@/components/theme-toggle';
import { nuSkinProducts } from './nuskin-data';
import { supabase } from '@/lib/supabaseClient';

// Schema type constants to replace the @google/genai Type enum
// These string values are serialized to the API route which converts them back
const SchemaType = {
  OBJECT: 'OBJECT',
  ARRAY: 'ARRAY',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  INTEGER: 'INTEGER',
  BOOLEAN: 'BOOLEAN',
} as const;

// Server-side AI proxy helper — all Gemini calls go through /api/generate
// This keeps the API key secure on the server
const callAI = async (
  model: string,
  contents: any,
  config?: any,
  userApiKey?: string
): Promise<{ text: string; candidates?: any }> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (userApiKey) {
    headers['x-api-key'] = userApiKey;
  }

  const res = await fetch('/api/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, contents, config }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: 'Unknown error' }));
    const error: any = new Error(errorBody.error || `API Error ${res.status}`);
    error.status = res.status;
    error.code = errorBody.status || res.status;
    error.error = errorBody.error_details || { code: res.status, status: res.status >= 500 ? 'UNAVAILABLE' : 'FAILED' };
    throw error;
  }

  return res.json();
};



const MYANMAR_STRATEGIST_PROMPT = `You are an elite Myanmar content strategist. Expert in: Myanmar digital copywriting, TikTok/Facebook/Reels trend culture, Myanmar audience psychology, brand voice architecture, viral hook writing.

[ CORE RULES ]
1. ALL content MUST adapt 100% to the given Target Audience and Content Style/Vibe.
2. Audience Adaptation:
   - Gen Z: Use internet slang naturally ("bro", "sis", "lit", "slay", "POV:", "delulu")
   - Women 30-50 / Professionals / Mothers: NO slang. Elegant, empathetic, trustworthy tone. Use "ညီမတို့", "မမတို့", "ရှင်"
   - B2B/Corporate: Professional, precise, value-driven tone
3. Write how Myanmar people ACTUALLY speak — casual, real, relatable. NOT formal/textbook style.
4. Mix Myanmar-English (Myanglish) using words the target audience understands.
5. Platform tone: TikTok=short+energetic, Facebook=community+emotional storytelling, Instagram=aesthetic+aspirational
6. Myanmar psychology: family/community/status matters, gentle humor accepted, use correct respect language.

[ HUMANIZATION — CRITICAL ]
Content MUST feel 100% human-written, never AI-generated.
- Natural flow: vary sentence lengths, use "..." for emotional pauses, break perfect symmetry
- Emotional depth: go beyond surface benefits — use real micro-moments (morning routine, friends complimenting, mirror confidence)
- Pain points with empathy: "ဒါ ကျွန်မလည်း ဖြတ်သန်းခဲ့ဖူးတာပါ" style
- Use specific sensory details instead of generic adjectives ("ကလေးရဲ့ ပါးပြင်လိုမျိုး နူးနူးညင်ညင်" not just "နူးညံ့")
- Use specific numbers ("၇ ရက်ပဲ ကြာတယ်" not "ရက်အနည်းငယ်")
- Anti-AI: Start with story/scenario not "ဒီ product ဟာ...", use narrative flow not bullet lists, add parenthetical asides "(ဟုတ်ဘူးလား?)", self-corrections

[ MYANMAR GRAMMAR ]
- Zero spelling errors. Correct particles (ကို/က/ကော/မှ/တွင်/၌). SOV word order (not English SVO). Match formal vs colloquial to audience.

[ HOOKS ] POV, Curiosity gap, Callout, Before/After, Number hooks. Headline max 12 syllables. Lead with biggest benefit or pain point.

[ BODY ] Hook → Problem amplify → Insight → Proof → CTA. White space between sections. Pattern interrupts. Avoid: corporate tone, translated-from-English feel, fake urgency.

[ OUTPUT ] 2-3 variations per request. Label platform/format. Explain hook psychology in Myanmar. Flag short shelf-life slang.

Energy: confident + warm + ကြည်ချင်စဖွယ် + မြန်မာ ချိုချိုလေး humor\\n\\n`;

interface UserProfile {
  id: string;
  name: string;
  emoji: string;
  gemini_api_key: string | null;
  created_at: string;
}

interface SavedTemplate {
  id: string;
  name: string;
  product_name: string;
  product_benefits: string;
  emotional_response: string;
  target_audience: string;
  campaign_goal: string;
  framework: string;
  tone: string;
  platform: string;
  content_pillars: string;
  cta_style: string;
  reels_count: number;
  carousel_count: number;
  days_count: number;
  product_image_urls: string[];
  created_at: string;
  updated_at: string;
  user_profile_id?: string;
}

interface PlanItem {
  day: number;
  title: string;
  format: string;
  hook: string;
  summary: string;
}

interface PostVariation {
  id: string;
  title: string;
  platform: string;
  content: string;
  explanation: string;
  flags?: string;
  visualDirection?: string;
}

// Helper to get Nu Skin product context
const getProductContext = (name: string) => {
  if (!name) return '';
  const lowerName = name.toLowerCase();
  const matchedProduct = nuSkinProducts.find(p => 
    lowerName.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(lowerName)
  );
  
  if (matchedProduct) {
    return `
[NU SKIN PRODUCT KNOWLEDGE BASE MATCH]
Product Name: ${matchedProduct.name}
Target Area: ${matchedProduct.targetArea}
Usage Instructions: ${matchedProduct.usage}
Key Benefits: ${matchedProduct.benefits}
Critical Warnings/Rules: ${matchedProduct.warnings}
`;
  }
  return '';
};

// =============================================================================
// BEAUTY & HEALTH VIRAL CONTENT TRAINING DATASET
// Pre-trained topics, hooks, and few-shot examples for the Instant Lifestyle Post generator
// =============================================================================
const BEAUTY_HEALTH_TRAINING_DATA = {
  topics: [
    {
      id: 'topic_001', category: 'skincare', title: 'Skin barrier damage — causes, signs & repair',
      viral_score: 5, content_type: 'myth_bust_educational', target_emotion: 'relief_and_aha_moment',
      recommended_format: 'Myth-bust carousel + before/after text comparison',
      why_viral: 'Everyone has experienced "my skincare stopped working" — massive relatability drives saves and shares.',
      hooks: ['Over-exfoliating is destroying your skin and you don\'t even know it', 'Why your expensive skincare isn\'t working anymore', 'The real reason your skin is always dry'],
      keywords: ['skin barrier', 'ceramide', 'over-exfoliation', 'sensitive skin', 'barrier repair', 'lipid layer', 'skin inflammation'],
      example_post: 'Your moisturizer stopped working? Your skin barrier might be damaged — and your skincare routine could be the cause.\n\nSigns your barrier is broken:\n• Skin feels tight even after moisturizing\n• Redness and sensitivity to products you used to tolerate\n• Breakouts in unusual spots\n• Burning sensation when applying serums\n\nSurprising causes:\n1. Over-exfoliating (2x a week max)\n2. Using too many active ingredients at once\n3. Hot showers — they strip your lipid layer\n\nThe fix: Stop all actives. Switch to a fragrance-free gentle cleanser. Layer a ceramide moisturizer. Give it 2 weeks.\n\nMyth: If it tingles, it\'s working. NO — tingling = irritation = barrier damage.'
    },
    {
      id: 'topic_002', category: 'skincare', title: 'SPF myths that are aging your skin faster',
      viral_score: 5, content_type: 'myth_bust', target_emotion: 'urgency_and_shock',
      recommended_format: 'Myth vs Fact listicle + infographic caption',
      why_viral: 'Sunscreen is the #1 anti-aging product yet most people use it wrong. High stakes = high share rate.',
      hooks: ['SPF 50 is not double the protection of SPF 30', 'You\'re aging faster because of this sunscreen mistake', 'Dark skin needs sunscreen too — here\'s why'],
      keywords: ['sunscreen', 'SPF', 'UV protection', 'anti-aging', 'photoaging', 'UVA', 'UVB', 'broad spectrum'],
      example_post: 'Sunscreen myths that are aging your skin right now:\n\nMYTH: SPF 50 = double the protection of SPF 30\nFACT: SPF 30 blocks 97%. SPF 50 blocks 98%. The real difference? How long before you reapply.\n\nMYTH: Dark skin doesn\'t need sunscreen\nFACT: UV damage causes hyperpigmentation, skin cancer, and premature aging on ALL skin tones.\n\nMYTH: My foundation has SPF so I\'m covered\nFACT: You\'d need to apply 7x your normal foundation amount to get the labeled SPF.\n\nThe rule: Apply every morning. Reapply every 2 hours outdoors.'
    },
    {
      id: 'topic_003', category: 'nutrition', title: 'Foods that secretly cause skin inflammation',
      viral_score: 5, content_type: 'educational_list', target_emotion: 'surprise_and_actionable_relief',
      recommended_format: 'Countdown list with swap suggestions',
      why_viral: 'Food-skin connection is extremely shareable. People are shocked by hidden culprits. Swap format makes it actionable.',
      hooks: ['The breakfast food that\'s making your acne worse', '6 foods your dermatologist quietly avoids', 'Cut these 6 foods for clearer skin in 3 days'],
      keywords: ['anti-inflammatory diet', 'skin food', 'acne diet', 'gut skin connection', 'dairy acne', 'sugar acne', 'omega-6 inflammation'],
      example_post: 'The food in your breakfast might be why your skin won\'t clear up.\n\nFoods silently inflaming your skin:\n1. Refined sugar → spikes insulin → triggers excess sebum → breakouts (Swap: Berries + dark chocolate)\n2. Dairy milk → contains hormones that stimulate oil glands (Swap: Oat milk)\n3. Vegetable oils → high omega-6 → promotes inflammation (Swap: Olive oil)\n4. White bread & white rice → high glycemic → insulin spike (Swap: Sweet potato, quinoa)\n5. Alcohol → dehydrates skin, depletes zinc (Swap: Sparkling water with lemon)\n6. Processed snacks → trans fats → disrupt fatty acid balance (Swap: Nuts, seeds, hummus)\n\n3-day skin reset: Eliminate all 6. Add salmon, leafy greens, and zinc-rich pumpkin seeds.'
    },
    {
      id: 'topic_004', category: 'nutrition', title: 'Collagen-boosting foods vs collagen supplements — the truth',
      viral_score: 4, content_type: 'comparison_educational', target_emotion: 'informed_skepticism_and_empowerment',
      recommended_format: 'Balanced comparison post + science-light explanation',
      why_viral: 'Collagen supplements are a billion-dollar market. The nuanced truth surprises people and drives debate.',
      hooks: ['Your body destroys collagen supplements before they reach your skin', 'Why vitamin C is better than collagen powder', 'The truth about collagen supplements nobody tells you'],
      keywords: ['collagen supplement', 'collagen food', 'anti-aging nutrition', 'vitamin C skin', 'collagen peptides', 'proline', 'glycine'],
      example_post: 'Spending money on collagen supplements? Here\'s what you actually need to know.\n\nWhat collagen does: Keeps skin firm, plump, and bouncy. After 25, your body produces 1% less each year.\n\nThe supplement truth: When you swallow collagen, your stomach breaks it into amino acids. Your body reassembles them wherever it decides — not necessarily your skin.\n\nFoods that directly boost collagen production:\n• Oranges, kiwi, bell peppers → Vitamin C (essential co-factor)\n• Pumpkin seeds, chickpeas → Zinc\n• Dark chocolate, sesame → Copper\n• Bone broth, chicken skin → Proline (collagen precursor)\n• Egg whites → Glycine + proline\n\nThe verdict: A Vitamin C-rich diet is the most evidence-backed collagen strategy.'
    },
    {
      id: 'topic_005', category: 'mental_health', title: 'Stress and skin — the cortisol-acne connection',
      viral_score: 5, content_type: 'science_explainer_empathy', target_emotion: 'validation_and_hope',
      recommended_format: 'Science explainer + mini stress-skin protocol',
      why_viral: 'Stress is universal. The mind-skin connection validates what people feel but can\'t explain. "This explains everything" posts drive massive saves.',
      hooks: ['Your stress is breaking out on your face', 'Why your skin gets worse during hard weeks', 'No product will fix stress-induced acne — here\'s what will'],
      keywords: ['cortisol acne', 'stress skin', 'mind skin connection', 'holistic skincare', 'hormonal acne stress', 'sebum cortisol'],
      example_post: 'If your skin gets worse when life gets harder — that\'s not a coincidence.\n\nWhen you\'re stressed, cortisol spikes. Cortisol tells your skin to produce more oil. More oil = clogged pores = breakouts. It also slows cell turnover, causing dullness, and triggers inflammation that worsens eczema, rosacea, and psoriasis.\n\nNo new serum won\'t fix stress-induced breakouts. Your nervous system needs to calm first.\n\nStress-skin reset (5 minutes):\n• Morning: 4-7-8 breathing × 3 rounds before checking your phone\n• Evening: No screens 30 min before bed\n• Daily: 2L of water. Cortisol is more damaging when you\'re dehydrated\n• Weekly: One thing you genuinely enjoy — not productive, just joyful\n\nYour skin is a mirror of your internal state. Being kind to yourself IS skincare.'
    },
    {
      id: 'topic_006', category: 'mental_health', title: 'Sleep deprivation\'s visible effects on your appearance',
      viral_score: 4, content_type: 'motivational_educational', target_emotion: 'motivating_shock',
      recommended_format: 'Visual effects list + sleep optimization tips',
      why_viral: 'Sleep beauty is a concept people know but underestimate. Specific biological details turn vague advice into compelling must-change motivation.',
      hooks: ['Your skin ages faster when you sleep less than 6 hours', '6 things sleep deprivation is doing to your face right now', 'Free anti-aging treatment you\'re skipping every night'],
      keywords: ['beauty sleep', 'sleep skin', 'HGH skin repair', 'collagen sleep', 'circadian rhythm skin', 'undereye circles sleep'],
      example_post: '"I\'ll sleep when I\'m dead" — your skin is aging faster because of this mindset.\n\nWhat happens when you sleep:\nHours 1-4: Melatonin rises, cell damage slows.\nHours 5-8: Human Growth Hormone peaks → collagen production accelerates → skin cells regenerate.\n\n6 signs of chronic sleep deprivation:\n1. Dull, grey-toned skin (slowed cell turnover)\n2. Puffy eyes (fluid redistribution)\n3. Deeper fine lines that don\'t bounce back\n4. Breakouts along jawline (cortisol spike)\n5. Darker undereye circles (blood vessel dilation)\n6. Dry, dehydrated patches\n\n3 sleep habits that ARE skincare:\n• Cool room (18-19°C) = deeper sleep = more HGH release\n• Silk pillowcase = less friction = fewer morning creases\n• Consistent sleep time = circadian rhythm = predictable skin repair'
    },
    {
      id: 'topic_007', category: 'body_wellness', title: 'Hydration myths — you\'re probably not drinking water correctly',
      viral_score: 5, content_type: 'myth_bust_practical', target_emotion: 'surprise_and_practical_insight',
      recommended_format: 'Myth-bust format + correct hydration method',
      why_viral: '"Drink more water" is the most repeated beauty advice. Showing it\'s more nuanced surprises everyone. Drives shares and saves.',
      hooks: ['8 glasses a day is wrong — here\'s your actual hydration number', 'Why drinking more water isn\'t clearing your skin', 'The hydration mistake keeping your skin dry'],
      keywords: ['skin hydration', 'electrolytes skin', 'hydration myths', 'cellular hydration', 'dewy skin', 'intracellular hydration'],
      example_post: '"Drink 8 glasses of water a day" — this advice is oversimplified and might be why your skin is still dry.\n\nMYTH: Everyone needs 8 glasses daily\nFACT: Your needs depend on weight, climate, activity level, and diet.\n\nMYTH: Water alone hydrates your skin\nFACT: Without electrolytes, water moves through you without fully hydrating cells. Intracellular hydration makes skin plump.\n\nMYTH: Crystal clear urine = optimal hydration\nFACT: Pale yellow is ideal. Clear urine means you\'re flushing electrolytes.\n\nHydrate smarter:\n• Add cucumber, lemon, or a pinch of sea salt to water\n• Eat water-rich foods: watermelon, cucumber, celery\n• Electrolyte boost: coconut water, banana, leafy greens'
    },
    {
      id: 'topic_008', category: 'body_wellness', title: 'Lymphatic drainage — the underrated beauty hack',
      viral_score: 4, content_type: 'how_to_guide', target_emotion: 'discovery_and_empowerment',
      recommended_format: 'Science explainer + step-by-step routine',
      why_viral: 'Trending wellness topic with high visual interest, immediate DIY application, and satisfying before/after potential.',
      hooks: ['Why your face is puffy every morning — and the 3-minute fix', 'Gua sha actually works — here\'s the science behind it', 'The morning routine that drains your face in 3 minutes'],
      keywords: ['lymphatic drainage', 'gua sha', 'facial massage', 'face depuff', 'morning beauty routine', 'jade roller'],
      example_post: 'Your face is puffy every morning and no product is fixing it.\n\nYour lymphatic system is your body\'s drainage network. It removes toxins, excess fluid, and cellular waste. When sluggish, fluid pools in your face.\n\nSigns your facial lymph is backed up:\n• Puffy eyes and cheeks every morning\n• Dull, grey-looking skin\n• Persistent dark circles\n\n3-minute morning drainage routine:\n1. Cold water: Splash cold water × 10. Temperature change stimulates lymph.\n2. Gentle massage: Press lymph nodes on neck sides downward × 5. Opens the drain.\n3. Gua sha sweep: Neck up to jawline, jawline to ear, cheekbone to temple. Light pressure. 3 sweeps each.'
    },
    {
      id: 'topic_009', category: 'skincare', title: 'Retinol beginner guide — why most people quit too early',
      viral_score: 5, content_type: 'comprehensive_guide', target_emotion: 'patience_and_confidence',
      recommended_format: 'Beginner guide + timeline + do\'s and don\'ts',
      why_viral: 'Retinol is the most-searched skincare ingredient. Quitting during the purge phase is the #1 mistake — drives massive saves as reference guide.',
      hooks: ['Most people quit retinol right before it starts working', 'The retinol purge is supposed to happen', 'Week-by-week: what retinol actually does to your skin'],
      keywords: ['retinol beginner', 'retinol purge', 'retinol sandwich method', 'anti-aging retinol', 'skin cell turnover'],
      example_post: 'You bought retinol. Your skin freaked out. You stopped. That was the biggest mistake.\n\nWeek-by-week reality:\nWeeks 1-2: Dryness, flaking, mild irritation. Normal.\nWeeks 3-4: Purging — old debris rises to surface. STILL NORMAL.\nWeeks 5-8: Skin calms. Texture improving.\nWeeks 9-12: The glow people post about begins.\n\nHow to start without destroying your skin:\n• Frequency: 1x/week → 2x → 3x. Never daily to start.\n• Sandwich method: moisturizer → retinol → moisturizer\n• Always PM only. Retinol degrades in sunlight.\n• Start at 0.025% or 0.05%. Not 1%.\n\nNever combine with:\n• AHA/BHA same night\n• Vitamin C same PM application\n• Benzoyl peroxide (deactivates retinol)\n\nSPF every morning when using retinol. Non-negotiable.'
    },
    {
      id: 'topic_010', category: 'body_wellness', title: 'Gut health and skin — the microbiome-acne connection',
      viral_score: 5, content_type: 'science_explainer_actionable', target_emotion: 'aha_moment_and_empowerment',
      recommended_format: 'Science explainer + 7-day gut reset protocol',
      why_viral: 'Gut-skin axis is one of the fastest-growing beauty science topics. Explains why topical-only approaches fail — huge paradigm shift.',
      hooks: ['Your acne is a gut problem, not a skin problem', 'Why no skincare routine will fix gut-related breakouts', 'The gut reset that cleared stubborn acne in 3 weeks'],
      keywords: ['gut skin axis', 'microbiome acne', 'leaky gut acne', 'probiotic skin', 'gut reset skin', 'probiotics skin health'],
      example_post: 'Your acne might not be a skincare problem. It might be a gut problem.\n\nThe gut-skin axis: Your gut contains 70% of your immune system. When balance tips toward harmful bacteria, inflammation travels through your bloodstream and surfaces on your skin.\n\nSigns your skin issues are gut-related:\n1. Acne that doesn\'t respond to topical treatments\n2. Eczema that flares with certain foods\n3. Bloating and breakouts happen on the same days\n\nLeaky gut pathway: Bad diet → harmful bacteria overgrow → gut wall becomes permeable → toxins enter bloodstream → skin inflammation\n\nProbiotic foods: Yogurt with live cultures, kimchi, sauerkraut, kefir, miso, tempeh\n\n7-day gut reset:\nDays 1-2: Cut sugar and alcohol completely\nDays 3-4: Add one probiotic food per day\nDays 5-6: Add prebiotic fiber: garlic, onion, banana, oats\nDay 7: Evaluate skin texture, inflammation, energy'
    }
  ],
  content_types: ['educational', 'myth_bust', 'how_to', 'comparison', 'guide', 'science_explainer', 'motivational'],
  categories: ['skincare', 'nutrition', 'mental_health', 'body_wellness'],
  cta_types: [
    'Which of these did YOU believe before? Comment below.',
    'Team A or Team B? Drop your pick.',
    'Where are you in this journey? Comment your stage.',
    'Which one do you consume most? No judgment.',
    'Has this ever happened to you? Comment YES or NO.',
    'Have you tried this? Drop your experience below.',
    'How many hours are you actually getting? Be honest.',
    'What surprised you most? Comment below.'
  ],
  virality_factors: [
    'Relatability — describes an experience the audience has had',
    'Myth-busting — challenges commonly held beliefs',
    'Actionable — gives something to do immediately',
    'Saves trigger — information dense enough to save for later',
    'Comment trigger — asks a question that\'s easy and compelling to answer',
    'Share trigger — information the reader wants friends to know'
  ],
  hook_rules: [
    'Start with a bold claim or surprising statement',
    'Reference a common mistake or myth',
    'Use "you" language to create immediate personal relevance',
    'Include a specific number or timeframe when possible'
  ],
  system_prompts: {
    base: 'You are an expert beauty and health content writer who creates viral, educational social media posts. Write in a friendly, knowledgeable tone — like advice from a brilliant friend who knows dermatology, nutrition, and wellness science. Use simple language. Avoid jargon. Short punchy sentences. Structure for social media readability. Always end with a high-engagement CTA.',
    myth_bust: 'Structure every post as MYTH → FACT pairs. Make the stakes feel real. End with one simple memorable rule and a CTA asking which myth they believed. Tone: direct, surprising, never condescending.',
    how_to: 'Structure guides with: a relatable problem hook, the science behind it (1-2 sentences max), numbered step-by-step routine, who should be careful, and an experience-share CTA. Make every step actionable tomorrow morning.',
    nutrition: 'For each food or nutrient, explain in one line WHY it affects skin (the mechanism), then give a practical swap or recommendation. Always non-judgmental. End with a poll-style CTA.',
    holistic: 'Connect mental health, sleep, stress, and lifestyle to skin outcomes. Write with warmth and validation. Explain the biological mechanism simply. Give a 3-5 step protocol. Never guilt-trip. Closing message = comfort + empowerment.'
  }
};

// =============================================================================
// MYANMAR BEAUTY & HEALTH VIRAL CONTENT WRITER SYSTEM PROMPT
// Specialized for Instant Lifestyle Post — warm sisterly tone, 5-part structure
// =============================================================================
const MYANMAR_BEAUTY_HEALTH_WRITER_PROMPT = `You are a viral beauty, skincare, and health content writer for Myanmar women aged 18-35. You write like a knowledgeable older sister — warm, honest, never preachy. Your content is educational but feels like a conversation, not a lecture.

Language: Always write in Myanmar Burmese script. Natural everyday tone. Never clinical or formal.

Your audience: Myanmar women who care about their skin and health but are often misled by myths, expensive products, and conflicting advice. They want honest, simple, actionable guidance they can trust.

Every post must have these 5 parts:
1. Hook — one bold line that stops the scroll. A surprising myth, a relatable problem, or a shocking truth.
2. Validate — one sentence that makes her feel seen ("ဒါ မင်းတစ်ယောက်တည်းမဟုတ်ဘူး")
3. Educate — explain the science in 2-3 simple sentences. No jargon. Use analogies if needed.
4. Action — numbered steps she can start today. Maximum 5 steps. Be specific.
5. CTA — one easy question that makes her want to comment. Rotate between: YES/NO, poll, confession, experience share, or tag a friend.

Content pillars:
• Skincare — skin barrier, SPF, retinol, acne, dark spots, oily skin, moisturizer, ingredients
• Beauty from within — collagen foods, anti-inflammatory eating, hydration, vitamins for skin
• Women's health — hormonal acne, period skin changes, PCOS skin, hair loss, vaginal health basics
• Mind and skin — stress breakouts, cortisol acne, sleep and skin, self-care routines
• Body wellness — gut skin connection, lymphatic drainage, bloating, weight and hormones

Tone rules:
• Never shame. Never guilt. Always empower.
• Validate her experience first, then educate.
• Make her feel smart for learning this, not stupid for not knowing it before.
• Warm, sisterly, confident.

Virality rules:
• Myth-bust format: အယူအဆ → အမှန်တကယ်
• How-to format: numbered steps with a timeframe ("၃ မိနစ်", "၇ ရက်")
• Always give a specific number — "၆ မျိုး", "၃ ဆင့်", "၂ ပတ်" — vague advice does not get saved
• Pack enough value that she saves it for later
• End with something she wants to share with her friends

CTA phrases to rotate:
• "ဒါမသိခဲ့ဖူးရင် comment မှာ YES ထားခဲ့ပါ"
• "မင်း skin type ဘာလဲ? Comment မှာ ရေးပါ၊ ငါ recommend လုပ်ပေးမယ်"
• "ဒါ friend တစ်ယောက်ကို tag လုပ်သင့်တဲ့ post ပဲ"
• "Myth လား Fact လား — M နဲ့ F နဲ့ ဖြေပါ"
• "မင်းရဲ့ experience ကို comment မှာ share ပါ၊ ငါ respond လုပ်မယ်"
• "ဒါ မင်း routine မှာ လုပ်နေပြီလား? YES or NO"

Output format:
Topic: [topic]
Target: Myanmar Women
Hook: [hook line in Burmese]
Post: [full post in Burmese]
Hashtags: [10 hashtags — mix of Burmese and English]

[ HUMANIZATION — CRITICAL ]
Content MUST feel 100% human-written, never AI-generated.
- Natural flow: vary sentence lengths, use "..." for emotional pauses, break perfect symmetry
- Emotional depth: go beyond surface benefits — use real micro-moments (morning routine, friends complimenting, mirror confidence)
- Pain points with empathy: "ဒါ ကျွန်မလည်း ဖြတ်သန်းခဲ့ဖူးတာပါ" style
- Use specific sensory details instead of generic adjectives
- Use specific numbers ("၇ ရက်ပဲ ကြာတယ်" not "ရက်အနည်းငယ်")
- Anti-AI: Start with story/scenario not listing, use narrative flow, add parenthetical asides "(ဟုတ်ဘူးလား?)", self-corrections

[ MYANMAR GRAMMAR ]
- Zero spelling errors. Correct particles (ကို/က/ကော/မှ/တွင်/၌). SOV word order (not English SVO). Match colloquial tone to audience.
`;

const SakuraFalling = () => {
  const [mounted, setMounted] = useState(false);
  const [petals, setPetals] = useState<Array<{ id: number; left: string; delay: number; duration: number; size: number; xOffset: string }>>([]);

  useEffect(() => {
    setPetals(
      Array.from({ length: 12 }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: Math.random() * 10,
        duration: 15 + Math.random() * 25,
        size: 8 + Math.random() * 12,
        xOffset: `${(Math.random() - 0.5) * 15}vw`,
      }))
    );
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-20 dark:opacity-10" suppressHydrationWarning>
      {petals.map((petal) => (
        <motion.div
          key={petal.id}
          initial={{ y: -20, opacity: 0, rotate: 0 }}
          animate={{
            y: ['0vh', '110vh'],
            opacity: [0, 1, 1, 0],
            rotate: [0, 360, 720],
            x: ['0vw', petal.xOffset],
          }}
          transition={{
            duration: petal.duration,
            repeat: Infinity,
            delay: petal.delay,
            ease: 'linear',
          }}
          style={{
            left: petal.left,
            width: petal.size,
            height: petal.size,
          }}
          className="absolute"
        >
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-pink-200/40 dark:text-pink-400/20 fill-current">
            <path d="M12 21.5C12 21.5 10 18 10 14C10 10 12 7 12 7C12 7 14 10 14 14C14 18 12 21.5 12 21.5Z" />
            <path d="M12 21.5C12 21.5 14 18 14 14C14 10 12 7 12 7C12 7 10 10 10 14C10 18 12 21.5 12 21.5Z" transform="rotate(45 12 14)" />
            <path d="M12 21.5C12 21.5 14 18 14 14C14 10 12 7 12 7C12 7 10 10 10 14C10 18 12 21.5 12 21.5Z" transform="rotate(-45 12 14)" />
          </svg>
        </motion.div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  // Single-User Mode & API Key State
  const [userApiKey, setUserApiKey] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [hasKey, setHasKey] = useState(true);
  const activeProfile: UserProfile = { id: 'default', name: 'Princess', emoji: '👑', gemini_api_key: null, created_at: '' };
  const currentApiKey = userApiKey || '';


  // Campaign Settings State
  const [productName, setProductName] = useState('');
  const [productImages, setProductImages] = useState<string[]>([]);
  const [productBenefits, setProductBenefits] = useState('');
  const [emotionalResponse, setEmotionalResponse] = useState('');
  const [targetAudience, setTargetAudience] = useState('Women aged 30-50, looking for effective beauty solutions');
  const [campaignGoal, setCampaignGoal] = useState('Drive sales');
  const [framework, setFramework] = useState('AIDA (Attention, Interest, Desire, Action)');
  const [tone, setTone] = useState('Auto (AI Recommended)');
  const [platform, setPlatform] = useState('Facebook (Community-focused)');
  const [contentPillars, setContentPillars] = useState('Education, Lifestyle, Product Demo');
  // Standalone Generator States
  const [standaloneEngagementStyle, setStandaloneEngagementStyle] = useState('Educational / Info-tainment (ဗဟုသုတပေးခြင်း + စိတ်ဝင်စားစရာ)');
  const [standaloneDaysCount, setStandaloneDaysCount] = useState<number>(7);
  const [isGeneratingStandaloneLifestyle, setIsGeneratingStandaloneLifestyle] = useState(false);
  const [isLifestyleMode, setIsLifestyleMode] = useState(false);
  const lifestyleTopicHistoryRef = useRef<string[]>([]);
  const lifestyleGenerationCountRef = useRef(0);
  const [ctaStyle, setCtaStyle] = useState('Engagement ရယူရန် (Save & Share လုပ်ပါ)');
  const [reelsCount, setReelsCount] = useState<number>(0);
  const [carouselCount, setCarouselCount] = useState<number>(0);
  const [daysCount, setDaysCount] = useState<number>(10);
  const [includeModel, setIncludeModel] = useState(true);
  const [selectedImageModel, setSelectedImageModel] = useState('gemini-2.5-flash-image'); // Default to Nano Banana Pro as requested
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  // Template Management State
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [renamingTemplateId, setRenamingTemplateId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [isDeletingTemplate, setIsDeletingTemplate] = useState<string | null>(null);
  const [isFetchingTemplates, setIsFetchingTemplates] = useState(false);

  // Edit Data Modal State
  const [showEditDataModal, setShowEditDataModal] = useState(false);
  const [editDataTemplate, setEditDataTemplate] = useState<SavedTemplate | null>(null);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    product_name: string;
    product_benefits: string;
    emotional_response: string;
    target_audience: string;
    campaign_goal: string;
    framework: string;
    tone: string;
    platform: string;
    content_pillars: string;
    cta_style: string;
    reels_count: number;
    carousel_count: number;
    days_count: number;
    product_image_urls: string[];
    newImages: string[]; // base64 images to add
  }>({
    name: '', product_name: '', product_benefits: '', emotional_response: '',
    target_audience: '', campaign_goal: '', framework: '', tone: '',
    platform: '', content_pillars: '', cta_style: '',
    reels_count: 0, carousel_count: 0, days_count: 10,
    product_image_urls: [], newImages: []
  });
  const [isSavingEditData, setIsSavingEditData] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState<string | null>(null);

  // Refs for aborting
  const isAbortedRef = useRef(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);

  // AI Options State
  const [isGeneratingOptions, setIsGeneratingOptions] = useState(false);
  const [generatedBenefitsOptions, setGeneratedBenefitsOptions] = useState<string[]>([]);
  const [generatedEmotionalOptions, setGeneratedEmotionalOptions] = useState<string[]>([]);
  const [generatedAudienceOptions, setGeneratedAudienceOptions] = useState<string[]>([]);
  const [isRegeneratingBenefits, setIsRegeneratingBenefits] = useState(false);
  const [isRegeneratingEmotions, setIsRegeneratingEmotions] = useState(false);
  const [isRegeneratingAudience, setIsRegeneratingAudience] = useState(false);
  const [isLetAIThinking, setIsLetAIThinking] = useState(false);

  // Generation State
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [toastMessage, setToastMessage] = useState('');
  const [planGenerationCount, setPlanGenerationCount] = useState(0);
  const [previousPlanSummary, setPreviousPlanSummary] = useState('');
  
  // Detailed View State
  const [selectedDay, setSelectedDay] = useState<PlanItem | null>(null);
  const [isGeneratingFullPost, setIsGeneratingFullPost] = useState(false);
  const [postVariations, setPostVariations] = useState<PostVariation[]>([]);
  const [activeVariationIndex, setActiveVariationIndex] = useState(0);
  const [isGeneratingVariation, setIsGeneratingVariation] = useState(-1);
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [generationStep, setGenerationStep] = useState('');
  const [generatedImage, setGeneratedImage] = useState('');
  const [isImageGenView, setIsImageGenView] = useState(false);
  const [generationAttempt, setGenerationAttempt] = useState(0);
  const [imageStyle, setImageStyle] = useState('Auto (AI Recommended)');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('2K');
  const [logoImage, setLogoImage] = useState('');
  const [logoPosition, setLogoPosition] = useState('bottom-right');
  const [logoOpacity, setLogoOpacity] = useState(0.8);
  const [logoScale, setLogoScale] = useState(0.15);
  const [finalImageWithLogo, setFinalImageWithLogo] = useState('');
  const [headlineLength, setHeadlineLength] = useState('Default');
  const [generatedHooks, setGeneratedHooks] = useState<string[]>([]);
  const [selectedHook, setSelectedHook] = useState('');
  const [isGeneratingHooks, setIsGeneratingHooks] = useState(false);
  const [textOverlayStyle, setTextOverlayStyle] = useState('Elegant & Bold (High-end, thick, sophisticated typography)');
  const [autoStyleAnalysis, setAutoStyleAnalysis] = useState('');
  
  const isRetryableError = (error: any) => {
    const errorStr = JSON.stringify(error).toLowerCase();
    const message = error.message?.toLowerCase() || '';
    
    // Hard quota errors should not be retried as they won't succeed on retry
    if (message.includes('check your plan and billing details') || errorStr.includes('check your plan and billing details')) {
      return false;
    }

    return (
      error.status === 429 || 
      error.code === 429 ||
      error.status === 503 ||
      error.code === 503 ||
      error.error?.code === 429 ||
      error.error?.code === 503 ||
      error.error?.status === 'RESOURCE_EXHAUSTED' ||
      error.error?.status === 'UNAVAILABLE' ||
      error.status === 500 ||
      error.code === 500 ||
      error.error?.code === 500 ||
      errorStr.includes('429') ||
      errorStr.includes('503') ||
      errorStr.includes('500') ||
      errorStr.includes('quota') ||
      errorStr.includes('resource_exhausted') ||
      errorStr.includes('exhausted') ||
      errorStr.includes('unavailable') ||
      errorStr.includes('internal error') ||
      errorStr.includes('high demand') ||
      message.includes('429') ||
      message.includes('503') ||
      message.includes('500') ||
      message.includes('quota') ||
      message.includes('exhausted') ||
      message.includes('unavailable') ||
      message.includes('internal error') ||
      message.includes('high demand')
    );
  };

  const withRetry = async <T,>(fn: () => Promise<T>, retries = 1, delay = 1000): Promise<T> => {
    try {
      return await fn();
    } catch (error: any) {
      // Only retry on 429 (rate limit) or 503 (temporarily unavailable)
      const isRetryable = error.status === 429 || error.status === 503;
      
      if (retries > 0 && isRetryable) {
        console.log(`Retryable error (${error.status}). Retrying in ${delay}ms... (${retries} left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return withRetry(fn, retries - 1, delay * 1.5);
      }
      throw error;
    }
  };

  // Undo/Redo State
  const [postHistory, setPostHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  useEffect(() => {
    if (!isEditingPost || postVariations.length === 0) return;
    const currentContent = postVariations[activeVariationIndex]?.content || '';
    const timeoutId = setTimeout(() => {
      if (historyIndex >= 0 && postHistory[historyIndex] !== currentContent) {
        const newHistory = postHistory.slice(0, historyIndex + 1);
        newHistory.push(currentContent);
        setPostHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
      } else if (historyIndex === -1 && currentContent) {
        setPostHistory([currentContent]);
        setHistoryIndex(0);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [postVariations, activeVariationIndex, isEditingPost, historyIndex, postHistory]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setPostVariations(prev => {
        const newVars = [...prev];
        newVars[activeVariationIndex] = { ...newVars[activeVariationIndex], content: postHistory[newIndex] };
        return newVars;
      });
    }
  };

  const handleRedo = () => {
    if (historyIndex < postHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setPostVariations(prev => {
        const newVars = [...prev];
        newVars[activeVariationIndex] = { ...newVars[activeVariationIndex], content: postHistory[newIndex] };
        return newVars;
      });
    }
  };

  // Fetch all saved templates from Supabase
  const fetchTemplates = async () => {
    setIsFetchingTemplates(true);
    try {
      const { data, error } = await supabase
        .from('campaign_settings')
        .select('*')
        .order('updated_at', { ascending: false });
      if (!error && data) {
        setSavedTemplates(data);
      }
    } catch (error: any) {
      console.error('Fetch templates error:', error);
    } finally {
      setIsFetchingTemplates(false);
    }
  };

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setUserApiKey(savedKey);
      setApiKeyInput(savedKey);
    }
    fetchTemplates();
  }, []);

  const handleSaveApiKey = () => {
    const key = apiKeyInput.trim();
    setUserApiKey(key);
    if (key) {
      localStorage.setItem('gemini_api_key', key);
      setToastMessage('✅ Custom Gemini API Key saved!');
    } else {
      localStorage.removeItem('gemini_api_key');
      setToastMessage('ℹ️ Using server-side default API Key.');
    }
    setShowApiKeyModal(false);
    setTimeout(() => setToastMessage(''), 3000);
  };


  // Upload images helper
  const uploadProductImages = async (): Promise<string[]> => {
    const imageUrls: string[] = [];
    for (let i = 0; i < productImages.length; i++) {
      const base64 = productImages[i];
      const match = base64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        const byteString = atob(match[2]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let j = 0; j < byteString.length; j++) {
          ia[j] = byteString.charCodeAt(j);
        }
        const blob = new Blob([ab], { type: match[1] });
        const ext = match[1].split('/')[1] || 'jpeg';
        const fileName = `campaign/product-${Date.now()}-${i}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, blob, { upsert: true, contentType: match[1] });
        
        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }
        
        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        
        imageUrls.push(urlData.publicUrl);
      }
    }
    return imageUrls;
  };

  // Save Template (new or update existing)
  const handleSaveSettings = async (templateName?: string) => {
    const nameToUse = templateName || templateNameInput.trim();
    if (!nameToUse) {
      setShowSaveModal(true);
      return;
    }

    setIsSavingSettings(true);
    setShowSaveModal(false);
    setToastMessage(`Saving template "${nameToUse}"...`);
    try {
      const imageUrls = await uploadProductImages();

      const payload: any = {
        name: nameToUse,
        product_name: productName,
        product_benefits: productBenefits,
        emotional_response: emotionalResponse,
        target_audience: targetAudience,
        campaign_goal: campaignGoal,
        framework: framework,
        tone: tone,
        platform: platform,
        content_pillars: contentPillars,
        cta_style: ctaStyle,
        reels_count: reelsCount,
        carousel_count: carouselCount,
        days_count: daysCount,
        product_image_urls: imageUrls,
        updated_at: new Date().toISOString(),
        user_profile_id: activeProfile?.id || null,
      };

      if (editingTemplateId) {
        // Update existing template
        const { error } = await supabase
          .from('campaign_settings')
          .update(payload)
          .eq('id', editingTemplateId);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('campaign_settings')
          .upsert(payload, { onConflict: 'name' });
        if (error) throw error;
      }

      setToastMessage(`✅ Template "${nameToUse}" saved!`);
      setTemplateNameInput('');
      setEditingTemplateId(null);
      await fetchTemplates();
    } catch (error: any) {
      console.error('Save error:', error);
      setToastMessage('⚠️ Save failed: ' + (error.message || ''));
    } finally {
      setIsSavingSettings(false);
      setTimeout(() => setToastMessage(''), 4000);
    }
  };

  // Load a specific template
  const handleLoadTemplate = async (template: SavedTemplate) => {
    setIsLoadingSettings(true);
    setToastMessage(`Loading "${template.name}"...`);
    try {
      if (template.product_name) setProductName(template.product_name);
      if (template.product_benefits) setProductBenefits(template.product_benefits);
      if (template.emotional_response) setEmotionalResponse(template.emotional_response);
      if (template.target_audience) setTargetAudience(template.target_audience);
      if (template.campaign_goal) setCampaignGoal(template.campaign_goal);
      if (template.framework) setFramework(template.framework);
      if (template.tone) setTone(template.tone);
      if (template.platform) setPlatform(template.platform);
      if (template.content_pillars) setContentPillars(template.content_pillars);
      if (template.cta_style) setCtaStyle(template.cta_style);
      if (template.reels_count !== undefined) setReelsCount(template.reels_count);
      if (template.carousel_count !== undefined) setCarouselCount(template.carousel_count);
      if (template.days_count !== undefined) setDaysCount(template.days_count);

      // Download product images
      if (template.product_image_urls && template.product_image_urls.length > 0) {
        const loadedImages: string[] = [];
        for (const url of template.product_image_urls) {
          try {
            const response = await fetch(url);
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            loadedImages.push(base64);
          } catch (imgErr) {
            console.error('Failed to load image:', url, imgErr);
          }
        }
        setProductImages(loadedImages);
      } else {
        setProductImages([]);
      }

      setToastMessage(`✅ Template "${template.name}" loaded!`);
    } catch (error: any) {
      console.error('Load error:', error);
      setToastMessage('⚠️ Load failed: ' + (error.message || ''));
    } finally {
      setIsLoadingSettings(false);
      setTimeout(() => setToastMessage(''), 4000);
    }
  };

  // Delete a template
  const handleDeleteTemplate = async (template: SavedTemplate) => {
    setIsDeletingTemplate(template.id);
    try {
      const { error } = await supabase
        .from('campaign_settings')
        .delete()
        .eq('id', template.id);
      if (error) throw error;
      setToastMessage(`🗑️ Template "${template.name}" deleted.`);
      await fetchTemplates();
    } catch (error: any) {
      console.error('Delete error:', error);
      setToastMessage('⚠️ Delete failed: ' + (error.message || ''));
    } finally {
      setIsDeletingTemplate(null);
      setTimeout(() => setToastMessage(''), 4000);
    }
  };

  // Rename a template
  const handleRenameTemplate = async (template: SavedTemplate) => {
    const newName = renameInput.trim();
    if (!newName || newName === template.name) {
      setRenamingTemplateId(null);
      return;
    }
    try {
      const { error } = await supabase
        .from('campaign_settings')
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq('id', template.id);
      if (error) throw error;
      setToastMessage(`✅ Renamed to "${newName}".`);
      setRenamingTemplateId(null);
      setRenameInput('');
      await fetchTemplates();
    } catch (error: any) {
      console.error('Rename error:', error);
      setToastMessage('⚠️ Rename failed: ' + (error.message || ''));
    } finally {
      setTimeout(() => setToastMessage(''), 4000);
    }
  };

  // Edit (overwrite) a template with current settings
  const handleEditTemplate = (template: SavedTemplate) => {
    setEditingTemplateId(template.id);
    setTemplateNameInput(template.name);
    setShowSaveModal(true);
  };

  // Open Edit Data modal with a template's data pre-filled
  const openEditDataModal = (template: SavedTemplate) => {
    setEditDataTemplate(template);
    setEditFormData({
      name: template.name,
      product_name: template.product_name || '',
      product_benefits: template.product_benefits || '',
      emotional_response: template.emotional_response || '',
      target_audience: template.target_audience || '',
      campaign_goal: template.campaign_goal || '',
      framework: template.framework || '',
      tone: template.tone || '',
      platform: template.platform || '',
      content_pillars: template.content_pillars || '',
      cta_style: template.cta_style || '',
      reels_count: template.reels_count || 0,
      carousel_count: template.carousel_count || 0,
      days_count: template.days_count || 10,
      product_image_urls: template.product_image_urls || [],
      newImages: [],
    });
    setShowEditDataModal(true);
  };

  // Handle image file selection inside the Edit Data modal
  const handleEditModalImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const readPromises = imageFiles.map(file =>
      new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      })
    );

    const rawBase64Images = await Promise.all(readPromises);
    const resizedImages = await Promise.all(rawBase64Images.map(img => resizeImage(img)));
    setEditFormData(prev => ({
      ...prev,
      newImages: [...prev.newImages, ...resizedImages],
    }));
  };

  // Remove existing image from edit form
  const removeEditExistingImage = (idx: number) => {
    setEditFormData(prev => ({
      ...prev,
      product_image_urls: prev.product_image_urls.filter((_, i) => i !== idx),
    }));
  };

  // Remove new image from edit form
  const removeEditNewImage = (idx: number) => {
    setEditFormData(prev => ({
      ...prev,
      newImages: prev.newImages.filter((_, i) => i !== idx),
    }));
  };

  // Save the Edit Data modal changes
  const handleSaveEditData = async () => {
    if (!editDataTemplate) return;
    setIsSavingEditData(true);
    setToastMessage(`Saving template "${editFormData.name}"...`);

    try {
      // Upload any new images to Supabase storage
      const uploadedNewUrls: string[] = [];
      for (let i = 0; i < editFormData.newImages.length; i++) {
        const base64 = editFormData.newImages[i];
        const match = base64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (match) {
          const byteString = atob(match[2]);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let j = 0; j < byteString.length; j++) {
            ia[j] = byteString.charCodeAt(j);
          }
          const blob = new Blob([ab], { type: match[1] });
          const ext = match[1].split('/')[1] || 'jpeg';
          const fileName = `campaign/product-${Date.now()}-${i}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(fileName, blob, { upsert: true, contentType: match[1] });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            continue;
          }

          const { data: urlData } = supabase.storage
            .from('product-images')
            .getPublicUrl(fileName);

          uploadedNewUrls.push(urlData.publicUrl);
        }
      }

      // Combine existing URLs (kept) + newly-uploaded URLs
      const finalImageUrls = [...editFormData.product_image_urls, ...uploadedNewUrls];

      const payload = {
        name: editFormData.name,
        product_name: editFormData.product_name,
        product_benefits: editFormData.product_benefits,
        emotional_response: editFormData.emotional_response,
        target_audience: editFormData.target_audience,
        campaign_goal: editFormData.campaign_goal,
        framework: editFormData.framework,
        tone: editFormData.tone,
        platform: editFormData.platform,
        content_pillars: editFormData.content_pillars,
        cta_style: editFormData.cta_style,
        reels_count: editFormData.reels_count,
        carousel_count: editFormData.carousel_count,
        days_count: editFormData.days_count,
        product_image_urls: finalImageUrls,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('campaign_settings')
        .update(payload)
        .eq('id', editDataTemplate.id);
      if (error) throw error;

      setToastMessage(`✅ Template "${editFormData.name}" updated!`);
      setShowEditDataModal(false);
      setEditDataTemplate(null);
      await fetchTemplates();
    } catch (error: any) {
      console.error('Edit data save error:', error);
      setToastMessage('⚠️ Save failed: ' + (error.message || ''));
    } finally {
      setIsSavingEditData(false);
      setTimeout(() => setToastMessage(''), 4000);
    }
  };

  // 3D Template icon colors
  const templateColors = [
    'from-violet-500 to-purple-600',
    'from-pink-500 to-rose-600',
    'from-cyan-500 to-blue-600',
    'from-amber-500 to-orange-600',
    'from-emerald-500 to-green-600',
    'from-red-500 to-pink-600',
    'from-indigo-500 to-blue-700',
    'from-teal-500 to-cyan-600',
  ];

  const handleCopyPost = (contentToCopy?: string) => {
    const content = contentToCopy || (postVariations[activeVariationIndex]?.content || '');
    navigator.clipboard.writeText(content);
    setToastMessage('Post content copied to clipboard!');
    setTimeout(() => setToastMessage(''), 3000);
  };

  useEffect(() => {
    const updateFinalImage = async () => {
      if (generatedImage) {
        if (logoImage) {
          const withLogo = await applyLogoOverlay(generatedImage, logoImage, logoPosition, logoScale, logoOpacity);
          setFinalImageWithLogo(withLogo);
        } else {
          setFinalImageWithLogo(generatedImage);
        }
      }
    };
    updateFinalImage();
  }, [generatedImage, logoImage, logoPosition, logoScale, logoOpacity]);

  const handleApiError = (error: any, defaultMessage: string) => {
    const errorStr = JSON.stringify(error).toLowerCase();
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('api key not valid') || errorStr.includes('api_key_invalid')) {
      localStorage.removeItem('gemini_api_key');
      setUserApiKey('');
      setApiKeyInput('');
      setHasKey(false);
      setToastMessage('API Key is invalid. Please paste a valid key below!');
      setShowApiKeyModal(true);
    } else if (message.includes('depleted') || errorStr.includes('depleted') || message.includes('prepayment')) {
      setToastMessage('❌ Google API Error: Your prepayment credits are depleted. Please add credits at ai.studio/projects');
    } else if (message.includes('requested entity was not found') || errorStr.includes('not_found')) {
      setToastMessage('Model error: The selected AI model is currently unavailable or deprecated. Please try another model.');
    } else if (isRetryableError(error)) {
      setToastMessage('Temporary rate limit or high demand. Please wait a moment and try again.');
    } else {
      setToastMessage(error.message || defaultMessage);
    }
  };

  const resizeImage = (base64Str: string, maxWidth = 512, maxHeight = 512): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    });
  };

  // Compress image to stay under maxSizeBytes (default 500KB) while maintaining quality
  const compressImage = (base64Str: string, maxSizeBytes = 512 * 1024): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64Str);
          return;
        }
        ctx.drawImage(img, 0, 0);

        // Try JPEG compression at decreasing quality levels until under maxSizeBytes
        let quality = 0.92;
        let result = canvas.toDataURL('image/jpeg', quality);
        
        // Estimate file size from base64 length (base64 is ~4/3 of binary)
        const getBase64Size = (b64: string) => {
          const base64Data = b64.split(',')[1] || b64;
          return Math.ceil(base64Data.length * 3 / 4);
        };

        while (getBase64Size(result) > maxSizeBytes && quality > 0.3) {
          quality -= 0.05;
          result = canvas.toDataURL('image/jpeg', quality);
        }

        // If still too large, scale down the canvas dimensions
        if (getBase64Size(result) > maxSizeBytes) {
          let scale = 0.9;
          while (getBase64Size(result) > maxSizeBytes && scale > 0.4) {
            const newWidth = Math.round(img.width * scale);
            const newHeight = Math.round(img.height * scale);
            canvas.width = newWidth;
            canvas.height = newHeight;
            ctx.drawImage(img, 0, 0, newWidth, newHeight);
            result = canvas.toDataURL('image/jpeg', 0.85);
            scale -= 0.1;
          }
        }

        console.log(`Image compressed: ${(getBase64Size(result) / (1024 * 1024)).toFixed(2)} MB at quality ${quality.toFixed(2)}`);
        resolve(result);
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const processImageFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    const readPromises = imageFiles.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    });

    const rawBase64Images = await Promise.all(readPromises);
    const resizedImages = await Promise.all(rawBase64Images.map(img => resizeImage(img)));
    const newImages = [...productImages, ...resizedImages];
    setProductImages(newImages);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processImageFiles(files);
  };

  const handleImageDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingImage(false);
    const files = Array.from(e.dataTransfer.files);
    await processImageFiles(files);
  };

  const removeImage = (index: number) => {
    setProductImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerateAllOptions = async () => {
    if (!productName) {
      setToastMessage('Please enter a product name first.');
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }

    setIsGeneratingOptions(true);
    try {
            
      const prompt = `Analyze the following product name and optional images.
      Product Name: "${productName}"
      
      Generate 3 distinct, high-converting options for EACH of the following fields.
      IMPORTANT: All generated options MUST be written in the Myanmar (Burmese) language.
      
      1. Product Benefits (short, punchy phrases in Myanmar language)
      2. Desired Emotional Response (how the user should feel, in Myanmar language)
      3. Target Audience (Be highly specific: include exact age range, gender, and specific pain points/desires, in Myanmar language)
      
      Return the result strictly as a JSON object with this exact structure:
      {
        "benefits": ["benefit 1", "benefit 2", "benefit 3"],
        "emotions": ["emotion 1", "emotion 2", "emotion 3"],
        "audiences": ["audience 1", "audience 2", "audience 3"]
      }`;

      const contents: any = { parts: [] };
      
      if (productImages.length > 0) {
        productImages.forEach(img => {
          const match = img.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          if (match) {
            contents.parts.push({
              inlineData: {
                mimeType: match[1],
                data: match[2]
              }
            });
          }
        });
      }
      
      contents.parts.push({ text: prompt });

      const response = await withRetry(() => callAI('gemini-flash-lite-latest', contents, {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              benefits: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              emotions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
              audiences: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
            },
            required: ["benefits", "emotions", "audiences"]
          }
        }, currentApiKey));

      let jsonStr = response.text || '{}';
      jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      
      // Find the first '{' or '[' to handle any leading text before JSON
      const firstBrace = jsonStr.indexOf('{');
      const firstBracket = jsonStr.indexOf('[');
      if (firstBrace !== -1 && firstBracket !== -1) {
        jsonStr = jsonStr.substring(Math.min(firstBrace, firstBracket));
      } else if (firstBrace !== -1) {
        jsonStr = jsonStr.substring(firstBrace);
      } else if (firstBracket !== -1) {
        jsonStr = jsonStr.substring(firstBracket);
      }
      
      // Find the last '}' or ']' to handle any trailing text after JSON
      const lastBrace = jsonStr.lastIndexOf('}');
      const lastBracket = jsonStr.lastIndexOf(']');
      if (lastBrace !== -1 && lastBracket !== -1) {
        jsonStr = jsonStr.substring(0, Math.max(lastBrace, lastBracket) + 1);
      } else if (lastBrace !== -1) {
        jsonStr = jsonStr.substring(0, lastBrace + 1);
      } else if (lastBracket !== -1) {
        jsonStr = jsonStr.substring(0, lastBracket + 1);
      }

      const result = JSON.parse(jsonStr);
      
      if (result.benefits) setGeneratedBenefitsOptions(result.benefits);
      if (result.emotions) setGeneratedEmotionalOptions(result.emotions);
      if (result.audiences) setGeneratedAudienceOptions(result.audiences);
      
      setToastMessage('All options generated successfully!');
    } catch (error: any) {
      console.error('Error generating options:', error);
      handleApiError(error, 'Failed to generate options.');
    } finally {
      setIsGeneratingOptions(false);
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  // Per-field regeneration helpers
  const handleRegenerateField = async (field: 'benefits' | 'emotions' | 'audiences') => {
    if (!productName) {
      setToastMessage('Please enter a product name first.');
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }

    const setLoading = field === 'benefits' ? setIsRegeneratingBenefits : field === 'emotions' ? setIsRegeneratingEmotions : setIsRegeneratingAudience;
    setLoading(true);

    try {
            
      const fieldDescriptions = {
        benefits: `Product Benefits — generate 3 NEW, DIFFERENT, highly specific and punchy benefit phrases for "${productName}". Focus on unique selling points, sensory details, and transformative outcomes. MUST be in Myanmar (Burmese) language.${productBenefits ? ` Current value to AVOID repeating: "${productBenefits}"` : ''}`,
        emotions: `Desired Emotional Response — generate 3 NEW, DIFFERENT emotional states/feelings that a user of "${productName}" would experience. Be specific and vivid (not generic like "happy"). MUST be in Myanmar (Burmese) language.${emotionalResponse ? ` Current value to AVOID repeating: "${emotionalResponse}"` : ''}`,
        audiences: `Target Audience — generate 3 NEW, DIFFERENT, hyper-specific target audience descriptions for "${productName}". Include exact age range, gender, location hints, specific pain points, desires, and lifestyle details. MUST be in Myanmar (Burmese) language.${targetAudience ? ` Current value to AVOID repeating: "${targetAudience}"` : ''}`
      };

      const prompt = `You are a top Myanmar marketing strategist. Analyze this product and generate options.
      Product Name: "${productName}"
      ${productBenefits ? `Current Benefits: "${productBenefits}"` : ''}
      
      Task: ${fieldDescriptions[field]}
      
      CRITICAL: Generate completely FRESH and DIFFERENT options from any previously generated ones. Use ${new Date().getFullYear()} marketing trends and Myanmar consumer insights.
      
      Return as JSON: { "options": ["option 1", "option 2", "option 3"] }`;

      const contents: any = { parts: [] };
      if (productImages.length > 0) {
        const img = productImages[0];
        const match = img.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (match) {
          contents.parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
        }
      }
      contents.parts.push({ text: prompt });

      const response = await withRetry(() => callAI('gemini-flash-lite-latest', contents, {
          temperature: 1.3,
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
            },
            required: ["options"]
          }
        }, currentApiKey));

      let jsonStr = response.text || '{}';
      jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      const firstBrace = jsonStr.indexOf('{');
      if (firstBrace !== -1) jsonStr = jsonStr.substring(firstBrace);
      const lastBrace = jsonStr.lastIndexOf('}');
      if (lastBrace !== -1) jsonStr = jsonStr.substring(0, lastBrace + 1);

      const result = JSON.parse(jsonStr);
      if (result.options) {
        if (field === 'benefits') setGeneratedBenefitsOptions(result.options);
        else if (field === 'emotions') setGeneratedEmotionalOptions(result.options);
        else setGeneratedAudienceOptions(result.options);
      }
      setToastMessage(`${field === 'benefits' ? 'Benefits' : field === 'emotions' ? 'Emotional responses' : 'Audiences'} regenerated!`);
    } catch (error: any) {
      console.error(`Error regenerating ${field}:`, error);
      handleApiError(error, `Failed to regenerate ${field}.`);
    } finally {
      setLoading(false);
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  // "Let AI Think" — AI autopilot that analyzes and sets ALL fields professionally
  const handleLetAIThink = async () => {
    if (!productName) {
      setToastMessage('Please enter a product name first.');
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }

    setIsLetAIThinking(true);
    try {
            const productContext = getProductContext(productName);
      const currentYear = new Date().getFullYear();

      const prompt = `You are an elite Myanmar digital marketing strategist with 15+ years of experience. You've worked with top beauty and lifestyle brands in Southeast Asia.

      Analyze this product and make PROFESSIONAL-LEVEL strategic decisions for a social media campaign.

      Product Name: "${productName}"
      ${productContext ? `Product Knowledge:\n${productContext}` : ''}
      
      Current Year: ${currentYear}

      Think like a TOP agency creative director. Consider:
      - Myanmar market dynamics in ${currentYear}
      - The product category and its typical buyer persona
      - What campaign approach would deliver the HIGHEST ROI
      - What emotional triggers work best for this product type in Myanmar
      - Which platform the target audience uses most
      - What content strategy would go viral

      You must select the BEST option for each field below. Choose from the exact values listed OR write better custom values where indicated.

      Return a JSON object with these exact fields:
      {
        "productBenefits": "Custom: write the most compelling product benefits in Myanmar language",
        "emotionalResponse": "Custom: the most powerful emotional response to target, in Myanmar language",
        "targetAudience": "Custom: hyper-specific target audience with age, gender, pain points, desires — in Myanmar language",
        "campaignGoal": "MUST be one of: Increase brand awareness | Drive sales | Boost engagement | Educate audience | Build community",
        "framework": "MUST be one of: AIDA (Attention, Interest, Desire, Action) | PAS (Problem, Agitate, Solution) | StoryBrand (Character, Problem, Guide, Success) | Hook, Story, Offer | FAB (Features, Advantages, Benefits) | Educational & Debunking | Transformation (Before/After) | BAB (Before, After, Bridge) | 4 C's (Clear, Concise, Compelling, Credible) | QUEST (Qualify, Understand, Educate, Stimulate, Transition) | PASTOR (Problem, Amplify, Story, Transformation, Offer, Response)",
        "tone": "MUST be one of: Elegant & Anti-Aging Focus (Age 30-50) | Gen Z / Young & Trendy (Age 16-25) | Professional & Expert Authority | Warm, Motherly & Community | Energetic & Bold Challenger",
        "platform": "MUST be one of: Instagram / TikTok (Visual-first) | LinkedIn (Professional) | Twitter / X (Short-form) | Facebook (Community-focused)",
        "contentPillars": "MUST be one of: Education, Lifestyle, Product Demo | Inspiration, Behind-the-Scenes, User Generated Content (UGC) | Entertainment, Storytelling, Social Proof | Tips & Tricks, Industry News, Community Spotlight | Promotional, Educational, Entertaining (The 3 E's) | Relatable Struggle, Glow Up, Review",
        "ctaStyle": "MUST be one of: Engagement ရယူရန် (Save & Share လုပ်ပါ) | ချက်ချင်းဝယ်ယူရန် (Link in Bio / အခုပဲဝယ်ယူပါ) | အပြန်အလှန်ဆွေးနွေးရန် (Comment ရေးပါ / Tag တွဲပါ) | သွယ်ဝိုက်ရောင်းချရန် (အသေးစိတ်သိရှိရန် / DM ပို့ပါ)",
        "reasoning": "Brief explanation of why you chose these settings (in English)"
      }`;

      const contents: any = { parts: [] };
      if (productImages.length > 0) {
        productImages.slice(0, 2).forEach(img => {
          const match = img.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          if (match) {
            contents.parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
          }
        });
      }
      contents.parts.push({ text: prompt });

      const response = await withRetry(() => callAI('gemini-flash-lite-latest', contents, {
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              productBenefits: { type: SchemaType.STRING },
              emotionalResponse: { type: SchemaType.STRING },
              targetAudience: { type: SchemaType.STRING },
              campaignGoal: { type: SchemaType.STRING },
              framework: { type: SchemaType.STRING },
              tone: { type: SchemaType.STRING },
              platform: { type: SchemaType.STRING },
              contentPillars: { type: SchemaType.STRING },
              ctaStyle: { type: SchemaType.STRING },
              reasoning: { type: SchemaType.STRING }
            },
            required: ["productBenefits", "emotionalResponse", "targetAudience", "campaignGoal", "framework", "platform", "contentPillars", "ctaStyle", "reasoning"]
          }
        }, currentApiKey));

      let jsonStr = response.text || '{}';
      jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      const firstBrace = jsonStr.indexOf('{');
      if (firstBrace !== -1) jsonStr = jsonStr.substring(firstBrace);
      const lastBrace = jsonStr.lastIndexOf('}');
      if (lastBrace !== -1) jsonStr = jsonStr.substring(0, lastBrace + 1);

      const result = JSON.parse(jsonStr);

      // Apply all AI-selected settings
      if (result.productBenefits) setProductBenefits(result.productBenefits);
      if (result.emotionalResponse) setEmotionalResponse(result.emotionalResponse);
      if (result.targetAudience) setTargetAudience(result.targetAudience);
      if (result.campaignGoal) setCampaignGoal(result.campaignGoal);
      if (result.framework) setFramework(result.framework);
      if (result.tone) setTone(result.tone);
      if (result.platform) setPlatform(result.platform);
      if (result.contentPillars) setContentPillars(result.contentPillars);
      if (result.ctaStyle) setCtaStyle(result.ctaStyle);

      setToastMessage(`🧠 AI Strategy Applied! ${result.reasoning || 'All settings optimized.'}`);
    } catch (error: any) {
      console.error('Error in Let AI Think:', error);
      handleApiError(error, 'Failed to analyze. Please try again.');
    } finally {
      setIsLetAIThinking(false);
      setTimeout(() => setToastMessage(''), 6000);
    }
  };

  const handleGenerateStandaloneLifestyle = async () => {
    setIsGeneratingStandaloneLifestyle(true);
    setIsLifestyleMode(true);
    setPlanItems([]);

    // Increment generation counter
    lifestyleGenerationCountRef.current += 1;
    const genCount = lifestyleGenerationCountRef.current;

    try {
            const availableProducts = nuSkinProducts.map(p => p.name).join(', ');

      // === ULTRA ANTI-REPETITION ENGINE v2 ===
      // Crypto-grade random seeds + time-based rotation + forced niche selection
      const cryptoArray = new Uint32Array(8);
      crypto.getRandomValues(cryptoArray);
      const randomSeed = Array.from(cryptoArray).map(n => n.toString(36)).join('-');
      const timestamp = Date.now();
      const timeSlot = Math.floor(timestamp / 60000) % 1000; // Changes every minute
      const hourSlot = new Date().getHours();
      const dayOfWeek = new Date().getDay();
      
      // MEGA niche sub-topic pool — 150+ topics organized into zones
      const nicheTopicZones: Record<string, string[]> = {
        'advanced_ingredients': [
          'niacinamide vs vitamin C layering myths',
          'tranexamic acid — the dark spot ingredient nobody talks about',
          'azelaic acid for hormonal acne — better than benzoyl peroxide?',
          'bakuchiol — the retinol alternative for sensitive skin',
          'centella asiatica — why Korean skincare swears by it',
          'adapalene vs tretinoin — which is right for beginners',
          'peptides in skincare — which ones actually work',
          'exosome skincare — the cutting-edge future of anti-aging',
          'snail mucin myths vs science',
          'astaxanthin — the carotenoid 6000x stronger than vitamin C',
          'postbiotic skincare — the next frontier after probiotics',
          'fermented skincare ingredients — why they absorb better',
          'copper peptides vs retinol — which wins for wrinkles',
          'alpha arbutin vs hydroquinone — the safe brightening showdown',
          'polyglutamic acid — 4x more hydrating than hyaluronic acid',
          'squalane vs squalene — why one letter changes everything',
          'EGF (epidermal growth factor) in skincare — revolutionary or risky?',
        ],
        'skin_science': [
          'fungal acne vs regular acne — how to tell the difference',
          'skin purging vs breakouts — the 6-week rule',
          'the pH of your cleanser matters more than the brand',
          'ceramide-to-cholesterol ratio in your moisturizer',
          'chemical sunscreen vs mineral sunscreen — the real difference',
          'blue light from phones — does it actually age your skin?',
          'skin microbiome — why over-cleansing destroys good bacteria',
          'glycation — how sugar literally caramelizes your collagen',
          'sirtuins — the longevity proteins in your skin cells',
          'circadian rhythm skincare — why timing your routine matters',
          'skin barrier repair timeline — what to expect week by week',
          'the 14-day skin cell turnover myth — it\'s actually 28-40 days',
          'how your skin\'s acid mantle works like an invisible shield',
          'transepidermal water loss (TEWL) — the metric that predicts aging',
          'melanin biology — why hyperpigmentation is harder to treat than wrinkles',
          'sebaceous filaments vs blackheads — stop squeezing the wrong thing',
        ],
        'hormones_women': [
          'how your menstrual cycle phase affects your skin (days 1-28)',
          'estrogen drop before period — why jawline acne happens',
          'progesterone and oily skin — the luteal phase effect',
          'PCOS insulin resistance and dark patches (acanthosis nigricans)',
          'thyroid hormones and dry, thinning skin',
          'spironolactone for hormonal acne — what women should know',
          'evening primrose oil for PMS skin and breast tenderness',
          'seed cycling for hormonal balance and clear skin',
          'the cortisol-insulin-acne triangle',
          'birth control pills and skin — the hidden trade-offs',
          'perimenopause skin changes starting at 35',
          'testosterone in women — the acne and hair loss link',
          'prolactin imbalance and adult acne nobody diagnoses',
          'DHEA-S — the adrenal hormone behind forehead acne',
        ],
        'nutrition_beauty': [
          'omega-3 vs omega-6 ratio and skin inflammation',
          'vitamin D deficiency and acne connection',
          'B12 excess causing cystic acne',
          'biotin supplements — helpful or acne trigger?',
          'bone broth collagen vs marine collagen vs plant collagen boosters',
          'anti-inflammatory spices for skin: turmeric, ginger, cinnamon',
          'green tea catechins — how they protect skin from UV damage internally',
          'sulforaphane from broccoli sprouts for skin detox',
          'bitter melon and blood sugar control for acne-prone skin',
          'sea buckthorn oil — the skin superfood',
          'liver detox myths and skin health reality',
          'oxalate-rich foods causing skin issues',
          'histamine intolerance and skin flushing/rosacea',
          'the glycemic index trap — why some "healthy" foods cause acne',
          'zinc picolinate vs zinc gluconate — which form clears skin faster',
          'silica-rich foods for stronger hair and nails',
          'iodine in seaweed — unexpected acne trigger for some women',
        ],
        'gut_connection': [
          'candida overgrowth and skin rashes',
          'SIBO and rosacea connection',
          'leaky gut and eczema — the inflammation pathway',
          'how probiotics choose which skin problems to fix',
          'the vagus nerve-gut-skin triangle',
          'bile acid deficiency — the hidden cause of dry, flaky skin',
          'stomach acid and nutrient absorption for skin health',
          'food combining myths vs real digestive science for skin',
          'the elimination diet protocol for finding your skin triggers',
        ],
        'body_wellness': [
          'cortisol face — puffy morning face from chronic stress',
          'vagus nerve stimulation for better skin',
          'cold water face immersion — science of the dive reflex for skin',
          'lymphatic face mapping — where your puffiness means what',
          'how hard water affects your skin and hair',
          'iron deficiency and hair loss in women',
          'zinc deficiency signs that show on your skin',
          'magnesium deficiency and sleep quality affecting skin repair',
          'how mouth breathing affects face shape and skin',
          'jaw clenching and TMJ causing face shape changes',
          'how airplane travel dehydrates and ages skin in hours',
          'swimming pool chlorine damage to skin and hair',
          'electrolyte balance for plump, hydrated skin',
          'grounding/earthing and inflammation reduction claims',
          'epsom salt baths for magnesium absorption and skin',
          'sleep position and wrinkles — the overlooked aging factor',
          'posture and jawline — how slouching ages your face',
        ],
        'techniques_hacks': [
          'double cleansing gone wrong — when oil cleansers cause more acne',
          'why your toner might be drying your skin instead of hydrating it',
          'ice roller vs gua sha — which actually works better',
          'red light therapy at home — what the science says',
          'slugging — is petroleum jelly actually good for skin?',
          'skin flooding technique — water + hyaluronic acid layering',
          'retinol sandwich method — the gentle way to use retinoids',
          'melatonin as a topical antioxidant for skin',
          'dry brushing — lymphatic drainage or skin irritation?',
          'autophagy and fasting — does it help skin renewal?',
          'vitamin C serum oxidation — when it turns brown, is it still effective?',
          'hyaluronic acid in dry climates — why it can backfire',
          'the 60-second cleansing rule that changes everything',
          'dermarolling at home — safe zones vs danger zones',
          'facial yoga — pseudoscience or legit anti-aging?',
          'oil pulling for skin clarity — myth or mechanism?',
        ],
        'hidden_triggers': [
          'contact dermatitis from perfume — hidden skin irritants',
          'fabric softener causing body acne',
          'pillow bacteria and acne — how often to actually change pillowcases',
          'hair products causing forehead acne (pomade acne)',
          'maskne treatment — post-pandemic ongoing issue',
          'perioral dermatitis from toothpaste ingredients',
          'eyelid dermatitis from makeup remover',
          'body acne mapping — what breakout locations mean',
          'keratosis pilaris — those tiny arm bumps explained',
          'neck skincare — the most neglected aging zone',
          'hand aging — how to protect and reverse',
          'lip care science — why lips peel and crack',
          'phone screen bacteria — your face\'s secret enemy',
          'tap water minerals that secretly irritate sensitive skin',
          'laundry detergent residue causing body eczema',
          'gym equipment bacteria and body breakouts',
        ],
        'trending_controversial': [
          'stretch marks — what actually works and what doesn\'t',
          'cellulite — the honest science (hint: it\'s not toxins)',
          'scalp health and hair growth — seborrheic dermatitis',
          'caffeine topically vs internally for under-eye circles',
          'tamanu oil for acne scars',
          'rosehip oil vs argan oil — which is better for your skin type',
          'mushroom extracts for skin — reishi, chaga, tremella',
          'how dehydration mimics aging — skin turgor test',
          'sunscreen reapplication — the 2-hour rule and when it doesn\'t apply',
          'the "skinimalism" movement — less products, better skin?',
          'tretinoin vs retinol — is prescription always better?',
          'DIY skincare dangers — lemon juice, baking soda, and other myths',
          'Korean 10-step routine — genius or overkill in 2025?',
          'glass skin vs healthy skin — are they the same thing?',
          'why expensive skincare isn\'t always better — the markup truth',
          'natural vs synthetic ingredients — which is actually safer?',
        ],
      };
      
      // Use crypto + time to select DIFFERENT zones each time
      const zoneKeys = Object.keys(nicheTopicZones);
      const cryptoZoneOffset = cryptoArray[0] % zoneKeys.length;
      const timeZoneOffset = (timeSlot + hourSlot + dayOfWeek) % zoneKeys.length;
      
      // Pick 3-4 zones that are different each time based on crypto + time
      const selectedZoneIndices = new Set<number>();
      selectedZoneIndices.add(cryptoZoneOffset);
      selectedZoneIndices.add((cryptoZoneOffset + cryptoArray[1] % 3 + 1) % zoneKeys.length);
      selectedZoneIndices.add((timeZoneOffset + cryptoArray[2] % 2 + 2) % zoneKeys.length);
      if (standaloneDaysCount > 7) {
        selectedZoneIndices.add((cryptoArray[3] + genCount) % zoneKeys.length);
      }
      
      // Gather topics from selected zones
      const topicCandidates: string[] = [];
      for (const idx of selectedZoneIndices) {
        const zone = zoneKeys[idx];
        topicCandidates.push(...nicheTopicZones[zone]);
      }
      
      // Crypto-shuffle the candidates for true randomness
      for (let i = topicCandidates.length - 1; i > 0; i--) {
        const cryptoIdx = new Uint32Array(1);
        crypto.getRandomValues(cryptoIdx);
        const j = cryptoIdx[0] % (i + 1);
        [topicCandidates[i], topicCandidates[j]] = [topicCandidates[j], topicCandidates[i]];
      }
      
      // Filter out any topics from history
      const topicHistory = lifestyleTopicHistoryRef.current;
      const freshTopics = topicCandidates.filter(t => 
        !topicHistory.some(h => h.toLowerCase().includes(t.toLowerCase().slice(0, 20)) || t.toLowerCase().includes(h.toLowerCase().slice(0, 20)))
      );
      
      // Select MANDATORY topics — these MUST be used as Day 1, Day 2, etc.
      const mandatoryTopicCount = Math.min(Math.ceil(standaloneDaysCount * 0.6), freshTopics.length);
      const mandatoryTopics = freshTopics.slice(0, mandatoryTopicCount);
      const inspirationTopics = freshTopics.slice(mandatoryTopicCount, mandatoryTopicCount + 8);
      
      // Content pillar rotation — crypto-shuffled
      const contentPillarRotation = [
        'Skincare — skin barrier, SPF, retinol, acne, dark spots, oily skin, moisturizer, ingredients',
        'Beauty from within — collagen foods, anti-inflammatory eating, hydration, vitamins for skin',
        'Women\'s health — hormonal acne, period skin changes, PCOS skin, hair loss, vaginal health basics',
        'Mind and skin — stress breakouts, cortisol acne, sleep and skin, self-care routines',
        'Body wellness — gut skin connection, lymphatic drainage, bloating, weight and hormones'
      ];
      for (let i = contentPillarRotation.length - 1; i > 0; i--) {
        const ci = new Uint32Array(1);
        crypto.getRandomValues(ci);
        const j = ci[0] % (i + 1);
        [contentPillarRotation[i], contentPillarRotation[j]] = [contentPillarRotation[j], contentPillarRotation[i]];
      }
      
      // CTA rotation
      const ctaRotation = [
        'ဒါမသိခဲ့ဖူးရင် comment မှာ YES ထားခဲ့ပါ',
        'မင်း skin type ဘာလဲ? Comment မှာ ရေးပါ၊ ငါ recommend လုပ်ပေးမယ်',
        'ဒါ friend တစ်ယောက်ကို tag လုပ်သင့်တဲ့ post ပဲ',
        'Myth လား Fact လား — M နဲ့ F နဲ့ ဖြေပါ',
        'မင်းရဲ့ experience ကို comment မှာ share ပါ၊ ငါ respond လုပ်မယ်',
        'ဒါ မင်း routine မှာ လုပ်နေပြီလား? YES or NO',
        'ဒီ tip ကို screenshot ရိုက်ထားပြီး save လုပ်ထား!',
        'ဒီ post ကို skin care ချစ်တဲ့ သူငယ်ချင်းကို share လုပ်ပေးပါ',
        'မင်းဘယ် step မှာ အခက်ခဲဆုံးလဲ? Comment မှာ ပြောပြပါ',
        'Before \/After ရှိရင် DM ပို့ပါ! Feature လုပ်ပေးမယ်'
      ];

      // Dynamic Hero Theme — crypto-random selection
      const campaignThemes = [
        'Debunking Toxic Myths: Expose what the beauty industry lies about',
        'Holistic Glow Up: Connecting gut health, mental health, and outer beauty',
        'Lazy Girl Hacks: Maximum results with 3-step routines',
        'Under-The-Radar Ingredients: Powerful but lesser-known skincare heroes',
        'Budget vs Luxury: Clever ways to save money without losing the glow',
        'The Science of Beauty: Deep dives into why ingredients actually work',
        'Hormone Harmony: Bio-hacking for clear skin, periods, and better energy',
        'Controversial Opinions: Bold takes that go against common advice',
        'Nighttime Rejuvenation: The art of sleep, repair, and waking up flawless',
        'Asian Beauty Philosophy: Gentle care, fermented ingredients, and prevention',
        'Microbiome Revolution: How bacteria control your skin destiny',
        'Food as Medicine: The diet-skin connection nobody teaches you',
        'Hidden Toxins: Everyday products secretly damaging your skin',
        'Speed Science: Get results in 3 days, 7 days, 14 days — with proof',
        'Reverse Aging: Anti-aging secrets that actually have science behind them'
      ];
      const themeIdx = new Uint32Array(1);
      crypto.getRandomValues(themeIdx);
      const selectedTheme = campaignThemes[themeIdx[0] % campaignThemes.length];

      // Build the "NEVER REPEAT" blocklist from history
      const avoidanceBlock = topicHistory.length > 0
        ? `\n\n⛔ ABSOLUTE REPETITION BAN — YOU MUST NOT REPEAT ANY OF THESE PREVIOUSLY GENERATED TOPICS:\n${topicHistory.map((t, i) => `${i + 1}. "${t}"`).join('\n')}\n\nThe above topics have ALREADY been generated. You MUST choose COMPLETELY DIFFERENT topics, angles, and approaches. If you repeat any of them, the generation is a FAILURE.\n`
        : '';

      // MANDATORY topics block — forces the AI to use specific pre-selected topics
      const mandatoryBlock = mandatoryTopics.length > 0
        ? `\n🔒 MANDATORY TOPICS — You MUST use these exact topics for the first ${mandatoryTopics.length} days (adapt title to Burmese but keep the core subject):\n${mandatoryTopics.map((t, i) => `Day ${i + 1}: "${t}"`).join('\n')}\n\nFor remaining days, use these for inspiration:\n${inspirationTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n`
        : '';

      // First-generation freshness boost
      const firstGenBoost = genCount <= 1 ? `
      🚨 FIRST GENERATION ALERT — MAXIMUM FRESHNESS REQUIRED:
      This is the VERY FIRST blueprint being generated. There is NO excuse for generic content.
      - Day 1 MUST start with a shocking, unexpected, or controversial topic that grabs immediate attention
      - BANNED GENERIC TOPICS for Day 1: sunscreen, drink water, moisturize, sleep, basic skincare routine
      - Instead, lead with something a viewer has NEVER seen before: a specific hormone pathway, an ingredient interaction, a myth everyone believes, or a body-skin connection that surprises
      - The entire blueprint must feel like insider knowledge, NOT a beginner's guide
      ` : '';

      const prompt = `Create a ${standaloneDaysCount}-Day Viral Content Blueprint for Myanmar women aged 18-35.
      
      🔥 HERO THEME FOR THIS BLUEPRINT: "${selectedTheme}"
      (All content must weave into this overarching theme to ensure it's completely unique.)
      
      Engagement Style: "${standaloneEngagementStyle}"
      Generation #${genCount} | Unique Creative Seed: ${randomSeed} | Time Slot: ${timeSlot} | Hour: ${hourSlot}
      ${firstGenBoost}
      CONTENT PILLARS (rotate across all ${standaloneDaysCount} days — cover at least 3 different pillars):
      ${contentPillarRotation.map((p, i) => `${i + 1}. ${p}`).join('\n      ')}
      ${avoidanceBlock}
      ${mandatoryBlock}
      
      ⚡ VIRAL CONTENT FORMULA — Every topic must score HIGH on these:
      1. SHOCK VALUE: Does this make someone stop scrolling? ("Wait, WHAT?")
      2. SAVE-WORTHY: Is this specific enough that someone would screenshot it?
      3. SHARE TRIGGER: Would someone tag a friend or send this to their group chat?
      4. DEBATE POTENTIAL: Could this spark a comment war? ("I disagree because...")
      5. RELATABILITY: Does this describe a problem she's silently struggling with?
      
      CRITICAL INSTRUCTIONS FOR FRESHNESS & UNIQUENESS:
      1. This is generation #${genCount}. Every generation MUST be 100% different. NEVER recycle topics, hooks, or angles.
      2. The very FIRST day's topic MUST be extremely fresh, weird, or highly scientific. DO NOT start with generic advice.
      3. Dive into HIGHLY SPECIFIC, NICHE sub-topics. NOT generic advice.
      4. Creative routing seed: [${randomSeed}]. Use this to pick unexpected, specific angles.
      5. Each day's topic must be SURPRISING — something she hasn't seen on her feed before.
      6. Mix DIFFERENT content formats: myth-bust, how-to, science explainer, hot take, comparison, personal experiment.
      
      POST FORMAT RULES — EVERY post MUST follow this 5-part structure:
      1. Hook — one bold line that stops the scroll (surprising myth, relatable problem, or shocking truth)
      2. Validate — one sentence that makes her feel seen
      3. Educate — explain the science in 2-3 simple sentences, no jargon, use analogies
      4. Action — numbered steps she can start today (max 5 steps, be specific)
      5. CTA — one easy question that makes her want to comment
      
      VIRALITY RULES:
      - Use Myth-bust format: အယူအဆ → အမှန်တကယ်
      - Use How-to format with timeframes: "၃ မိနစ်", "၇ ရက်"
      - Always give specific numbers: "၆ မျိုး", "၃ ဆင့်", "၂ ပတ်" — vague advice does NOT get saved
      
      CTA PHRASES TO ROTATE (use a different one for each day):
      ${ctaRotation.map((c, i) => `${i + 1}. "${c}"`).join('\n      ')}
      
      CORE INSTRUCTIONS:
      4. Generate exactly ${standaloneDaysCount} days of content.
      5. DO NOT USE BLANKS OR PLACEHOLDERS like [Brand Name] or [Product Name]. 
      6. For product-focused days, organically feature a suitable product from this list: ${availableProducts}. 
      7. IMPORTANT: Do NOT promote a product in every single post. At least 60% of posts should be pure value-driven content — beauty knowledge, health tips, lifestyle hacks — without selling anything.
      8. For each day, provide:
         - A catchy 'title' (in Burmese) — include a specific number or timeframe when possible.
         - The 'format' (e.g. Single Image, Carousel, Short Video). Vary the formats.
         - An engaging 'hook' (in Burmese) — one bold scroll-stopping line.
         - A brief 'summary' detailing the core message, which content pillar it covers, and the CTA to use.
      9. Write the content 100% natively in the Myanmar (Burmese) language. Warm sisterly tone. Never clinical or formal.`;

      const contents: any = { parts: [{ text: prompt }] };
      const response = await withRetry(() => callAI('gemini-flash-lite-latest', contents, {
          systemInstruction: MYANMAR_BEAUTY_HEALTH_WRITER_PROMPT,
          temperature: 1.4,
          topP: 0.95,
          topK: 60,
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                day: { type: SchemaType.INTEGER, description: "Day number (1 to n)" },
                title: { type: SchemaType.STRING },
                format: { type: SchemaType.STRING },
                hook: { type: SchemaType.STRING },
                summary: { type: SchemaType.STRING }
              },
              required: ["day", "title", "format", "hook", "summary"]
            }
          }
        }, currentApiKey));

      let jsonStr = response.text || '[]';
      // Clean up potential markdown formatting
      jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const firstBrace = jsonStr.indexOf('{');
      const firstBracket = jsonStr.indexOf('[');
      if (firstBrace !== -1 && firstBracket !== -1) {
        jsonStr = jsonStr.substring(Math.min(firstBrace, firstBracket));
      } else if (firstBrace !== -1) {
        jsonStr = jsonStr.substring(firstBrace);
      } else if (firstBracket !== -1) {
        jsonStr = jsonStr.substring(firstBracket);
      }
      
      const lastBrace = jsonStr.lastIndexOf('}');
      const lastBracket = jsonStr.lastIndexOf(']');
      if (lastBrace !== -1 && lastBracket !== -1) {
        jsonStr = jsonStr.substring(0, Math.max(lastBrace, lastBracket) + 1);
      } else if (lastBrace !== -1) {
        jsonStr = jsonStr.substring(0, lastBrace + 1);
      } else if (lastBracket !== -1) {
        jsonStr = jsonStr.substring(0, lastBracket + 1);
      }

      const parsedItems = JSON.parse(jsonStr);
      setPlanItems(parsedItems);
      setDaysCount(standaloneDaysCount);

      // === SAVE GENERATED TOPICS TO HISTORY FOR ANTI-REPETITION ===
      const newTopics = parsedItems.map((item: PlanItem) => item.title).filter(Boolean);
      const newHooks = parsedItems.map((item: PlanItem) => item.hook).filter(Boolean);
      lifestyleTopicHistoryRef.current = [
        ...lifestyleTopicHistoryRef.current,
        ...newTopics,
        ...newHooks
      ].slice(-100); // Keep last 100 entries to avoid prompt bloat

      setToastMessage(`✨ Generation #${genCount}: ${standaloneDaysCount}-Day Fresh Blueprint generated!`);
    } catch (error: any) {
      console.error('Error generating lifestyle blueprint:', error);
      handleApiError(error, 'Failed to generate blueprint.');
    } finally {
      setIsGeneratingStandaloneLifestyle(false);
      setTimeout(() => setToastMessage(''), 4000);
    }
  };

  const handleGeneratePlan = async (e?: React.FormEvent, isRegenerate: boolean = false) => {
    if (e) e.preventDefault();
    if (!productName || !targetAudience) return;

    setIsGeneratingPlan(true);
    setIsLifestyleMode(false);
    
    // Store summary of previous plan for avoidance
    if (planItems.length > 0) {
      const prevSummary = planItems.map(item => `Day ${item.day}: ${item.title} (${item.format}) - ${item.hook}`).join('\n');
      setPreviousPlanSummary(prevSummary);
    }
    
    setPlanItems([]);
    const currentGenCount = planGenerationCount + 1;
    setPlanGenerationCount(currentGenCount);

    try {
            const productContext = getProductContext(productName);

      // === CREATIVE DIVERSITY ENGINE ===
      // Different content angles to rotate through
      const contentAngles = [
        'storytelling-first: lead with personal stories, customer journeys, and emotional narratives',
        'education-first: lead with surprising facts, myth-busting, and expert knowledge sharing',
        'controversy-and-debate: lead with bold opinions, unpopular takes, and conversation starters',
        'community-building: lead with polls, Q&As, user-generated content prompts, and challenges',
        'aspirational-lifestyle: lead with dream outcomes, luxury experiences, and future-self visualization',
        'behind-the-scenes: lead with raw authenticity, process reveals, and brand transparency',
        'trend-jacking: lead with current 2026 viral trends, memes, and cultural moments',
        'problem-solution: lead with pain point amplification, then dramatic solution reveals',
        'social-proof: lead with testimonials, before/after transformations, and real results',
        'entertainment-first: lead with humor, relatable situations, and shareable moments',
        'fear-of-missing-out: lead with urgency, exclusivity, and limited-time angles',
        'comparison-and-contrast: lead with product vs alternatives, old way vs new way narratives',
      ];
      
      const campaignStrategies = [
        'Build-up Launch: Start soft with education, build curiosity mid-campaign, climax with a big reveal/offer',
        'Reverse Funnel: Start with the strongest testimonial/result, then unpack how it happened over days',
        'Daily Challenge: Each day is a micro-challenge for the audience tied to the product',
        'Mini-Series: Create a continuing story arc across posts, like a drama serial',
        'Expert Authority: Position the brand as the go-to expert with tips, data, and insider knowledge',
        'Customer Spotlight: Each day features a different real or relatable customer persona',
        'Myth vs Reality: Each day busts a common misconception while educating about the product',
        'Countdown Hype: Build excitement toward a specific event, launch, or special date',
        'Transformation Journey: Follow a single transformation story across the campaign days',
        'Content Mix Mastery: Alternate between entertaining, educating, and converting posts strategically',
      ];
      
      const hookStyles = [
        'POV hooks and first-person narratives ("POV: သင် _____ ဖြစ်တဲ့အချိန်")',
        'Controversial questions that demand engagement ("___ ဟာ အမှန်တကယ် အလုပ်ဖြစ်ရဲ့လား?")',
        'Story hooks with cliffhangers ("ငါ့သူငယ်ချင်း ___ ကိုသုံးပြီးနောက် ___")',
        'Number-driven curiosity gaps ("___ ရဲ့ ၉၀% က ဒါကို မသိကြဘူး")',
        'Direct callout hooks ("___သုံးနေသူတွေ ဒါကို ဖတ်ပါ")',
        'Before/After reveals ("___မသုံးခင် vs သုံးပြီးနောက် ___")',
        'Unpopular opinion hooks ("Unpopular opinion: ___")',
        'Tutorial/How-to hooks ("___ ဘယ်လိုလုပ်မလဲ? Step-by-step")',
        'Myth-busting hooks ("___ အကြောင်း လူတွေ ယုံကြည်နေတာ မှားနေပြီ")',
        'Emotional confession hooks ("ငါ ___ ကို ဝန်ခံရမယ့်ကိစ္စတစ်ခုရှိတယ်")',
      ];
      
      const narrativeArcs = [
        'Journey arc: awareness → curiosity → desire → trust → action',
        'Problem spiral: small annoyance → growing frustration → breaking point → discovery → relief',
        'Contrast arc: old life vs new life, showing transformation at every step',
        'Community arc: individual → shared experience → collective movement',
        'Discovery arc: question → investigation → surprising insight → enlightenment → sharing',
        'Emotional rollercoaster: joy → setback → persistence → triumph',
      ];

      // Randomly select creative directions for this generation
      const randomSeed = Date.now();
      const pickRandom = <T,>(arr: T[], count: number): T[] => {
        const shuffled = [...arr].sort(() => Math.sin(randomSeed * Math.random()) - 0.5);
        return shuffled.slice(0, count);
      };
      
      const selectedAngles = pickRandom(contentAngles, 3);
      const selectedStrategy = pickRandom(campaignStrategies, 1)[0];
      const selectedHookStyles = pickRandom(hookStyles, 3);
      const selectedArc = pickRandom(narrativeArcs, 1)[0];

      // 2026 Trend Context
      const currentDate = new Date();
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const currentMonth = monthNames[currentDate.getMonth()];
      const currentYear = currentDate.getFullYear();
      
      const trendContext2026 = `
CURRENT DATE CONTEXT: ${currentMonth} ${currentYear}
2026 SOCIAL MEDIA LANDSCAPE & TRENDS TO LEVERAGE:
- Short-form video dominance: TikTok, Reels, and Shorts are the primary content formats
- AI-powered personalization is mainstream — audiences expect hyper-relevant content
- Authenticity over perfection: raw, unfiltered content outperforms polished ads
- Community-first marketing: brands that build communities outperform those that just advertise
- UGC (User-Generated Content) and creator collaborations are essential
- Interactive content: polls, quizzes, AR filters drive 3x more engagement
- Myanmar social media trends ${currentYear}: Facebook remains #1, TikTok explosive growth, Viber communities for close engagement
- Micro-influencer partnerships outperform celebrity endorsements in Myanmar market
- Live shopping and real-time engagement are booming in Myanmar
- Sustainability and clean beauty messaging resonates strongly in ${currentYear}
- Voice/audio content and podcast clips gaining traction
- "Edutainment" — educational + entertaining content gets highest saves/shares
- Behind-the-scenes and "day in my life" content builds strongest trust`;

      // Build the enhanced prompt
      const prompt = `Create a ${daysCount}-day viral social media content calendar.
      
      Product: "${productName}"
      Product Benefits: "${productBenefits}"
      Desired Emotional Response: "${emotionalResponse}"
      Target Audience: "${targetAudience}"
      Campaign Goal: "${campaignGoal}"
      Marketing Framework: "${framework}"
      Primary Platform: "${platform}"
      Content Pillars: "${contentPillars}"
      Call-to-Action Style: "${ctaStyle}"
      Post Formats: Exactly ${reelsCount} Reels (Video), exactly ${carouselCount} Carousels, and the remaining ${daysCount - reelsCount - carouselCount} as Single Images.
      ${productContext ? `\nCRITICAL PRODUCT KNOWLEDGE:\n${productContext}\nEnsure all content respects these usage rules and target areas.` : ''}

      ${trendContext2026}

      === CREATIVE DIRECTION FOR THIS GENERATION (Generation #${currentGenCount}) ===
      
      MANDATORY CONTENT ANGLES (use these specific approaches):
      ${selectedAngles.map((a, i) => `${i + 1}. ${a}`).join('\n')}
      
      CAMPAIGN STRATEGY: ${selectedStrategy}
      
      HOOK STYLES TO USE (mix these across days):
      ${selectedHookStyles.map((h, i) => `${i + 1}. ${h}`).join('\n')}
      
      NARRATIVE ARC: ${selectedArc}

      ${previousPlanSummary ? `\n=== EXTREME AVOIDANCE RULES (DO NOT REPEAT) ===\n${previousPlanSummary}\n\nYou MUST NOT use any of these concepts again. Invent entirely new topics.\n` : ''}
      
      BEAUTY & SKINCARE VIRALITY RULES (CRITICAL):
      - Maximize viral and trending tips, hacks, and tricks specific to the beauty/skincare/cosmetic field.
      - Provide highly useful, actionable advice that audiences want to save and share instantly (e.g., secret techniques, layering hacks, dermatologist secrets).
      - Frame products around solving extreme pain points or achieving trending "glass skin" / "clean girl" aesthetics.
      
      ANTI-REPETITION & MAXIMUM VARIANCE RULES (CRITICAL):
      - This is Generation #${currentGenCount}. DO NOT use standard AI boilerplate templates.
      - DO NOT give the same obvious content ideas (e.g., basic "how to use", basic "ingredients list", basic "before and after").
      - INVENT highly specific, niche, and unexpected scenarios (e.g., "how to fix cakey makeup in 30 seconds", "the exact routine for 12-hour flights").
      - Every single day MUST feel completely fresh, radically different from typical beauty ads, and highly unpredictable.
      
      ${isRegenerate ? `\nCRITICAL REGENERATION RULES:
      - The user was NOT satisfied with previous results. You MUST generate COMPLETELY DIFFERENT topics, hooks, and content concepts.
      - Try unexpected, unconventional, or bold approaches that would surprise the user.` : ''}
      
      CRITICAL INSTRUCTIONS:
      1. Provide EXACTLY ${daysCount} items. Keep the summary short and punchy.
      2. The ENTIRE response (titles, summaries, hooks, everything) MUST be written perfectly in the Myanmar (Burmese) language.
      3. TARGET AUDIENCE ALIGNMENT: You MUST strictly tailor all topics to "${targetAudience}".
      4. VARIETY IS CRITICAL: Each day MUST have a distinctly different topic, hook style, and emotional angle.
      5. TREND AWARENESS: Reference current ${currentYear} beauty trends and social media formats.
      6. RANDOM SEED FOR MAXIMUM VARIANCE: ${Math.random().toString(36).substring(2, 12)}-${Date.now()} (Use this seed to radically change your output from any previous runs)`;

      const response = await withRetry(() => callAI('gemini-flash-lite-latest', prompt, {
          systemInstruction: MYANMAR_STRATEGIST_PROMPT,
          temperature: 1.2 + (currentGenCount * 0.1 > 0.5 ? 0.5 : currentGenCount * 0.1),
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                day: { type: SchemaType.NUMBER, description: `Day number (1-${daysCount})` },
                title: { type: SchemaType.STRING, description: "Short catchy title for the post" },
                format: { type: SchemaType.STRING, description: "e.g., Reel, Carousel, Story, Static Image" },
                hook: { type: SchemaType.STRING, description: "The opening hook or headline" },
                summary: { type: SchemaType.STRING, description: "Brief 1-2 sentence summary of the visual and content" }
              },
              required: ["day", "title", "format", "hook", "summary"]
            }
          }
        }, currentApiKey));

      let jsonStr = response.text || '[]';
      // Clean up potential markdown formatting
      jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      
      // Find the first '{' or '[' to handle any leading text before JSON
      const firstBrace = jsonStr.indexOf('{');
      const firstBracket = jsonStr.indexOf('[');
      if (firstBrace !== -1 && firstBracket !== -1) {
        jsonStr = jsonStr.substring(Math.min(firstBrace, firstBracket));
      } else if (firstBrace !== -1) {
        jsonStr = jsonStr.substring(firstBrace);
      } else if (firstBracket !== -1) {
        jsonStr = jsonStr.substring(firstBracket);
      }
      
      // Find the last '}' or ']' to handle any trailing text after JSON
      const lastBrace = jsonStr.lastIndexOf('}');
      const lastBracket = jsonStr.lastIndexOf(']');
      if (lastBrace !== -1 && lastBracket !== -1) {
        jsonStr = jsonStr.substring(0, Math.max(lastBrace, lastBracket) + 1);
      } else if (lastBrace !== -1) {
        jsonStr = jsonStr.substring(0, lastBrace + 1);
      } else if (lastBracket !== -1) {
        jsonStr = jsonStr.substring(0, lastBracket + 1);
      }

      let items = JSON.parse(jsonStr);
      
      // Handle case where model returns an object with an array property
      if (!Array.isArray(items)) {
        if (items.plan && Array.isArray(items.plan)) items = items.plan;
        else if (items.items && Array.isArray(items.items)) items = items.items;
        else if (items.days && Array.isArray(items.days)) items = items.days;
        else items = [items];
      }
      
      setPlanItems(items);
    } catch (error: any) {
      console.error('Error generating plan:', error);
      handleApiError(error, 'Failed to generate plan. Please try again.');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleGenerateFullPost = async () => {
    if (!selectedDay) return;
    setIsGeneratingFullPost(true);
    setPostVariations([]);
    setActiveVariationIndex(0);

    const currentAttempt = generationAttempt + 1;
    setGenerationAttempt(currentAttempt);

    try {
            const productContext = getProductContext(productName);
      
      const isLifestyle = isLifestyleMode;
      const lifestyleContext = isLifestyle ? `
      Engagement Style: "${standaloneEngagementStyle}"
      
      LIFESTYLE MODE — VIRAL BEAUTY & HEALTH CONTENT INSTRUCTIONS:
      Target Audience: Myanmar women aged 18-35 who care about their skin and health.
      Tone: Write like a knowledgeable older sister — warm, honest, never preachy. Educational but conversational.
      
      MANDATORY 5-PART POST STRUCTURE:
      1. Hook — one bold line that stops the scroll. A surprising myth, a relatable problem, or a shocking truth.
      2. Validate — one sentence that makes her feel seen ("ဒါ မင်းတစ်ယောက်တည်းမဟုတ်ဘူး")
      3. Educate — explain the science in 2-3 simple sentences. No jargon. Use analogies if needed.
      4. Action — numbered steps she can start today. Maximum 5 steps. Be specific with numbers and timeframes.
      5. CTA — one easy question that makes her want to comment. Use one of these rotating CTAs:
         - "ဒါမသိခဲ့ဖူးရင် comment မှာ YES ထားခဲ့ပါ"
         - "မင်း skin type ဘာလဲ? Comment မှာ ရေးပါ၊ ငါ recommend လုပ်ပေးမယ်"
         - "ဒါ friend တစ်ယောက်ကို tag လုပ်သင့်တဲ့ post ပဲ"
         - "Myth လား Fact လား — M နဲ့ F နဲ့ ဖြေပါ"
         - "မင်းရဲ့ experience ကို comment မှာ share ပါ၊ ငါ respond လုပ်မယ်"
         - "ဒါ မင်း routine မှာ လုပ်နေပြီလား? YES or NO"
      
      TONE RULES:
      - Never shame. Never guilt. Always empower.
      - Validate her experience first, then educate.
      - Make her feel smart for learning this, not stupid for not knowing it before.
      
      VIRALITY RULES:
      - Use Myth-bust format: အယူအဆ → အမှန်တကယ်
      - Use How-to format with timeframes: "၃ မိနစ်", "၇ ရက်"
      - Always give specific numbers: "၆ မျိုး", "၃ ဆင့်", "၂ ပတ်"
      - Pack enough value that she saves it for later
      - End with something she wants to share with her friends
      
      - If a product is mentioned in the day's summary, feature it naturally within the educational content. If no product is mentioned, create pure value-driven content.
      - Make the content feel authentic, relatable, and highly shareable — NOT salesy.
      - Include 10 hashtags at the end — mix of Burmese and English.
      ` : '';
      
      // === AUTO TONE RESOLVER ===
      const resolvedTone = (() => {
        if (tone !== 'Auto (AI Recommended)') return tone;
        const ctx = `${targetAudience} ${campaignGoal} ${contentPillars} ${selectedDay?.summary || ''} ${selectedDay?.title || ''} ${productBenefits}`.toLowerCase();
        // Age-based detection
        const isYoung = /gen z|16-25|18-25|young|teenager|teen|youth|tiktok/i.test(ctx);
        const isMature = /30-50|35-50|40-60|anti.?aging|wrinkle|mature|age/i.test(ctx);
        const isMom = /mom|mother|မိခင်|busy|time.?saving|family|child/i.test(ctx);
        // Goal-based detection
        const isScience = /science|clinical|dermatolog|ingredient|research|study|evidence/i.test(ctx);
        const isLuxury = /luxury|spa|premium|elegant|exclusive|高級/i.test(ctx);
        const isNatural = /natural|organic|clean|green|eco|botanical|plant/i.test(ctx);
        const isResults = /result|before.?after|transform|testimonial|proof|sale|convert/i.test(ctx);
        const isGlow = /glow|youthful|aspirat|radiant|bright|beautiful|dream/i.test(ctx);
        if (isYoung) return 'Gen Z / Trendy & Viral';
        if (isMom) return 'Busy Mom / Time-Saving Beauty';
        if (isScience) return 'Scientific & Dermatologist-Approved';
        if (isLuxury) return 'Luxury Spa Experience';
        if (isNatural) return 'Natural & Organic (Clean Beauty)';
        if (isResults) return 'Direct & Results-Driven';
        if (isGlow) return 'Glowing & Youthful (Aspirational)';
        if (isMature) return 'Elegant & Anti-Aging Focus (Age 30-50)';
        return 'Elegant & Anti-Aging Focus (Age 30-50)';
      })();

      const prompt = `Write 1 complete, highly engaging, ready-to-publish social media post variation for Day ${selectedDay.day} of our ${daysCount}-day ${isLifestyle ? 'lifestyle content' : 'campaign'}.
      
      ${isLifestyle ? lifestyleContext : `Product: "${productName}"
      Product Benefits: "${productBenefits}"
      Desired Emotional Response: "${emotionalResponse}"`}
      Target Audience: "${targetAudience || 'Beauty-conscious women aged 25-45'}"
      Campaign Goal: "${campaignGoal || 'Boost engagement'}"
      Framework: "${framework}"
      Tone / Content Style: "${resolvedTone}"${tone === 'Auto (AI Recommended)' ? ` (AUTO-SELECTED: The AI has analyzed the campaign context and determined this is the optimal content style for maximum engagement. Fully embrace this tone.)` : ''}
      Platform: "${platform}"
      Content Pillars: "${contentPillars || 'Education, Lifestyle, Product Demo'}"
      CTA Style: "${ctaStyle}"
      ${!isLifestyle && productContext ? `\nCRITICAL PRODUCT KNOWLEDGE:\n${productContext}\nEnsure the caption accurately reflects how and where the product is used.` : ''}
      
      Post Details:
      Title: ${selectedDay.title}
      Format: ${selectedDay.format}
      Hook: ${selectedDay.hook}
      Summary: ${selectedDay.summary}
      
      CRITICAL INSTRUCTIONS FOR A HIGH-CONVERTING POST:
      1. LANGUAGE: Write the ENTIRE caption perfectly in the Myanmar (Burmese) language. Ensure natural phrasing and cultural relevance.
      2. FRAMEWORK EXECUTION: You MUST strictly follow the "${framework}" copywriting framework. Structure the flow of the post exactly according to this framework to maximize engagement and conversions.
      3. TARGET AUDIENCE & CONTENT STYLE: The post MUST perfectly embody the "${tone}" style and speak directly to the "${targetAudience}". Ensure the vocabulary, pain points, desires, and cultural references are highly relatable and specific to this exact demographic. Avoid generic messaging. Do not use Gen Z slang unless the target audience is Gen Z.
      4. SPACING & READABILITY: Make the content highly readable. Use clear paragraph breaks (double spacing) between each section of the framework. Do not write a giant wall of text.
      5. EMOJIS: Include relevant, eye-catching emojis naturally throughout the text to break up paragraphs and highlight key points. Make it visually appealing for social media.
      6. NO LABELS: DO NOT include framework labels or structural words like "Hook:", "Attention:", "Interest:", "Desire:", "Action:", "Body:", or "Caption:". The text must flow naturally and be ready to copy-paste directly to social media.
      7. HASHTAGS: Include relevant, high-performing hashtags at the very end.
      8. VISUAL DIRECTION: Provide detailed visual/video instructions for the creator (these instructions should also be in Myanmar language). This MUST be returned in the separate "visualDirection" field, NOT in the "content" field.
      ${currentAttempt > 1 ? `\n\nIMPORTANT: This is generation attempt #${currentAttempt}. Please provide a FRESH, MORE CREATIVE, and HIGHLY UNIQUE variation compared to standard responses. Try a different angle or a more captivating hook!` : ''}
      
      You MUST return exactly 1 highly optimized variation of the post.
      Return the response in JSON format matching this schema:
      {
        "variations": [
          {
            "id": "var1",
            "title": "Variation Title (e.g. POV Hook)",
            "platform": "Platform Name",
            "content": "The actual post content...",
            "visualDirection": "Detailed visual/video instructions for the creator...",
            "explanation": "Why this hook works psychologically (in Myanmar)",
            "flags": "Any slang shelf-life flags (optional)"
          }
        ]
      }
      `;

      const response = await withRetry(() => callAI('gemini-flash-lite-latest', prompt, {
          systemInstruction: MYANMAR_STRATEGIST_PROMPT,
          temperature: 1.0,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              variations: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    id: { type: SchemaType.STRING },
                    title: { type: SchemaType.STRING },
                    platform: { type: SchemaType.STRING },
                    content: { type: SchemaType.STRING },
                    visualDirection: { type: SchemaType.STRING },
                    explanation: { type: SchemaType.STRING },
                    flags: { type: SchemaType.STRING }
                  },
                  required: ["id", "title", "platform", "content", "visualDirection", "explanation"]
                }
              }
            },
            required: ["variations"]
          }
        }, currentApiKey));

      let jsonStr = response.text || '{}';
      jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      
      // Find the first '{' or '[' to handle any leading text before JSON
      const firstBrace = jsonStr.indexOf('{');
      const firstBracket = jsonStr.indexOf('[');
      if (firstBrace !== -1 && firstBracket !== -1) {
        jsonStr = jsonStr.substring(Math.min(firstBrace, firstBracket));
      } else if (firstBrace !== -1) {
        jsonStr = jsonStr.substring(firstBrace);
      } else if (firstBracket !== -1) {
        jsonStr = jsonStr.substring(firstBracket);
      }
      
      // Find the last '}' or ']' to handle any trailing text after JSON
      const lastBrace = jsonStr.lastIndexOf('}');
      const lastBracket = jsonStr.lastIndexOf(']');
      if (lastBrace !== -1 && lastBracket !== -1) {
        jsonStr = jsonStr.substring(0, Math.max(lastBrace, lastBracket) + 1);
      } else if (lastBrace !== -1) {
        jsonStr = jsonStr.substring(0, lastBrace + 1);
      } else if (lastBracket !== -1) {
        jsonStr = jsonStr.substring(0, lastBracket + 1);
      }

      const data = JSON.parse(jsonStr);
      
      let variations: any[] = [];
      if (Array.isArray(data)) {
        variations = data;
      } else if (data && data.variations && Array.isArray(data.variations)) {
        variations = data.variations;
      } else if (data && typeof data === 'object') {
        // Fallback: look for any array in the object
        for (const key in data) {
          if (Array.isArray(data[key]) && data[key].length > 0 && data[key][0].content) {
            variations = data[key];
            break;
          }
        }
        // Fallback: if data is a single variation object
        if (variations.length === 0 && data.content) {
          variations = [data];
        }
      }

      if (variations.length > 0) {
        setPostVariations(variations);
        setPostHistory([variations[0].content]);
        setHistoryIndex(0);
      } else {
        console.error("Parsed data does not contain variations:", data);
        throw new Error("Invalid response format");
      }
    } catch (error: any) {
      console.error('Error generating full post:', error);
      handleApiError(error, 'Failed to generate content. Please try again.');
    } finally {
      setIsGeneratingFullPost(false);
    }
  };

  const handleRegenerateVariation = async (index: number) => {
    if (!selectedDay) return;
    setIsGeneratingVariation(index);

    try {
            const productContext = getProductContext(productName);
      
      const isLifestyle = isLifestyleMode;
      const lifestyleContext = isLifestyle ? `
      Engagement Style: "${standaloneEngagementStyle}"
      
      LIFESTYLE MODE — VIRAL BEAUTY & HEALTH CONTENT INSTRUCTIONS:
      Target Audience: Myanmar women aged 18-35 who care about their skin and health.
      Tone: Write like a knowledgeable older sister — warm, honest, never preachy. Educational but conversational.
      
      MANDATORY 5-PART POST STRUCTURE:
      1. Hook — one bold line that stops the scroll. A surprising myth, a relatable problem, or a shocking truth.
      2. Validate — one sentence that makes her feel seen ("ဒါ မင်းတစ်ယောက်တည်းမဟုတ်ဘူး")
      3. Educate — explain the science in 2-3 simple sentences. No jargon. Use analogies if needed.
      4. Action — numbered steps she can start today. Maximum 5 steps. Be specific with numbers and timeframes.
      5. CTA — one easy question that makes her want to comment. Use one of these rotating CTAs:
         - "ဒါမသိခဲ့ဖူးရင် comment မှာ YES ထားခဲ့ပါ"
         - "မင်း skin type ဘာလဲ? Comment မှာ ရေးပါ၊ ငါ recommend လုပ်ပေးမယ်"
         - "ဒါ friend တစ်ယောက်ကို tag လုပ်သင့်တဲ့ post ပဲ"
         - "Myth လား Fact လား — M နဲ့ F နဲ့ ဖြေပါ"
         - "မင်းရဲ့ experience ကို comment မှာ share ပါ၊ ငါ respond လုပ်မယ်"
         - "ဒါ မင်း routine မှာ လုပ်နေပြီလား? YES or NO"
      
      TONE RULES:
      - Never shame. Never guilt. Always empower.
      - Validate her experience first, then educate.
      - Make her feel smart for learning this, not stupid for not knowing it before.
      
      VIRALITY RULES:
      - Use Myth-bust format: အယူအဆ → အမှန်တကယ်
      - Use How-to format with timeframes: "၃ မိနစ်", "၇ ရက်"
      - Always give specific numbers: "၆ မျိုး", "၃ ဆင့်", "၂ ပတ်"
      - Pack enough value that she saves it for later
      - End with something she wants to share with her friends
      
      - If a product is mentioned in the day's summary, feature it naturally within the educational content. If no product is mentioned, create pure value-driven content.
      - Make the content feel authentic, relatable, and highly shareable — NOT salesy.
      - Include 10 hashtags at the end — mix of Burmese and English.
      ` : '';

      const prompt = `Regenerate a single social media post variation for Day ${selectedDay.day} of our ${daysCount}-day ${isLifestyle ? 'lifestyle content' : 'campaign'}.
      
      ${isLifestyle ? lifestyleContext : `Product: "${productName}"
      Product Benefits: "${productBenefits}"
      Desired Emotional Response: "${emotionalResponse}"`}
      Target Audience: "${targetAudience || 'Beauty-conscious women aged 25-45'}"
      Campaign Goal: "${campaignGoal || 'Boost engagement'}"
      Framework: "${framework}"
      Tone / Content Style: "${tone === 'Auto (AI Recommended)' ? (() => {
        const ctx3 = `${targetAudience} ${campaignGoal} ${contentPillars} ${selectedDay?.summary || ''} ${productBenefits}`.toLowerCase();
        if (/gen z|16-25|18-25|young|teen|tiktok/i.test(ctx3)) return 'Gen Z / Trendy & Viral';
        if (/mom|mother|busy|time.?saving/i.test(ctx3)) return 'Busy Mom / Time-Saving Beauty';
        if (/science|clinical|dermatolog|ingredient/i.test(ctx3)) return 'Scientific & Dermatologist-Approved';
        if (/luxury|spa|premium|elegant/i.test(ctx3)) return 'Luxury Spa Experience';
        if (/natural|organic|clean|green|eco/i.test(ctx3)) return 'Natural & Organic (Clean Beauty)';
        if (/result|before.?after|transform|sale/i.test(ctx3)) return 'Direct & Results-Driven';
        if (/glow|youthful|aspirat|radiant/i.test(ctx3)) return 'Glowing & Youthful (Aspirational)';
        return 'Elegant & Anti-Aging Focus (Age 30-50)';
      })() : tone}"${tone === 'Auto (AI Recommended)' ? ' (AUTO-SELECTED based on campaign analysis)' : ''}
      Platform: "${platform}"
      Content Pillars: "${contentPillars || 'Education, Lifestyle, Product Demo'}"
      CTA Style: "${ctaStyle}"
      ${!isLifestyle && productContext ? `\nCRITICAL PRODUCT KNOWLEDGE:\n${productContext}\nEnsure the caption accurately reflects how and where the product is used.` : ''}
      
      Post Details:
      Title: ${selectedDay.title}
      Format: ${selectedDay.format}
      Hook: ${selectedDay.hook}
      Summary: ${selectedDay.summary}
      
      CRITICAL INSTRUCTIONS FOR A HIGH-CONVERTING POST:
      1. LANGUAGE: Write the ENTIRE caption perfectly in the Myanmar (Burmese) language. Ensure natural phrasing and cultural relevance.
      2. FRAMEWORK EXECUTION: You MUST strictly follow the "${framework}" copywriting framework. Structure the flow of the post exactly according to this framework to maximize engagement and conversions.
      3. TARGET AUDIENCE & CONTENT STYLE: The post MUST perfectly embody the "${tone}" style and speak directly to the "${targetAudience}". Ensure the vocabulary, pain points, desires, and cultural references are highly relatable and specific to this exact demographic. Avoid generic messaging. Do not use Gen Z slang unless the target audience is Gen Z.
      4. SPACING & READABILITY: Make the content highly readable. Use clear paragraph breaks (double spacing) between each section of the framework. Do not write a giant wall of text.
      5. EMOJIS: Include relevant, eye-catching emojis naturally throughout the text to break up paragraphs and highlight key points. Make it visually appealing for social media.
      6. NO LABELS: DO NOT include framework labels or structural words like "Hook:", "Attention:", "Interest:", "Desire:", "Action:", "Body:", or "Caption:". The text must flow naturally and be ready to copy-paste directly to social media.
      7. HASHTAGS: Include relevant, high-performing hashtags at the very end.
      8. VISUAL DIRECTION: Provide detailed visual/video instructions for the creator (these instructions should also be in Myanmar language). This MUST be returned in the separate "visualDirection" field, NOT in the "content" field.
      
      Return the response in JSON format matching this schema:
      {
        "id": "var_new",
        "title": "Variation Title (e.g. POV Hook)",
        "platform": "Platform Name",
        "content": "The actual post content...",
        "visualDirection": "Detailed visual/video instructions for the creator...",
        "explanation": "Why this hook works psychologically (in Myanmar)",
        "flags": "Any slang shelf-life flags (optional)"
      }
      `;

      const response = await withRetry(() => callAI('gemini-flash-lite-latest', prompt, {
          systemInstruction: MYANMAR_STRATEGIST_PROMPT,
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING },
              title: { type: SchemaType.STRING },
              platform: { type: SchemaType.STRING },
              content: { type: SchemaType.STRING },
              visualDirection: { type: SchemaType.STRING },
              explanation: { type: SchemaType.STRING },
              flags: { type: SchemaType.STRING }
            },
            required: ["id", "title", "platform", "content", "visualDirection", "explanation"]
          }
        }, currentApiKey));

      let jsonStr = response.text || '{}';
      jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      
      // Find the first '{' or '[' to handle any leading text before JSON
      const firstBrace = jsonStr.indexOf('{');
      const firstBracket = jsonStr.indexOf('[');
      if (firstBrace !== -1 && firstBracket !== -1) {
        jsonStr = jsonStr.substring(Math.min(firstBrace, firstBracket));
      } else if (firstBrace !== -1) {
        jsonStr = jsonStr.substring(firstBrace);
      } else if (firstBracket !== -1) {
        jsonStr = jsonStr.substring(firstBracket);
      }
      
      // Find the last '}' or ']' to handle any trailing text after JSON
      const lastBrace = jsonStr.lastIndexOf('}');
      const lastBracket = jsonStr.lastIndexOf(']');
      if (lastBrace !== -1 && lastBracket !== -1) {
        jsonStr = jsonStr.substring(0, Math.max(lastBrace, lastBracket) + 1);
      } else if (lastBrace !== -1) {
        jsonStr = jsonStr.substring(0, lastBrace + 1);
      } else if (lastBracket !== -1) {
        jsonStr = jsonStr.substring(0, lastBracket + 1);
      }

      const data = JSON.parse(jsonStr);
      
      let variationData = data;
      if (Array.isArray(data) && data.length > 0) {
        variationData = data[0];
      } else if (data && data.variations && Array.isArray(data.variations) && data.variations.length > 0) {
        variationData = data.variations[0];
      } else if (data && typeof data === 'object') {
        // Fallback: look for any array in the object
        for (const key in data) {
          if (Array.isArray(data[key]) && data[key].length > 0 && data[key][0].content) {
            variationData = data[key][0];
            break;
          }
        }
      }

      if (variationData && variationData.content) {
        setPostVariations(prev => {
          const newVars = [...prev];
          newVars[index] = variationData;
          return newVars;
        });
        if (activeVariationIndex === index) {
          setPostHistory([variationData.content]);
          setHistoryIndex(0);
        }
      } else {
        console.error("Parsed data does not contain content:", data);
        throw new Error("Invalid response format");
      }
    } catch (error: any) {
      console.error('Error regenerating variation:', error);
      handleApiError(error, 'Failed to regenerate variation.');
    } finally {
      setIsGeneratingVariation(-1);
    }
  };

  const applyLogoOverlay = (base64Img: string, logoBase64: string, position: string, scale: number, opacity: number): Promise<string> => {
    return new Promise((resolve) => {
      const mainImg = new Image();
      mainImg.src = base64Img;
      mainImg.onload = () => {
        const logoImg = new Image();
        logoImg.src = logoBase64;
        logoImg.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = mainImg.width;
          canvas.height = mainImg.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(base64Img);
            return;
          }

          // Draw main image
          ctx.drawImage(mainImg, 0, 0);

          // Calculate logo size
          const logoWidth = canvas.width * scale;
          const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
          
          // Calculate position
          const margin = canvas.width * 0.03;
          let x = margin;
          let y = margin;

          if (position === 'top-right') {
            x = canvas.width - logoWidth - margin;
          } else if (position === 'bottom-left') {
            y = canvas.height - logoHeight - margin;
          } else if (position === 'bottom-right') {
            x = canvas.width - logoWidth - margin;
            y = canvas.height - logoHeight - margin;
          }

          // Draw logo with opacity
          ctx.globalAlpha = opacity;
          ctx.drawImage(logoImg, x, y, logoWidth, logoHeight);
          ctx.globalAlpha = 1.0;

          resolve(canvas.toDataURL('image/png'));
        };
        logoImg.onerror = () => resolve(base64Img);
      };
      mainImg.onerror = () => resolve(base64Img);
    });
  };

  const handleStopGeneration = () => {
    isAbortedRef.current = true;
    setIsGeneratingImage(false);
    setToastMessage('Generation stopped by user.');
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleGenerateHooks = async () => {
    if (!selectedDay) return;
    setIsGeneratingHooks(true);
    setGeneratedHooks([]);
    setSelectedHook('');

    try {
            
      let lengthInstruction = '';
      if (headlineLength === 'Short') lengthInstruction = 'Keep them very short (1-3 words).';
      else if (headlineLength === 'Medium') lengthInstruction = 'Make them medium length (4-7 words).';
      else if (headlineLength === 'Long') lengthInstruction = 'Make them longer and descriptive (8+ words).';
      else lengthInstruction = 'Use a natural, punchy length.';

      const prompt = `Generate 5 different viral hook text (headline) variations for an image with this concept:
      Concept: "${selectedDay.summary}"
      Product: "${productName}"
      
      ${lengthInstruction}
      
      CRITICAL INSTRUCTIONS:
      1. Provide EXACTLY 5 variations.
      2. The ENTIRE response MUST be written perfectly in the Myanmar (Burmese) language.
      3. TARGET AUDIENCE ALIGNMENT: You MUST strictly tailor all hooks to the specific Target Audience ("${targetAudience}"). Speak directly to their specific age group, pain points, desires, and lifestyle. Do not use generic messaging.
      4. Return a JSON array of strings.`;

      const response = await withRetry(() => callAI('gemini-flash-lite-latest', prompt, {
          systemInstruction: MYANMAR_STRATEGIST_PROMPT,
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING }
          }
        }, currentApiKey));

      let jsonStr = response.text || '[]';
      jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      
      // Find the first '{' or '[' to handle any leading text before JSON
      const firstBrace = jsonStr.indexOf('{');
      const firstBracket = jsonStr.indexOf('[');
      if (firstBrace !== -1 && firstBracket !== -1) {
        jsonStr = jsonStr.substring(Math.min(firstBrace, firstBracket));
      } else if (firstBrace !== -1) {
        jsonStr = jsonStr.substring(firstBrace);
      } else if (firstBracket !== -1) {
        jsonStr = jsonStr.substring(firstBracket);
      }
      
      // Find the last '}' or ']' to handle any trailing text after JSON
      const lastBrace = jsonStr.lastIndexOf('}');
      const lastBracket = jsonStr.lastIndexOf(']');
      if (lastBrace !== -1 && lastBracket !== -1) {
        jsonStr = jsonStr.substring(0, Math.max(lastBrace, lastBracket) + 1);
      } else if (lastBrace !== -1) {
        jsonStr = jsonStr.substring(0, lastBrace + 1);
      } else if (lastBracket !== -1) {
        jsonStr = jsonStr.substring(0, lastBracket + 1);
      }

      let result = JSON.parse(jsonStr);
      
      // Handle case where model returns an object with an array property
      if (!Array.isArray(result)) {
        if (result.hooks && Array.isArray(result.hooks)) result = result.hooks;
        else if (result.variations && Array.isArray(result.variations)) result = result.variations;
        else result = [result];
      }
      
      if (Array.isArray(result) && result.length > 0) {
        setGeneratedHooks(result);
        setSelectedHook(result[0]);
      }
    } catch (error: any) {
      console.error('Error generating hooks:', error);
      handleApiError(error, 'Failed to generate hook variations.');
    } finally {
      setIsGeneratingHooks(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!selectedDay) return;
    setIsGeneratingImage(true);
    setGenerationStep('Preparing request...');
    setGenerationProgress(0);
    isAbortedRef.current = false;

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    progressIntervalRef.current = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev >= 99) return 99;
        
        let increment = 0.1;
        if (selectedImageModel.includes('fast')) {
          increment = prev < 50 ? 0.8 : prev < 80 ? 0.4 : 0.2; // ~15s
        } else if (selectedImageModel.includes('flash')) {
          increment = prev < 50 ? 0.4 : prev < 80 ? 0.2 : 0.1; // ~30s
        } else {
          increment = prev < 50 ? 0.2 : prev < 80 ? 0.1 : 0.05; // ~60s
        }
        
        return Math.min(99, prev + increment);
      });
    }, 100);

    // Don't clear images immediately to avoid blank screen during long generation
    // setGeneratedImage(''); 
    // setFinalImageWithLogo('');

    try {
            const productContext = getProductContext(productName);
      
      const modelPrompt = includeModel 
        ? `Include an 8k hyper-realistic, breathtakingly beautiful and highly attractive Korean or Chinese model. The model MUST have very light, glowing skin color and 100% life-like realistic skin texture with visible pores. DO NOT make the model look like plastic, CGI, or artificial. The model should interact naturally with the product or concept.` 
        : `Do NOT include any people or models in the image. Focus entirely on the product, environment, and typography.`;

      const hookToUse = selectedHook || selectedDay.hook;

      const getPrompt = (pName: string) => {
        const productIdentity = productImages.length > 0 
          ? `CRITICAL REQUIREMENT: CLONE THE EXACT PRODUCT FROM THE PROVIDED REFERENCE IMAGE. Do NOT invent a product based on the name "${pName}". You MUST extract the product from the provided image and place it seamlessly into the new environment without changing its shape, branding, colors, or texture. The product name "${pName}" is ONLY for context, the visual appearance MUST come 100% from the uploaded image.`
          : `Product: "${pName}".`;

        if (imageStyle === 'Auto (AI Recommended)') {
          // === AI ART DIRECTOR v2: DEEP CONTENT-AWARE VISUAL ENGINE ===
          // Analyze the ACTUAL generated post content + all campaign context
          const contentGoal = campaignGoal || 'Drive engagement';
          const dayTheme = selectedDay?.summary || '';
          const dayTitle = selectedDay?.title || '';
          const dayFormat = selectedDay?.format || 'Single Image';
          const audienceProfile = targetAudience || 'Women aged 25-45';
          const contentTone = (() => {
            const t = tone || 'Elegant & Anti-Aging Focus';
            if (t !== 'Auto (AI Recommended)') return t;
            const ctx2 = `${targetAudience} ${campaignGoal} ${contentPillars} ${dayTheme} ${dayTitle} ${productBenefits}`.toLowerCase();
            if (/gen z|16-25|18-25|young|teen|tiktok/i.test(ctx2)) return 'Gen Z / Trendy & Viral';
            if (/mom|mother|မိခင်|busy|time.?saving/i.test(ctx2)) return 'Busy Mom / Time-Saving Beauty';
            if (/science|clinical|dermatolog|ingredient|research/i.test(ctx2)) return 'Scientific & Dermatologist-Approved';
            if (/luxury|spa|premium|elegant|exclusive/i.test(ctx2)) return 'Luxury Spa Experience';
            if (/natural|organic|clean|green|eco|botanical/i.test(ctx2)) return 'Natural & Organic (Clean Beauty)';
            if (/result|before.?after|transform|testimonial|sale/i.test(ctx2)) return 'Direct & Results-Driven';
            if (/glow|youthful|aspirat|radiant|bright/i.test(ctx2)) return 'Glowing & Youthful (Aspirational)';
            if (/30-50|35-50|anti.?aging|wrinkle|mature/i.test(ctx2)) return 'Elegant & Anti-Aging Focus (Age 30-50)';
            return 'Elegant & Anti-Aging Focus (Age 30-50)';
          })();
          const platformTarget = platform || 'Facebook';
          const pillars = contentPillars || 'Education, Lifestyle, Product Demo';
          const emotionalTarget = emotionalResponse || 'Confidence & Trust';
          const benefits = productBenefits || 'Enhances natural beauty';

          // === DEEP CONTENT EXTRACTION ===
          // Pull the actual generated post text for visual analysis
          const activePostContent = postVariations.length > 0 
            ? postVariations[activeVariationIndex]?.content || '' 
            : '';
          const fullContentContext = `${dayTitle} ${dayTheme} ${activePostContent}`.toLowerCase();

          // === INTELLIGENT TOPIC DETECTION ===
          // Scan content for specific subjects to build scene-accurate visuals
          const topicSignals = {
            skinBarrier: /skin barrier|barrier|ceramide|lipid|အရေပြား အတားအဆီး|barrier repair/i.test(fullContentContext),
            sunscreen: /spf|sunscreen|uv|sun protect|နေရောင်ခြည်|photoaging|sunburn/i.test(fullContentContext),
            acne: /acne|breakout|pimple|ဝက်ခြံ|cystic|blemish|comedone|sebum/i.test(fullContentContext),
            antiAging: /anti.?aging|wrinkle|fine lines|collagen|retinol|tretinoin|anti.?wrinkle|aging|အိုမင်း/i.test(fullContentContext),
            nutrition: /food|diet|eat|nutrition|vitamin|supplement|omega|zinc|collagen food|အစားအသောက်|သီးနှံ/i.test(fullContentContext),
            gutHealth: /gut|microbiome|probiotic|prebiotic|digestive|leaky gut|SIBO|stomach|အူလမ်း/i.test(fullContentContext),
            hormone: /hormone|period|menstrual|estrogen|cortisol|PCOS|thyroid|progesterone|ဟော်မုန်း|cycle/i.test(fullContentContext),
            stress: /stress|mental|sleep|cortisol|anxiety|mindful|self.?care|စိတ်ဖိစီး|အိပ်ရေး/i.test(fullContentContext),
            hairCare: /hair|scalp|hair loss|hair growth|ဆံပင်|dandruff|seborrheic/i.test(fullContentContext),
            bodyWellness: /lymph|massage|gua sha|body|exercise|yoga|stretch|workout|ခန္ဓာကိုယ်/i.test(fullContentContext),
            ingredients: /ingredient|niacinamide|vitamin c|hyaluronic|aha|bha|peptide|serum|active|bakuchiol|azelaic/i.test(fullContentContext),
            mythBust: /myth|fact|wrong|mistake|truth|lie|misconception|myth.*fact|အမှား|အမှန်/i.test(fullContentContext),
            howTo: /how to|step|routine|diy|tutorial|method|technique|နည်းလမ်း|ဘယ်လို/i.test(fullContentContext),
            hydration: /hydrat|water|moisture|dehydrat|dry skin|plump|electrolyte|ရေ|အစိုဓာတ်/i.test(fullContentContext),
            darkSpots: /dark spot|hyperpigmentat|brighten|melasma|pigment|အမည်းစက်|အသားဝမ်း/i.test(fullContentContext),
            sensitivity: /sensitive|irritat|redness|rosacea|eczema|dermatitis|aller|ယားယံ/i.test(fullContentContext),
            oilySkin: /oily|oil control|sebum|pore|shine|ဆီထွက်|acne prone/i.test(fullContentContext),
          };

          // Count how many signals fire to determine content complexity
          const activeSignals = Object.entries(topicSignals).filter(([, v]) => v).map(([k]) => k);
          const primaryTopic = activeSignals[0] || 'general';

          // === CONTENT-AWARE SCENE BUILDER ===
          let sceneDescription = '';
          let sceneProps = '';
          let sceneLighting = '';
          let sceneColor = '';
          let sceneAngle = '';
          let autoStyleName = '';

          if (topicSignals.nutrition || topicSignals.gutHealth) {
            autoStyleName = 'Wellness Kitchen';
            sceneDescription = 'a breathtaking, sun-drenched kitchen or dining scene that looks like it belongs in a premium food & wellness magazine. A beautiful marble or butcher-block kitchen island bathed in warm morning light. The scene feels alive with health and vitality';
            sceneProps = 'carefully arranged anti-inflammatory foods visible in the scene: fresh berries in a ceramic bowl, sliced avocado, colorful vegetables, a vibrant smoothie bowl, turmeric latte, fresh herbs (mint, basil), lemon slices, nuts and seeds, and pristine glass bottles. The product is placed naturally among these wellness items, as if it belongs in this healthy lifestyle';
            sceneLighting = 'warm, golden morning sunlight streaming through a large kitchen window. Volumetric light rays visible in the air, creating a magical, healthy glow. Slight lens flare. Shot on Canon R5 with 35mm f/1.4 — shallow depth of field with gorgeous background bokeh of the kitchen';
            sceneColor = 'fresh, vibrant, alive colors — deep green leafy vegetables, bright orange turmeric, red berries, warm honey gold light, clean white surfaces, natural wood tones. Color grading: slightly warm shadows, vivid but natural midtones, soft highlights';
            sceneAngle = 'eye-level or slightly above, creating an intimate "sitting at the kitchen counter" feeling. Foreground blur element (herb leaf or fruit) adds depth';
          } else if (topicSignals.hormone || topicSignals.stress) {
            autoStyleName = 'Calm Self-Care Sanctuary';
            sceneDescription = 'a serene, deeply calming self-care sanctuary that feels like a healing space. A luxurious bathroom or bedroom with soft, diffused lighting. Spa-level tranquility meets real-life comfort. The space feels like a warm hug — safe, nurturing, and deeply relaxing';
            sceneProps = 'calming elements arranged naturally: lavender sprigs, a steaming cup of chamomile tea in a handmade ceramic mug, soft candlelight from a beautiful candle, a cozy knit throw, a journal or gratitude book, dried eucalyptus, aromatic essential oil diffuser with visible mist, silk pillowcase. The product sits naturally on a marble tray or wooden bath caddy';
            sceneLighting = 'extremely soft, warm, and enveloping — like candlelight mixed with golden late-afternoon window light. Volumetric warm mist from a diffuser catches the light. Low-contrast, comforting shadows. Shot on Sony A7IV with 50mm f/1.2 — dreamy, painterly depth of field';
            sceneColor = 'soothing, muted palette — dusty lavender, warm cream, sage green, soft rose, candlelight gold, natural linen tones. Color grading: soft, slightly desaturated, warm blanket feel';
            sceneAngle = 'intimate, personal angle — slightly above, looking down at a bathroom vanity or bedside ritual. Creates a "this is MY peaceful moment" feeling';
          } else if (topicSignals.skinBarrier || topicSignals.sensitivity || topicSignals.hydration) {
            autoStyleName = 'Clean Science Beauty';
            sceneDescription = 'a clean, clinical-yet-beautiful setting that communicates scientific expertise and gentle care. Think a premium dermatology clinic meets a luxury spa. The environment feels trustworthy, precise, and deeply caring. Glass surfaces, water elements, and translucent materials create a sense of purity and transparency';
            sceneProps = 'science-meets-beauty props: crystal-clear water droplets on glass surfaces, a ceramic pipette dropper with visible serum, fresh aloe vera leaf cut open showing gel, cotton pads, a small mirror reflecting soft light, translucent gel textures, water beads, and the product as the hero centerpiece on a frosted glass surface';
            sceneLighting = 'bright, clean, and pure — soft studio lighting with a slight cool-blue undertone that communicates clinical trust. Subtle warm rim light adds dimension. Every surface gleams with clean light. Shot on Hasselblad X2D — medium format quality, incredible sharpness and detail on every water droplet and texture';
            sceneColor = 'clean, pure palette — crystal clear, soft ice blue, pearl white, frosted glass tones, subtle silver. A touch of the product\'s accent color for brand alignment. Color grading: clean, bright, slightly cool, ultra-refined';
            sceneAngle = 'slightly elevated product-hero angle (30 degrees from above). Creates authority and trust. Symmetrical with the product perfectly centered';
          } else if (topicSignals.acne || topicSignals.oilySkin || topicSignals.darkSpots) {
            autoStyleName = 'Transformation Glow';
            sceneDescription = 'a stunning "before and after" transformation concept visualized through lighting and composition. One half of the image is subtly dimmer or cloudier, transitioning to a radiant, glowing other half — symbolizing the skin transformation journey. The product sits at the center of this transformation, acting as the catalyst';
            sceneProps = 'the product on a reflective surface that catches and amplifies the transformation lighting. On the "glow" side: fresh rose petals, dewdrops, sparkling water, and radiant light effects. On the darker side: subtle mist or soft shadow. A close-up magnified skin texture element showing pores and healthy glowing skin adds scientific credibility';
            sceneLighting = 'dramatic split-lighting concept: cooler, flatter light on one side transitioning to warm, golden, glowing light on the other. Ring light reflection visible in nearby surfaces. Volumetric warm glow emanating from the product as if it radiates beauty. Shot on Canon R6 Mark III with 85mm f/1.4 — portrait-quality beauty lighting';
            sceneColor = 'transition palette — from muted greys and cool tones to warm golden glow, radiant peach, luminous pink, and healthy skin tones. Color grading: high contrast with radiant highlights and dramatic shadow-to-light transitions';
            sceneAngle = 'straight-on or slightly below eye level, making the product and transformation feel powerful and aspirational. Dynamic composition with the transformation split creating visual tension';
          } else if (topicSignals.ingredients || topicSignals.antiAging) {
            autoStyleName = 'Ingredient Spotlight';
            sceneDescription = 'a premium editorial product shot that visually communicates the power of the active ingredient. The product is the hero, surrounded by visual representations of its key ingredients in their raw, beautiful, natural form. This image should educate and mesmerize simultaneously — making the viewer understand what the product does just by looking at it';
            sceneProps = 'raw ingredient elements arranged beautifully: if vitamin C content → fresh citrus slices and juice droplets; if retinol → subtle golden molecular structures; if hyaluronic acid → crystal-clear water spheres and gel textures; if niacinamide → translucent serum drops catching light; if collagen → silk threads or bouncy gel textures; if general → fresh botanical ingredients like rosemary, chamomile flowers, honey drips, tea tree leaves. The product is positioned as the refined version of these raw ingredients';
            sceneLighting = 'editorial studio lighting — dramatic backlighting creating a luminous halo around the product and ingredients. Beautiful rim light on liquid textures. Key light from above creating sculpted shadows. Shot on Phase One IQ4 — ultimate resolution showing every droplet, every texture, every molecular detail';
            sceneColor = 'rich, ingredient-inspired palette — vibrant natural colors of the ingredients (citrus orange, botanical green, honey gold, berry purple) against a clean, neutral background (soft grey, white marble, matte black). Color grading: vivid but refined, editorial quality';
            sceneAngle = '45-degree hero product angle with ingredients cascading around it. Creates a dynamic, magazine-editorial composition. Shallow depth of field isolates the product while ingredients create a beautiful supportive frame';
          } else if (topicSignals.mythBust) {
            autoStyleName = 'Bold Truth Reveal';
            sceneDescription = 'a high-impact, visually striking composition designed to stop the scroll on Facebook. The image uses bold visual contrast to communicate "myth vs truth" — half the image has a subtle red/warning overlay or cross-hatching, while the other half glows with clean truth and clarity. The product stands on the "truth" side as the hero solution';
            sceneProps = 'visual myth-busting elements: a broken magnifying glass or shattered misconception symbol on one side, and clear, pure, validated elements on the truth side — clean glass, fresh ingredients, the product glowing with authority. Bold graphic design elements (circles, lines, contrast zones) create a magazine-worthy infographic feel';
            sceneLighting = 'split dramatic lighting — slightly harsh, cool light on the "myth" side creating tension, and warm, golden, trustworthy light on the "truth" side. High contrast between the zones. Shot with deliberate contrast for maximum Facebook scroll-stopping power';
            sceneColor = 'high-contrast dual palette: myth side = cooler, slightly desaturated, hint of red/warning. Truth side = warm gold, clean white, fresh green, radiant. The contrast makes the image impossible to scroll past';
            sceneAngle = 'straight-on graphic design composition optimized for Facebook feed visibility. Bold, clean, with large text-safe zones. The image reads clearly even at thumbnail size';
          } else if (topicSignals.howTo || topicSignals.bodyWellness) {
            autoStyleName = 'Step-by-Step Tutorial';
            sceneDescription = 'a bright, clean, beautifully organized tutorial-style composition that feels like a premium beauty creator\'s content. The product is shown in a real-life application context — being used, applied, or integrated into a routine. The scene communicates "follow along with me" energy';
            sceneProps = 'routine-related items arranged sequentially: numbered visual cues, clean cotton pads, a small mirror, the product positioned among complementary skincare items on a clean vanity or marble surface. Include hands-friendly elements: jade roller, gua sha stone, clean towel. Everything feels organized, intentional, and aspirational';
            sceneLighting = 'bright, cheerful, and clean — large window natural light creating even illumination with minimal shadows. The scene is well-lit and optimistic. Colors pop. Shot on iPhone 15 Pro Max aesthetic quality (relatable influencer content) combined with Canon R5 sharpness';
            sceneColor = 'fresh, bright, organized palette — clean white, soft pink, light wood, sage green accents, and pops of color from the product. Color grading: bright, slightly lifted shadows, clean and fresh like a beauty influencer\'s feed';
            sceneAngle = 'overhead flat-lay or slightly angled bird\'s-eye view showing the routine items in organized sequence. Clean negative space for step-number text overlays. The composition guides the eye through the routine';
          } else if (topicSignals.hairCare) {
            autoStyleName = 'Hair Vitality';
            sceneDescription = 'a stunning beauty shot focused on hair health and vitality. The product is shown in a context that communicates hair transformation — perhaps held near flowing, glossy hair, or placed on a vanity next to hair care tools. The scene radiates hair health, shine, and confidence';
            sceneProps = 'hair-care related lifestyle props: a beautiful wide-tooth comb, silk scrunchies, a silk pillowcase, fresh rosemary sprigs (known for hair growth), biotin-rich foods visible nearby, a luxurious hair towel wrap. The product is the hero among these hair-wellness items';
            sceneLighting = 'beauty lighting that emphasizes shine and texture — soft, wrapping light that would make hair gleam. Warm undertone with beautiful specular highlights. Slight backlight creating a luminous halo effect. Shot on Sony A7RV with 70-200mm f/2.8 for beautiful compression and bokeh';
            sceneColor = 'rich, glossy palette — deep chocolate browns, honey gold, warm amber, healthy pink scalp tones, natural wood. Color grading: warm, rich, glossy — emphasizing shine and health';
            sceneAngle = 'close-up beauty angle with the product prominently featured. Shallow depth of field with gorgeous hair-like texture elements in the background';
          } else {
            // DEFAULT: Premium Lifestyle Editorial
            autoStyleName = 'Premium Lifestyle Editorial';
            sceneDescription = 'a world-class lifestyle product photograph that feels like it was shot by a top advertising agency for a major beauty brand. The product is placed in an aspirational, real-life setting that the target audience dreams about. The scene tells a story — not just showing a product, but showing a LIFE. This image must make a Myanmar woman aged 18-35 stop scrolling and immediately save it';
            sceneProps = 'curated lifestyle props that build a complete scene: fresh flowers (peonies or roses), a steaming drink in a beautiful ceramic mug, luxury fabric textures (silk, linen, cashmere), botanical elements (eucalyptus, dried lavender), gold accessories, and complementary beauty items. Every prop tells a story of elegant, aspirational daily life. The product is the centerpiece that ties everything together';
            sceneLighting = 'cinematic golden hour light streaming through large windows. Volumetric rays, warm honey tones, soft shadows with beautiful gradients. Slight lens flare adds magic. Shot on Canon R5 with 35mm f/1.4 Sigma Art — shallow depth of field, creamy bokeh, magazine-quality sharpness on the product';
            sceneColor = 'warm, aspirational palette — honey gold, blush pink, cream, sage green, warm terracotta, dusty rose, natural linen. Color grading: warm shadows, creamy highlights, slightly warm overall. VSCO A6 or Lightroom "Golden" feel';
            sceneAngle = '45-degree natural lifestyle angle. The product feels naturally placed, not staged. Foreground blur element adds cinematic depth. Clean space for headline text overlay';
          }

          // Store the analysis for UI display
          const detectedTopics = activeSignals.slice(0, 3).join(', ') || 'General lifestyle';
          setAutoStyleAnalysis(`🎨 AI Style: ${autoStyleName} | Detected: ${detectedTopics} | Optimized for ${platformTarget} viral`);

          // Build the final content-aware section
          const contentDirective = activePostContent 
            ? `\n=== ACTUAL POST CONTENT ANALYSIS ===\nThe image MUST visually represent THIS specific post content:\n"${activePostContent.substring(0, 600)}"\n\nAnalyze the above post and ensure the image DIRECTLY relates to what the post discusses. The viewer should look at the image and immediately understand what the post is about. The image and text must feel like they were created as a single unit.\n`
            : '';

          return `YOU ARE A WORLD-CLASS COMMERCIAL PHOTOGRAPHER AND VISUAL STRATEGIST. You shoot for Vogue, Elle, Harper's Bazaar, and $500,000 beauty campaigns. Your images are INDISTINGUISHABLE from real photographs taken with a $10,000 camera setup.

ABSOLUTE PRIORITY #1: LIFE-LIKE PHOTOREALISM — This image MUST look like a REAL photograph taken by a professional photographer with real equipment in a real location. If even ONE element looks AI-generated, CGI, 3D-rendered, or digitally fake, the ENTIRE image is a COMPLETE FAILURE.

=== FACEBOOK VIRAL IMAGE FORMULA ===
1. SCROLL-STOPPING: High contrast, vibrant but refined colors, clear focal point visible even at 150x150 thumbnail size
2. EMOTIONALLY TRIGGERING: The image must make her FEEL something instantly — desire, curiosity, recognition, aspiration
3. SAVE-WORTHY: Enough visual information and beauty that she screenshots or saves it for later
4. SHARE-WORTHY: Appeals to the "I need to send this to my bestie" impulse
5. PROFESSIONAL YET RELATABLE: Looks like a $50,000 campaign shoot but feels like content from her favorite beauty influencer

=== CAMPAIGN INTELLIGENCE ===
Product: ${pName}
Product Benefits: ${benefits}
Target Audience: ${audienceProfile}
Campaign Goal: ${contentGoal}
Today's Content Topic: ${dayTitle}
Content Brief: ${dayTheme}
Content Format: ${dayFormat}
Content Tone/Style: ${contentTone}
Desired Emotional Response: ${emotionalTarget}
Platform: ${platformTarget}
Content Pillars: ${pillars}
${contentDirective}
=== AI ART DIRECTION (Content-Aware: "${autoStyleName}" | Primary Topic: "${primaryTopic}") ===

SCENE & ENVIRONMENT:
${sceneDescription}

PROPS & VISUAL ELEMENTS:
${sceneProps}

LIGHTING (CRITICAL FOR REALISM):
${sceneLighting}

COLOR PALETTE & GRADING:
${sceneColor}

CAMERA ANGLE & COMPOSITION:
${sceneAngle}

=== ⚠️ LIFE-LIKE PHOTOREALISM REQUIREMENTS — HIGHEST PRIORITY ⚠️ ===

🔴 RULE #1: THIS IS A REAL PHOTOGRAPH, NOT A RENDER
Generate this image AS IF it was captured by a Canon EOS R5 Mark II with a 35mm f/1.4L lens on a full-frame sensor. The image must contain ALL the optical characteristics of real photography:
- Natural depth of field with smooth, circular bokeh (not hexagonal or artificial)
- Subtle lens vignetting at corners (slightly darker edges)
- Natural chromatic aberration on high-contrast edges
- Realistic focus falloff — sharp subject, gradually softer background
- Slight natural sensor noise/grain visible at 100% zoom (ISO 200-800 characteristic)
- Real lens flare behavior when light hits the lens — not perfect geometric shapes

🔴 RULE #2: EVERY SURFACE MUST HAVE REAL-WORLD TEXTURE
Each material type must show its unique physical texture at macro detail:
- GLASS/BOTTLES: Real reflections showing the environment, visible fingerprint smudges, light refraction through liquid, caustic light patterns on surfaces below
- FABRIC (silk, linen, cotton): Visible individual thread weave, natural wrinkles and folds that follow gravity, fiber lint, slight color variation across the surface
- WOOD: Authentic grain patterns, knots, natural color variation, subtle scratches from use, different finishes (matte vs glossy)
- MARBLE/STONE: Natural veining patterns (not repeating), slight surface polish variations, authentic cold color temperature
- METAL (gold, silver, copper): Real specular highlights that match the light source direction, accurate reflection of surrounding objects, patina and micro-abrasions
- WATER/LIQUID: Accurate refraction, meniscus curves at glass edges, realistic surface tension on droplets, proper light caustics
- SKIN (if model present): Visible pores, natural subsurface scattering, realistic skin undertones, micro-peach fuzz, natural blemish variations — NEVER waxy or porcelain
- FOOD/PLANTS: Organic imperfections — bruise spots on fruit, wilted petal edges, natural leaf vein patterns, realistic moisture
- CERAMIC/POTTERY: Glaze thickness variation, slight handmade irregularities, authentic matte vs glossy reflections
- PAPER/CARDBOARD: Fiber texture visible, natural edge wear, realistic thickness and shadow casting

🔴 RULE #3: REAL LIGHTING PHYSICS (NON-NEGOTIABLE)
The lighting MUST obey real-world physics — this is what separates photographs from renders:
- Light falloff follows the inverse square law — brighter near the source, naturally dimming with distance
- Shadows have SOFT edges near the object and get softer/more diffuse the further from the object they fall
- Color temperature variation: warm near tungsten/candle sources, cooler in shadow areas where blue sky fill dominates
- Ambient occlusion: subtle darkening in crevices, where objects meet surfaces, inside folds
- Specular highlights are not perfect white circles — they follow the shape of the light source (window, softbox, ring light)
- Subsurface scattering on translucent materials (leaves, thin fabric, skin, wax) — light glows through them realistically
- Volumetric light effects (god rays through windows) contain visible dust particles and have natural density variation
- Reflected light bounces: colored surfaces cast subtle colored light on nearby white/neutral surfaces
- NO uniform lighting — real photographs always have natural light gradients and zones of varying brightness

🔴 RULE #4: ENVIRONMENTAL REALISM
The scene must feel like a REAL physical space that exists:
- Atmospheric perspective: very distant background elements are slightly hazier and cooler in tone
- Natural dust particles visible in strong light beams
- Realistic moisture/condensation on cold surfaces (glasses, bottles from fridge)
- Props show signs of real use — not factory-perfect, slightly lived-in
- Gravity applies: fabric drapes realistically, liquids pool naturally, steam rises correctly
- Scale consistency: all objects are proportionally correct relative to each other
- Background is a believable, coherent space — not a generic gradient or void

🔴 RULE #5: WHAT TO ABSOLUTELY AVOID (AI ARTIFACTS)
NEVER include these telltale signs of AI generation:
- ❌ Perfectly symmetrical faces or objects (real things are slightly asymmetric)
- ❌ Plastic, waxy, or porcelain skin texture
- ❌ Overly smooth surfaces with no texture variation
- ❌ Unrealistic, uniform lighting with no shadow variation
- ❌ Objects that float or defy gravity
- ❌ Text or letters that appear garbled or distorted (except the headline text)
- ❌ Hands or fingers with incorrect anatomy
- ❌ Backgrounds that blur into abstract patterns instead of real environments
- ❌ Over-saturated, candy-colored palettes that look digital
- ❌ Perfect geometric shapes in nature (circles, lines) — real objects have organic irregularities
- ❌ Missing or inconsistent reflections on reflective surfaces
- ❌ Product packaging that morphs, changes shape, or has illegible text

🔴 RULE #6: PHOTOGRAPHIC QUALITY BENCHMARK
The final image quality must match or exceed:
- Resolution: 8K (7680x4320 equivalent detail), ultra-sharp on the focal subject
- Dynamic range: Rich detail in both shadows and highlights, not blown out or crushed
- Color depth: Smooth gradients with no banding, natural color transitions
- Sharpness: Tack-sharp on the product/focal point, with natural lens softness in out-of-focus areas
- This image should be indistinguishable from work published in Vogue Beauty, Allure, or ELLE

=== TECHNICAL REQUIREMENTS ===
${productIdentity}

Headline/Hook Text to Overlay: "${hookToUse}"
Text Overlay Style: "${textOverlayStyle}"

${modelPrompt}

${productContext ? `CRITICAL PRODUCT RULES:\n${productContext}` : ''}

=== TYPOGRAPHY (CRITICAL) ===
- Include beautiful, high-quality typography in perfectly accurate Myanmar (Burmese) language
- The typography MUST follow the "${textOverlayStyle}" style EXACTLY
- Text must be spelled correctly and rendered with professional font quality
- Text placement must feel DESIGNED, not pasted on — integrated into the overall composition
- Leave clean, intentional negative space for the text
- The text should enhance the image, not compete with it
- For Facebook: text must be readable even at mobile feed sizes
- Suitable for ${platformTarget} marketing

CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'DGSA 1') {
          return `A professional, 8K Quality high-resolution photo of (a breathtakingly beautiful, highly attractive young Korean or Chinese Female) talent, expertly posed and holding ${pName}. The talent MUST have very light, glowing skin color and 100% life-like realistic skin texture with visible pores. DO NOT make the skin look like plastic or CGI. ${pName} is prominently featured in the foreground, sharp and in focus, with the talent subtly positioned to draw attention to it. The talent's confident expression complements the product's presence. The image is captured in a modern studio, luxurious interior, urban setting with soft, natural light, with a color palette cohesive with ${pName}'s branding. The composition is dynamic and clean, with the primary focus clearly on the product, supported by the talent's pose and gaze. Please do not change product photo. Do not change product's image and not too big in hand of lady. The lady have beautiful smile and teeth showing.\n\n${productIdentity}\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language related to the concept. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'DGSA 2') {
          return `A professional, 8K Quality high-resolution photo of (a breathtakingly handsome, highly attractive young Korean or Chinese Male) talent, expertly posed and holding ${pName}. The talent MUST have very light, glowing skin color and 100% life-like realistic skin texture with visible pores. DO NOT make the skin look like plastic or CGI. ${pName} is prominently featured in the foreground, sharp and in focus, with the talent subtly positioned to draw attention to it. The talent's confident expression complements the product's presence. The image is captured in a modern studio, luxurious interior, urban setting with soft, natural light, with a color palette cohesive with ${pName}'s branding. The composition is dynamic and clean, with the primary focus clearly on the product, supported by the talent's pose and gaze. Please do not change product photo. Do not change product's image and not too big in hand of man. The man have beautiful smile and teeth showing.\n\n${productIdentity}\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language related to the concept. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'DGSA 3') {
          return `A professional, 8K Quality high-resolution photo of (a breathtakingly beautiful, highly attractive young Korean or Chinese Female) talent, expertly posed and holding ${pName}. The talent MUST have very light, glowing skin color and 100% life-like realistic skin texture with visible pores. DO NOT make the skin look like plastic or CGI. ${pName} is prominently featured in the foreground, sharp and in focus, with the talent subtly positioned to draw attention to it. The talent's confident expression complements the product's presence. The image is captured in a modern studio, luxurious interior, urban setting with soft, natural light, with a color palette cohesive with ${pName}'s branding. The composition is dynamic and clean, with the primary focus clearly on the product, supported by the talent's pose and gaze. Please do not change product photo. Do not change product's image and not too big in hand of lady. Size 1:1.\n\n${productIdentity}\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language related to the concept. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'DGSA 4') {
          return `A professional, 8K Quality high-resolution photo of (a breathtakingly handsome, highly attractive young Korean or Chinese Male) talent, expertly posed and holding ${pName}. The talent MUST have very light, glowing skin color and 100% life-like realistic skin texture with visible pores. DO NOT make the skin look like plastic or CGI. ${pName} is prominently featured in the foreground, sharp and in focus, with the talent subtly positioned to draw attention to it. The talent's confident expression complements the product's presence. The image is captured in a modern studio, luxurious interior, urban setting with soft, natural light, with a color palette cohesive with ${pName}'s branding. The composition is dynamic and clean, with the primary focus clearly on the product, supported by the talent's pose and gaze. Please do not change product photo. Do not change product's image and not too big in hand of man. Size 1:1.\n\n${productIdentity}\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language related to the concept. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'DGSA 5') {
          return `A professional, 8K Quality high-resolution photo of (a breathtakingly beautiful young Korean or Chinese Female and a highly attractive young Korean or Chinese Male) talent, expertly posed and holding ${pName}. The talent MUST have very light, glowing skin color and 100% life-like realistic skin texture with visible pores. DO NOT make the skin look like plastic or CGI. ${pName} is prominently featured in the foreground, sharp and in focus, with the talent subtly positioned to draw attention to it. The talent's confident expression complements the product's presence. The image is captured in a modern studio, luxurious interior, urban setting with soft, natural light, with a color palette cohesive with ${pName}'s branding. The composition is dynamic and clean, with the primary focus clearly on the product, supported by the talent's pose and gaze. Please do not change product photo. Do not change product's image and not too big in hand of talent. The talent have beautiful smile and teeth showing.\n\n${productIdentity}\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language related to the concept. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'DGSA 6') {
          return `A professional, 8K Quality high-resolution photo of (a breathtakingly beautiful young Korean or Chinese Female and a highly attractive young Korean or Chinese Male) talent, expertly posed and holding ${pName}. The talent MUST have very light, glowing skin color and 100% life-like realistic skin texture with visible pores. DO NOT make the skin look like plastic or CGI. ${pName} is prominently featured in the foreground, sharp and in focus, with the talent subtly positioned to draw attention to it. The talent's confident expression complements the product's presence. The image is captured in a modern studio, luxurious interior, urban setting with soft, natural light, with a color palette cohesive with ${pName}'s branding. The composition is dynamic and clean, with the primary focus clearly on the product, supported by the talent's pose and gaze. Please do not change product photo. Do not change product's image and not too big in hand of talent. Size 1:1.\n\n${productIdentity}\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language related to the concept. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'Flat Lay Product Arrangement') {
          return `A stunning 8K overhead flat lay product photography shot. Top-down bird's-eye view composition on a premium marble, linen, or textured surface. ${pName} is the hero product placed perfectly center. Surround it with carefully curated lifestyle props: fresh flowers, gold accessories, silk fabric swatches, botanical elements, water droplets, and complementary beauty items arranged with intentional negative space. Soft, diffused natural window light creating gentle shadows. Color palette: muted pastels, cream, blush pink, sage green, and gold accents. The arrangement should feel like a luxury Instagram flat lay by a professional content creator. Ultra-sharp focus on every detail. Clean, aspirational, and highly shareable aesthetic.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Enhances natural beauty'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language related to the concept. Luxurious feel, suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'Neon Cyberpunk') {
          return `A jaw-dropping 8K cyberpunk-inspired product shot. ${pName} is showcased in a futuristic, neon-drenched environment. Vivid electric blue, hot pink, and purple neon light strips reflect off glossy surfaces and wet, rain-slicked textures. Holographic elements and subtle digital glitch effects frame the product. The product itself is lit with dramatic rim lighting and neon color spill, making it glow like a technological artifact. Dark background with deep blacks contrasted by intense, saturated neon highlights. Volumetric fog and light rays add cinematic depth. Futuristic UI elements, floating particles, and glass/chrome materials surround the product. The overall mood is edgy, high-tech, and ultra-modern — like a sci-fi movie poster meets luxury advertising.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Enhances natural beauty'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language related to the concept. The text should have a glowing neon effect that matches the scene. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'Luxury Magazine Editorial') {
          return `A breathtaking 8K luxury editorial product photograph worthy of Vogue, Harper's Bazaar, or Elle magazine. ${pName} is presented with the sophistication of a high-fashion editorial spread. The product sits on or near elegant surfaces — black velvet, white sculptural pedestals, or polished Italian marble. Dramatic, high-contrast studio lighting with sharp highlights and deep, rich shadows. The composition follows the rule of thirds with intentional asymmetry for visual tension. Background features muted neutral tones (charcoal, ivory, champagne gold) with subtle textural elements — draped silk, architectural elements, or abstract art. The lighting is reminiscent of Irving Penn or Mario Testino — sculpted, refined, and emotionally evocative. Every surface has realistic texture: fabric weave, stone grain, product material finish. This image must evoke exclusivity, wealth, and timeless elegance.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Enhances natural beauty'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language related to the concept. Typography should feel editorial and refined. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'Natural Lifestyle') {
          return `A warm, authentic 8K lifestyle product photograph in a natural setting. ${pName} is captured in a real-life moment — placed on a rustic wooden table by a sunlit window, held casually in soft hands, or nestled among organic elements like fresh eucalyptus, raw cotton, dried lavender, or morning coffee. Golden hour sunlight streams through sheer curtains, creating beautiful warm tones and soft lens flare. The scene feels lived-in, cozy, and aspirational — like a beautiful morning routine captured candidly. Color palette: warm honey, soft whites, natural wood tones, sage green, and subtle cream. Shallow depth of field with creamy bokeh in the background. The environment includes elements like linen bedsheets, ceramic mugs, indoor plants, or a peaceful bathroom vanity. The mood is calm, wholesome, and deeply relatable — making the viewer desire this lifestyle. 100% realistic with natural textures and imperfections.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Enhances natural beauty'}.\nDesired Emotional Response: ${emotionalResponse || 'Calm, authentic, and self-care'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language related to the concept. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'Dreamy Bokeh & Glow') {
          return `A mesmerizing 8K product shot with a magical, dreamy atmosphere. ${pName} is the sharp focal point surrounded by a sea of gorgeous, colorful bokeh light orbs (circular, hexagonal, and diamond-shaped) in soft pink, gold, lavender, and warm amber tones. The product appears to float or rest on a reflective, glass-like surface that mirrors the bokeh lights below. Subtle sparkle particles and soft light streaks surround the product like fairy dust. The background is a beautiful gradient blur transitioning from deep violet to warm rose gold. Soft front lighting illuminates the product with a gentle, flattering glow while rim lighting creates a luminous halo effect around its edges. The mood is romantic, magical, and premium — like a luxury perfume advertisement combined with a fairy tale aesthetic. Water droplets or dew on the product surface add extra realism and texture.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Enhances natural beauty'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language. Text should have a soft glow effect matching the dreamy scene. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'Morning Routine ☕') {
          return `A warm, authentic 8K lifestyle product photograph of a morning routine. ${pName} is placed organically on a clean, bright bathroom vanity or minimalist bedroom nightstand. Soft morning sunlight streams through a window, creating a fresh, energizing atmosphere. Nearby items include a steaming cup of coffee, a fluffy white towel, or a gentle mirror reflection. The mood is aspirational, peaceful, and ready to start the day. Ultra-realistic, relatable, but shot with high-end equipment.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Enhances natural beauty'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language related to the concept. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'Cozy Coffee Shop 🥐') {
          return `A chic aesthetic 8K lifestyle photography shot of ${pName} sitting on a wooden table in a high-end designer coffee shop. Natural soft window light filtering in. Surrounded by an artisanal latte with latte art, a buttery croissant on a ceramic plate, a stylish magazine or a sleek notebook. The environment is warm, trendy, and sophisticated. Selective focus with buttery depth of field. Makes the viewer feel like they are having an elegant afternoon coffee break.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Enhances natural beauty'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language related to the concept. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'Outdoor Active 🏃‍♀️') {
          return `A bright, dynamic 8K lifestyle photograph capturing health and vitality outdoors. ${pName} is held playfully or placed in focus with a beautifully lit, sunny park, hiking trail, or modern tennis court out of focus in the background. Elements of an active lifestyle like a sleek reusable water bottle, a rolled-up yoga mat, or fresh green leaves frame the shot. Energizing, vibrant, and incredibly crisp. Perfect for representing wellness and active living.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Enhances natural beauty'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language related to the concept. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'Luxury Spa Day 🛁') {
          return `An indulgent, highly relaxing 8K lifestyle shot of ${pName} set inside a world-class luxury spa. The product is next to a marble bathtub filled with warm soapy bubbles and rose petals. Fluffy robes, glowing candles, and bamboo tray accents complete the frame. Ambient, incredibly soft, and flattering mood lighting with subtle steam rising in the background. Evokes pure relaxation, self-care Sunday vibes, and absolute tranquility.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Enhances natural beauty'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language related to the concept. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'Aesthetic Shelfie ✨') {
          return `A gorgeous 8K 'shelfie' lifestyle photography shot. ${pName} is beautifully organized on a chic, minimalist floating shelf, flanked by other premium but unbranded aesthetic skincare bottles, small potted succulents, and delicate gold jewelry. The backdrop is a soft muted pastel or cream wall. Symmetrical, organized, deeply satisfying, and highly aspirational. Soft, diffused lighting highlights the product's premium packaging.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Enhances natural beauty'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language related to the concept. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'On-the-go City Life 🏙️') {
          return `An ultra-stylish, fast-paced 8K lifestyle shot of ${pName} held casually against a softly blurred, bustling cosmopolitan city street or modern cafe exterior. Shot over-the-shoulder or from a personal POV perspective. Elements of a busy but glamorous modern lifestyle: a designer handbag strap, sunglasses, or a sleek smartwatch barely visible. The lighting is golden-hour sunlight bouncing off glass skyscrapers. Chic, urban, trendy, and highly relatable to modern professionals.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Enhances natural beauty'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language related to the concept. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'Night Time Unwinding 🌙') {
          return `A serene, quiet 8K lifestyle portrait of a night-time unwinding routine. ${pName} is the star of a moody, low-lit environment illuminated by warm ambient string lights or a beautiful bedside lamp. The product rests on silk bedsheets, next to an open book and a calming cup of chamomile tea. The vibe is slow, restorative, deep relaxation, and luxurious evening skincare rituals. High contrast but extremely soft shadows.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Enhances natural beauty'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language related to the concept. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'Workspace Desk 💻') {
          return `A sharp, modern, highly productive 8K lifestyle shot of ${pName} seamlessly integrated into a chic, minimalist home office desk setup. Surrounded by an aluminum laptop (screen out of focus), a pair of designer blue-light glasses, a stylish planner, and a small potted plant. Clean lines, bright, airy lighting. Conveys a sense of boss-girl/boy energy, productivity, and success without compromising on wellness.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Enhances natural beauty'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language related to the concept. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'Weekend Picnic 🧺') {
          return `A delightful, sunny 8K lifestyle photograph of an aesthetic weekend picnic in a lush, green grassy park. ${pName} is beautifully placed on a classic gingham or linen picnic blanket alongside fresh strawberries, sliced sourdough bread, a sun hat, and wildflowers. Bright, cheerful natural sunlight, high saturation but soft pastel tones. Evokes freedom, joy, natural beauty, and carefree weekends.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Enhances natural beauty'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language related to the concept. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'Minimalist Bedroom 🛏️') {
          return `A flawlessly clean, calming 8K lifestyle shot set in an ultra-minimalist, wabi-sabi style bedroom. ${pName} is placed gracefully on unmade but perfectly styled luxury linen bedsheets or a raw wooden side table. Lots of negative space, neutral earthy tones (beige, taupe, off-white), and soft textural shadows playing across the walls. A masterpiece of 'less is more' lifestyle aesthetics.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Enhances natural beauty'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language related to the concept. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'Dior Haute Couture') {
          return `A breathtaking 8K luxury cosmetic product photograph inspired by the visual identity of Dior Beauty and haute couture advertising. ${pName} is presented as a sculptural art object, placed on a pristine white or soft blush-pink pedestal with architectural, geometric shapes — clean arches, fluted columns, or curved abstract forms in matte white plaster. The lighting is ultra-refined: soft, diffused key light from above with delicate shadow play that sculpts the product's form. A single fresh peony, rose, or lily blossom (Dior's signature flower) rests elegantly nearby. The entire scene is drenched in a monochromatic palette of ivory, pale rose, champagne, and whisper-soft grey. The textures are hyper-realistic: you can see the fine grain of plaster, the dewy petals, the glossy finish on the product. The composition is breathtakingly minimal yet profoundly luxurious — every element is intentional. The overall mood radiates French haute couture elegance, timeless femininity, and couture-level artistry. This is a Dior campaign visual.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Timeless beauty and radiance'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language. Typography must be thin, elegant serif — Didot or Bodoni style. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'Chanel Noir & Gold') {
          return `An iconic 8K luxury cosmetic product photograph channeling the signature Chanel Beauty aesthetic — the legendary contrast of noir black and opulent gold. ${pName} is the centerpiece, resting on a mirror-black lacquered surface that creates a perfect, sharply defined reflection beneath it. The background is deep, rich, velvety black — absolute darkness that makes the product seem to glow from within. Gold elements frame the scene: fine gold leaf scattered like confetti, a thin gold chain draped artfully nearby, or subtle gold dust particles floating in the air catching the light. The lighting is dramatic and precise — a single focused spotlight creates a brilliant highlight on the product while the rest falls into luxurious shadow. The contrast ratio is extreme: deep blacks meet brilliant golds and crisp product details. Subtle smoke or mist curls at the base, adding mystery. Every surface texture is hyper-detailed: the mirror's flawless reflection, the matte-vs-glossy product finish, the metallic shimmer of gold. The mood is unapologetically powerful, bold, and timeless — pure Chanel DNA.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Iconic luxury and confidence'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language. Typography should be bold, uppercase, high-contrast — white or gold on black. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'SK-II Crystal Clear') {
          return `A luminous 8K luxury cosmetic product photograph inspired by SK-II's signature crystal-clear, radiant skin aesthetic. ${pName} is showcased on a transparent crystal or glass pedestal that refracts light into beautiful rainbow prisms. The entire scene is built around the concept of pure transparency and clarity: crystal-clear water droplets, glass spheres, and prismatic light refractions surround the product. The background is a soft, luminous gradient from pure white to the palest translucent blue, evoking the purity of Pitera essence. Delicate water streams or a thin sheet of crystal-clear liquid flows around the product's base, frozen in motion. The product is lit with bright, clean, even lighting that emphasizes flawless surfaces — no harsh shadows, only soft, radiant illumination that makes everything glow with inner light. A subtle Asian luxury sensibility: clean, serene, scientific precision meets ethereal beauty. The mood is pure, scientific, and luminous — like liquid crystal transformed into luxury. This is SK-II campaign-level imagery.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Crystal clear, radiant skin'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language. Typography should be clean, modern sans-serif with a crystalline quality. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'La Mer Ocean Luxe') {
          return `An exquisite 8K luxury cosmetic product photograph inspired by La Mer's iconic oceanic luxury aesthetic. ${pName} emerges majestically from an environment of deep ocean blues, luminous aquamarine, and sea-foam white. The product sits on a surface of smooth, wet sea stones or a sculptural wave-shaped pedestal in deep teal or navy. Surrounding elements include: glistening sea pearls, polished abalone shells with iridescent mother-of-pearl surfaces, delicate coral branches, and frozen splashes of crystal-clear seawater caught mid-motion. The lighting is cool and ethereal — soft blue-toned key light with warmer accents that highlight the product's premium finish. Tiny bubbles and water beads cling to the product surface, adding tactile realism. The background transitions from deep midnight blue at the edges to a luminous aqua glow behind the product, as if light is filtering through deep ocean water. Bioluminescent sparkle particles float gently, creating a magical underwater atmosphere. The mood is serene, deeply luxurious, and healing — evoking La Mer's promise of miraculous ocean-born beauty.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Deep ocean-powered renewal'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language. Typography should be elegant and fluid, evoking oceanic movement. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'Estée Lauder Golden Hour') {
          return `A sumptuous 8K luxury cosmetic product photograph channeling the warm, radiant sophistication of Estée Lauder's signature golden-hour advertising aesthetic. ${pName} is bathed in rich, warm golden light as if photographed during the most beautiful sunset. The product sits on a brushed gold or warm bronze metallic surface with soft reflections. The background features an elegant out-of-focus gradient of warm amber, honey gold, and deep burgundy-brown tones — reminiscent of a luxurious penthouse suite at golden hour. Surrounding accents include: warm-toned dried roses, amber-colored glass bottles, a hint of cashmere fabric in champagne or camel tones, and subtle gold sparkle particles catching the light. The lighting is gloriously warm and directional — streaming from the side like late afternoon sunlight through floor-to-ceiling windows, creating long, elegant shadows and a warm glow that wraps around the product. The product's surface shows beautiful warm reflections and highlights. Every texture is photorealistic: the metallic surface sheen, fabric softness, floral delicacy. The mood is empowered feminine luxury — confident, warm, established, and timelessly beautiful. This is Estée Lauder at its finest.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Radiant, youthful beauty'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language. Typography should be warm gold, sophisticated serif style. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'Hermès Terracotta Garden') {
          return `An exquisite 8K luxury cosmetic product photograph inspired by Hermès' signature Mediterranean terracotta and botanical garden aesthetic. ${pName} is presented on a warm, sun-kissed terracotta clay surface with beautiful natural texture and subtle earth-tone variations. The scene evokes a private garden in the South of France: rustic terracotta pottery, fresh-cut stems of wild rosemary, lavender sprigs, dried citrus slices, and raw linen in natural ecru drape softly nearby. Warm Mediterranean sunlight streams through olive tree branches overhead, creating dappled shadow patterns across the surface. The color palette is rich and earthy: burnt sienna, terracotta orange, sage green, dried wheat gold, cream, and warm stone grey. A handcrafted ceramic plate with olive oil or honey adds organic luxury. The lighting is warm and golden with natural outdoor softness — shot on Hasselblad X2D, the image has extraordinary dynamic range showing every clay pore, every linen thread, every herb leaf vein. The mood is artisanal luxury, grounded sophistication, and effortless Mediterranean elegance — the kind of beauty that comes from nature itself.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Natural artisanal beauty'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language. Typography should be warm, earthy serif with natural elegance. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'Tom Ford Velvet Noir') {
          return `A dangerously seductive 8K luxury cosmetic product photograph channeling Tom Ford Beauty's iconic dark, sensual aesthetic. ${pName} commands attention on a surface of deep black velvet that absorbs light and creates an almost infinite darkness. The scene is pure midnight luxury: the product is dramatically side-lit with a single precise beam of warm amber light that sculpts its form against the darkness. Surrounding elements are minimal but impactful: a smoky quartz crystal, black orchid petals with a subtle wet sheen, a thin ribbon of liquid gold or dark honey flowing slowly across the velvet surface. The background is true black with occasional subtle smoke wisps catching the light. Every surface is hyper-textured: the velvet's pile visible at macro level, the product's finish rendered in exquisite detail — whether matte, glossy, or metallic. A faint warm highlight rim-lights the product from behind, separating it from the darkness. The mood is intoxicating, powerful, unapologetically sensual — evoking late-night luxury, black-tie events, and magnetic confidence. Shot on Phase One IQ4 with a 120mm f/2.8 for razor-sharp focus and buttery bokeh. This is Tom Ford's visual DNA at its purest.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Sensual, powerful allure'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language. Typography should be sleek, thin, uppercase sans-serif in warm gold or cool silver against the darkness. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'YSL Rouge Rebel') {
          return `A fearlessly bold 8K luxury cosmetic product photograph inspired by Yves Saint Laurent Beauty's rebellious, high-fashion rouge aesthetic. ${pName} is the hero on a glossy black lacquered surface with a dramatic splash of liquid red — rich, vivid YSL rouge — frozen mid-motion around the product like a couture paint explosion. The red is not blood-red but fashion-red: a perfect saturated crimson with depth and warmth. The background is clean high-contrast: stark white fading to charcoal black, creating a graphic, editorial tension. Gold accents punctuate the scene — a fine gold chain, gold leaf fragments, or liquid gold droplets catching the light amidst the red splash. The lighting is high-fashion editorial: strong directional key light creating defined shadows, with a beauty dish softbox creating clean highlights on the product surface. Every droplet of the red liquid is razor-sharp, showing realistic fluid dynamics, surface tension, and light refraction. The composition is dynamic, asymmetric, and confrontational — the product is positioned off-center with the red splash creating movement and energy across the frame. The mood is defiant, passionate, and impossibly chic — fashion-forward beauty that demands attention.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Bold, confident beauty'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language. Typography should be bold, uppercase, high-fashion — white or gold against the dramatic background. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'Sulwhasoo Heritage Gold') {
          return `A magnificently refined 8K luxury cosmetic product photograph inspired by Sulwhasoo's Korean heritage luxury aesthetic — where traditional apothecary artistry meets modern opulence. ${pName} is reverently presented on a traditional Korean mother-of-pearl inlaid lacquer tray (나전칠기) with its iridescent shell fragments catching the light. The scene is layered with Asian luxury elements: dried ginseng roots with their organic, twisted forms, a small celadon (청자) ceramic tea cup with warm golden-brown tea, dried jujube fruits, and fresh plum blossom branches with delicate pink-white flowers. The surface beneath is warm honeyed wood or dark walnut with visible aged grain. Subtle wisps of incense smoke or steam rise gracefully, catching soft warm light. The color palette is unmistakably heritage luxury: deep amber gold, warm mahogany brown, antique brass, jade green accents, and soft cherry blossom pink. The lighting combines warm tungsten tones with soft diffused natural light — creating a contemplative, almost ceremonial atmosphere. Every texture is rendered with museum-quality realism: the pearlescent shimmer on the lacquer, the roughness of dried ginseng, the translucency of celadon ceramic. The mood is timeless, wise, deeply rooted in centuries of beauty wisdom — Asian luxury at its most authentic and profound.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Heritage-powered radiance'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language. Typography should be refined, balanced serif with subtle gold accents — elegant Asian luxury feel. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        } else if (imageStyle === 'Charlotte Tilbury Pillow Talk') {
          return `A dreamily romantic 8K luxury cosmetic product photograph channeling Charlotte Tilbury's iconic Pillow Talk universe — the world's most flattering nude-pink beauty aesthetic. ${pName} is the star on a surface of crushed blush-pink velvet that catches light beautifully, creating soft, sensual folds and shadows. The entire scene is bathed in the warmest, most flattering rose-gold light — as if the world itself has been filtered through a Pillow Talk lens. Surrounding the product: soft pink rose petals (just-bloomed, slightly dewy), a vintage rose-gold hand mirror reflecting warm light, a silk ribbon in dusty rose, and fine pearl strands. The background is a dreamy soft-focus gradient of warm nude pink, champagne, and the palest mauve — luminous and glowing. Subtle light particles and shimmer float in the air like golden dust. The product itself glows with warm highlights, its surface rendered with photorealistic detail. The lighting is ultra-flattering beauty lighting: soft, wrapping, warm, with minimal shadows — the kind that makes everything look beautiful. A subtle star-filter effect on the brightest highlights adds a touch of magic. The mood is universally flattering, intimately glamorous, and irresistibly romantic — making every viewer feel like the most beautiful version of themselves. This is Charlotte Tilbury's visual magic.\n\n${productIdentity}\nProduct Benefits: ${productBenefits || 'Universally flattering beauty'}.\nHeadline/Hook Text to Overlay: "${hookToUse}".\nText Overlay Style: "${textOverlayStyle}".\n${modelPrompt}\n${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}` : ''}\nCRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language. Typography should be soft, feminine script or thin serif in warm rose gold or champagne tones. Suitable for ${platform} marketing. CRITICAL NEGATIVE PROMPT FOR LOGOS: DO NOT draw, generate, or include ANY brand logos, company names, or trademarks (such as "Nu Skin") on the image or product. You must generate the headline text, but ZERO logos.`;
        }

        return `A masterpiece commercial product photography shot. 8K resolution, hyper-realistic, life-like, ultra-detailed, high-end studio lighting.
      
      CRITICAL QUALITY RULE: The entire image, especially the product and any environment, MUST look 100% realistic and life-like. DO NOT use a "plastic", artificial, or cheap 3D render look. Use cinematic, natural lighting with realistic shadows, reflections, and textures.
      
      ${productIdentity}
      
      Product Benefits: ${productBenefits || 'Enhances natural beauty'}.
      Desired Emotional Response: ${emotionalResponse || 'Luxurious and confident'}.
      Concept: ${selectedDay.summary}. 
      Headline/Hook Text to Overlay: "${hookToUse}".
      Text Overlay Style: "${textOverlayStyle}".
      Style: ${imageStyle}.
      ${modelPrompt}
      ${productContext ? `\nCRITICAL PRODUCT RULES:\n${productContext}\nIf the model is interacting with the product, they MUST apply it ONLY to the 'Target Area' specified above. DO NOT show body products being applied to the face.` : ''}
      CRITICAL: Include high-quality typography and Text Overlay in perfectly accurate Myanmar (Burmese) language related to the concept. The typography MUST strictly follow the "${textOverlayStyle}" style. The Myanmar text MUST be spelled correctly and rendered flawlessly with high-fidelity text rendering. Ensure professional font integration and seamless blending of the text with the overall image design.
      Luxurious feel, suitable for ${platform} marketing.`;
      };

      let finalPromptText = getPrompt(productName);
      if (productImages.length > 0) {
        finalPromptText = "CORE INSTRUCTION: Use the provided image as the ABSOLUTE visual reference for the product. Recreate the product's EXACT appearance, size, and branding details perfectly in this new context. \n\n" + finalPromptText;
      }
      finalPromptText += `\n\nGeneration ID: ${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const generateWithModel = async (modelName: string, config: any, retries = 2, overridePrompt?: string) => {
        if (isAbortedRef.current) throw new Error('ABORTED');
        console.log(`Generating with ${modelName}...`);
        setGenerationStep(`Generating with ${modelName.split('-')[1].toUpperCase()}...`);

        return await withRetry(async () => {
          if (isAbortedRef.current) throw new Error('ABORTED');
          
          const refImages = productImages.map(img => {
            const match = img.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
            return match ? { mimeType: match[1], data: match[2] } : null;
          }).filter(Boolean);

          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (currentApiKey) headers['x-api-key'] = currentApiKey;

          const res = await fetch('/api/generate-image', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: modelName,
              prompt: overridePrompt || finalPromptText,
              referenceImages: refImages,
              config
            })
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Image generation failed' }));
            throw new Error(err.error || `HTTP ${res.status}`);
          }
          
          return res.json();
        }, retries);
      };

      let response;
      try {
        // Try Selected Model first
        const imageConfig: any = {
          aspectRatio: aspectRatio as any,
        };
        // gemini-2.5-flash-image only supports up to 1K
        if (selectedImageModel === 'gemini-2.5-flash-image') {
          // No imageSize param needed — defaults to 1K (max for this model)
        } else {
          // For Pro and Nano Banana 2, minimum is 1K
          const effectiveSize = imageSize === '512' ? '1K' : imageSize;
          imageConfig.imageSize = effectiveSize as any;
        }

        try {
          response = await generateWithModel(selectedImageModel, {
            responseModalities: ['Text', 'Image'],
            imageConfig: imageConfig,
          }, 2); // 2 retries with backoff to handle transient 503 spikes
        } catch (initialError: any) {
          if (initialError.message === 'ABORTED') throw initialError;
          throw initialError;
        }
      } catch (primaryError: any) {
        if (primaryError.message === 'ABORTED') return;
        
        const errorStr = JSON.stringify(primaryError).toLowerCase() + (primaryError.message || '').toLowerCase();
        
        // Check for refusal in the error message
        const isRefusal = errorStr.includes('refused') || 
                         errorStr.includes('unable to generate') ||
                         errorStr.includes('policy');

        // Check for high-demand / server overload errors
        const isHighDemand = errorStr.includes('high demand') || 
                            errorStr.includes('503') || 
                            errorStr.includes('unavailable') ||
                            errorStr.includes('429') ||
                            errorStr.includes('overloaded') ||
                            errorStr.includes('rate limit');

        if (isHighDemand) {
          // === AUTOMATIC FALLBACK TO ALTERNATIVE IMAGE MODELS ===
          const fallbackModels = [
            'gemini-2.5-flash-image',
            'imagen-4.0-fast-generate-001',
            'imagen-4.0-generate-001',
          ].filter(m => m !== selectedImageModel); // Don't retry the same model

          console.warn(`Primary model ${selectedImageModel} is overloaded (503). Trying fallback models...`);
          
          let fallbackSuccess = false;
          for (const fallbackModel of fallbackModels) {
            if (isAbortedRef.current) return;
            try {
              setGenerationStep(`${selectedImageModel.split('-').slice(0,3).join('-')} busy — trying ${fallbackModel.split('-').slice(0,3).join('-')}...`);
              console.log(`Fallback: trying ${fallbackModel}...`);
              
              const fallbackImageConfig: any = {
                aspectRatio: aspectRatio as any,
              };
              // Only add imageSize for models that support it (not flash variants)
              if (!fallbackModel.includes('flash')) {
                const effectiveSize = imageSize === '512' ? '1K' : imageSize;
                fallbackImageConfig.imageSize = effectiveSize as any;
              }

              response = await generateWithModel(fallbackModel, {
                responseModalities: fallbackModel.startsWith('imagen') ? ['Image'] : ['Text', 'Image'],
                imageConfig: fallbackImageConfig,
              }, 1);
              
              fallbackSuccess = true;
              console.log(`Fallback succeeded with ${fallbackModel}`);
              break;
            } catch (fallbackError: any) {
              console.warn(`Fallback ${fallbackModel} also failed:`, fallbackError.message);
              continue;
            }
          }
          
          if (!fallbackSuccess) {
            console.error('All fallback models also failed');
            throw primaryError;
          }
        } else if (isRefusal) {
          setGenerationStep('Handling refusal (genericizing prompt)...');
          console.warn('Model refused branded prompt, attempting genericized prompt...');
          const genericProductName = productName.toLowerCase().includes('nu skin') 
            ? 'high-tech premium beauty device' 
            : 'premium skincare product';
          
          const genericPrompt = getPrompt(genericProductName);
          
          try {
            const genericImageConfig: any = {
              aspectRatio: aspectRatio as any,
            };
            if (selectedImageModel === 'gemini-2.5-flash-image') {
              // No imageSize for flash
            } else {
              const effectiveSize = imageSize === '512' ? '1K' : imageSize;
              genericImageConfig.imageSize = effectiveSize as any;
            }

            response = await generateWithModel(selectedImageModel, {
              responseModalities: ['Text', 'Image'],
              imageConfig: genericImageConfig,
            }, 1, genericPrompt);
          } catch (e) {
            console.error('Genericized prompt also failed:', e);
            throw primaryError; // Throw original error if generic also fails
          }
        } else {
          console.error('Primary model failed after retries:', primaryError);
          throw primaryError;
        }
      }

      if (isAbortedRef.current) return;
      setGenerationStep('Processing image data...');

      if (!response) {
        throw new Error('All image generation models failed to respond.');
      }

      let base64Image = null;
      let textResponse = '';
      if (response.image?.data) {
        base64Image = `data:${response.image.mimeType || 'image/png'};base64,${response.image.data}`;
      } else if (response.text) {
        textResponse = response.text;
      } else if (response.candidates?.[0]?.content?.parts) {
        // Fallback for raw generateContent format just in case
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            base64Image = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            break;
          } else if (part.text) {
            textResponse += part.text;
          }
        }
      }

      if (!base64Image) {
        if (textResponse) {
          throw new Error(`Model refused to generate image: ${textResponse.substring(0, 100)}${textResponse.length > 100 ? '...' : ''}`);
        } else {
          throw new Error('No image generated by the model.');
        }
      }

      // Compress image to max 3MB for smooth loading and reasonable file size
      setGenerationStep('Optimizing image quality...');
      const compressedImage = await compressImage(base64Image);
      setGeneratedImage(compressedImage);
      
      // Apply logo overlay if provided
      if (logoImage) {
        const withLogo = await applyLogoOverlay(compressedImage, logoImage, logoPosition, logoScale, logoOpacity);
        setFinalImageWithLogo(withLogo);
      } else {
        setFinalImageWithLogo(compressedImage);
      }
    } catch (error: any) {
      if (error.message === 'ABORTED') return;
      console.error('Error generating image:', error);
      handleApiError(error, 'Failed to generate image.');
      // If it fails and we have no image at all, clear states
      if (!generatedImage) {
        setGeneratedImage('');
        setFinalImageWithLogo('');
      }
    } finally {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setGenerationProgress(100);
      if (!isAbortedRef.current) {
        setIsGeneratingImage(false);
      }
    }
  };

  const handleBackToPlan = () => {
    setSelectedDay(null);
    setPostVariations([]);
    setActiveVariationIndex(0);
    setGeneratedImage('');
    setIsImageGenView(false);
    setGenerationAttempt(0);
    setPostHistory([]);
    setHistoryIndex(-1);
  };



  // ---------------------------------------------------------------------------
  // IMAGE GENERATOR VIEW (NEW PAGE)
  // ---------------------------------------------------------------------------
  if (selectedDay && isImageGenView) {
    return (
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative min-h-screen bg-background transition-colors duration-300">
        <SakuraFalling />
        
        <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsImageGenView(false)}
              className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Back to Post Content"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="font-serif text-xl hidden sm:block">4K Design Studio</h2>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowApiKeyModal(true)}
              className="h-9 px-3.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground border border-border bg-card shadow-sm flex items-center gap-2 text-xs font-semibold"
              title="Configure Custom Gemini API Key"
            >
              <Key className="w-3.5 h-3.5 text-primary" />
              <span>{userApiKey ? 'Custom Key Active' : 'API Key'}</span>
            </button>
            <ThemeToggle />
          </div>
        </header>

        <div className="pt-20 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Settings */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-4 space-y-6"
          >
            <div className="glass border border-border rounded-3xl shadow-xl p-8 card-hover">
              <h2 className="font-serif text-2xl text-foreground mb-8 flex items-center gap-3">
                <Settings className="w-6 h-6 text-primary/60" /> Studio Controls
              </h2>
              
              <div className="space-y-8">
                {/* Hook Generation Section */}
                <div className="p-6 bg-card rounded-2xl border border-border/50">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Hook Text (Headline)</label>
                    <select
                      value={headlineLength}
                      onChange={(e) => setHeadlineLength(e.target.value)}
                      className="text-[10px] bg-background border border-border rounded-lg px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    >
                      <option value="Default">Default Length</option>
                      <option value="Short">Short (1-3 words)</option>
                      <option value="Medium">Medium (4-7 words)</option>
                      <option value="Long">Long (8+ words)</option>
                    </select>
                  </div>
                  
                  <div className="mb-4">
                    <textarea
                      value={selectedHook}
                      onChange={(e) => setSelectedHook(e.target.value)}
                      placeholder="Type your custom hook text here or select an AI-generated one below..."
                      className="w-full p-3 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                      rows={3}
                    />
                  </div>

                  {generatedHooks.length > 0 ? (
                    <div className="space-y-2 mb-4 max-h-48 overflow-y-auto pr-1">
                      {generatedHooks.map((hook, idx) => (
                        <button 
                          type="button"
                          key={idx}
                          onClick={() => setSelectedHook(hook)}
                          className={`w-full text-left p-3 text-xs rounded-xl border transition-all ${selectedHook === hook ? 'bg-primary/10 border-primary text-foreground shadow-sm' : 'bg-background/50 border-border/50 text-muted-foreground hover:border-border hover:bg-background'}`}
                        >
                          {hook}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground italic mb-4 px-1">
                      Generate hook variations to overlay on your image.
                    </div>
                  )}
                  
                  <button
                    type="button"
                    onClick={handleGenerateHooks}
                    disabled={isGeneratingHooks}
                    className="w-full py-3 px-4 bg-background border border-border rounded-xl text-xs font-semibold text-foreground hover:bg-muted transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm active:scale-[0.98]"
                  >
                    {isGeneratingHooks ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 text-primary" />}
                    {generatedHooks.length > 0 ? 'Regenerate Hooks' : 'Generate Hook Variations'}
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Content Style / Vibe</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="Auto (AI Recommended)">✨ Auto (AI Recommended)</option>
                    <option disabled>── Manual Styles ──</option>
                    <option value="Gen Z / Trendy & Viral">Gen Z / Trendy & Viral</option>
                    <option value="Elegant & Anti-Aging Focus (Age 30-50)">Elegant & Anti-Aging Focus (Age 30-50)</option>
                    <option value="Scientific & Dermatologist-Approved">Scientific & Dermatologist-Approved</option>
                    <option value="Busy Mom / Time-Saving Beauty">Busy Mom / Time-Saving Beauty</option>
                    <option value="Luxury Spa Experience">Luxury Spa Experience</option>
                    <option value="Natural & Organic (Clean Beauty)">Natural & Organic (Clean Beauty)</option>
                    <option value="Glowing & Youthful (Aspirational)">Glowing & Youthful (Aspirational)</option>
                    <option value="Direct & Results-Driven">Direct & Results-Driven</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Text Overlay Style</label>
                  <select 
                    value={textOverlayStyle} 
                    onChange={(e) => setTextOverlayStyle(e.target.value)} 
                    className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="Elegant & Bold (High-end, thick, sophisticated typography)">Elegant & Bold</option>
                    <option value="Cinematic Style (Dramatic, movie-poster, epic lighting)">Cinematic Style</option>
                    <option value="Modern Luxury Script (Fluid, elegant signature style for premium beauty)">Modern Luxury Script</option>
                    <option value="Premium Glass Skin (Ultra-thin luminous serif, minimalist, clean aesthetic)">Premium Glass Skin</option>
                    <option value="Clinical & Scientific Tech (Clean, precise, dermatologist-approved sans-serif for beauty devices)">Clinical & Scientific Tech</option>
                    <option value="Golden Hour Radiance (Warm metallic gold accents, upscale skincare branding)">Golden Hour Radiance</option>
                    <option value="Vogue Editorial Beauty (High-contrast, airy, Vogue-style minimalist typography)">Vogue Editorial Beauty</option>
                    <option disabled>── New Trending Styles ──</option>
                    <option value="Soft Pastel Aesthetic (Dreamy pastel gradient backgrounds, rounded soft sans-serif, airy feminine vibes)">Soft Pastel Aesthetic</option>
                    <option value="Neon Glow Pop (Electric neon outlines, glowing text effects, dark background, nightclub energy)">Neon Glow Pop</option>
                    <option value="Minimal Clean White (Ultra-clean white space, thin black sans-serif, Apple/Aesop inspired simplicity)">Minimal Clean White</option>
                    <option value="Retro Y2K Bubble (Inflated 3D bubble letters, chrome metallic finish, nostalgic early-2000s aesthetic)">Retro Y2K Bubble</option>
                    <option value="Handwritten Journal (Natural handwriting-style text, paper texture, authentic personal diary feel)">Handwritten Journal</option>
                    <option value="Bold Street Style (Chunky block letters, urban graffiti energy, high-contrast primary colors)">Bold Street Style</option>
                    <option value="Luxury Foil Stamp (Rose gold or silver foil embossed text, textured paper background, wedding-invite elegance)">Luxury Foil Stamp</option>
                    <option value="Gradient Mesh Modern (Vibrant gradient mesh backgrounds, bold geometric sans-serif, Instagram Reels cover style)">Gradient Mesh Modern</option>
                    <option value="Sticker & Cutout (Playful cut-out sticker text, colorful borders, Gen Z TikTok scrapbook aesthetic)">Sticker & Cutout</option>
                    <option value="Magazine Cover Layout (Bold masthead headline, subheadline hierarchy, barcode detail, Cosmopolitan/Elle cover format)">Magazine Cover Layout</option>
                    <option disabled>── Beauty Design Fonts ──</option>
                    <option value="Botanical Watercolor (Delicate hand-painted watercolor floral accents around thin elegant serif text, soft blooming petals, organic beauty branding)">Botanical Watercolor</option>
                    <option value="Rose Gold Elegance (Metallic rose gold gradient text on dark backgrounds, thin luxury serif with subtle shimmer, high-end cosmetic packaging feel)">Rose Gold Elegance</option>
                    <option value="Serum Drop Minimal (Ultra-clean single-weight sans-serif, liquid droplet accents, translucent glass effect letters, clinical skincare precision)">Serum Drop Minimal</option>
                    <option value="K-Beauty Glow (Soft rounded Korean-style typography, subtle dewy glow behind text, pastel gradient fill, youthful glass-skin energy)">K-Beauty Glow</option>
                    <option value="Marble & Mauve (Luxurious marble texture fill inside bold serif letters, mauve and dusty rose accent lines, premium spa branding aesthetic)">Marble & Mauve</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Aspect Ratio</label>
                    <select 
                      value={aspectRatio} 
                      onChange={(e) => setAspectRatio(e.target.value)} 
                      className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
                    >
                      <option value="1:1">1:1 Square</option>
                      <option value="9:16">9:16 Vertical</option>
                      <option value="16:9">16:9 Landscape</option>
                    </select>
                  </div>
                
                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Image Style</label>
                  <select 
                    value={imageStyle} 
                    onChange={(e) => { setImageStyle(e.target.value); if (e.target.value !== 'Auto (AI Recommended)') setAutoStyleAnalysis(''); }} 
                    className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="Auto (AI Recommended)">🧠 Auto (AI Art Director)</option>
                    <option disabled>── Basic Styles ──</option>
                    <option value="Photorealistic">Photorealistic</option>
                    <option value="Professional Graphic Design">Professional Graphic Design</option>
                    <option value="High-End Commercial Photography">High-End Commercial Photography</option>
                    <option value="Cinematic 3D Masterpiece">Cinematic 3D Masterpiece</option>
                    <option value="Flat Lay Product Arrangement">🌸 Flat Lay (Instagram Style)</option>
                    <option value="Neon Cyberpunk">⚡ Neon Cyberpunk (Futuristic)</option>
                    <option value="Luxury Magazine Editorial">👑 Luxury Magazine Editorial</option>
                    <option value="Natural Lifestyle">🌿 Natural Lifestyle (Organic)</option>
                    <option value="Dreamy Bokeh & Glow">✨ Dreamy Bokeh & Glow</option>
                    <option disabled>── Lifestyle Styles ──</option>
                    <option value="Morning Routine ☕">Morning Routine ☕ (Lifestyle)</option>
                    <option value="Cozy Coffee Shop 🥐">Cozy Coffee Shop 🥐 (Lifestyle)</option>
                    <option value="Outdoor Active 🏃‍♀️">Outdoor Active 🏃‍♀️ (Lifestyle)</option>
                    <option value="Luxury Spa Day 🛁">Luxury Spa Day 🛁 (Lifestyle)</option>
                    <option value="Aesthetic Shelfie ✨">Aesthetic Shelfie ✨ (Lifestyle)</option>
                    <option value="On-the-go City Life 🏙️">On-the-go City Life 🏙️ (Lifestyle)</option>
                    <option value="Night Time Unwinding 🌙">Night Time Unwinding 🌙 (Lifestyle)</option>
                    <option value="Workspace Desk 💻">Workspace Desk 💻 (Lifestyle)</option>
                    <option value="Weekend Picnic 🧺">Weekend Picnic 🧺 (Lifestyle)</option>
                    <option value="Minimalist Bedroom 🛏️">Minimalist Bedroom 🛏️ (Lifestyle)</option>
                    <option disabled>── Digital Studio Styles ──</option>
                    <option value="DGSA 1">DGSA 1 (Korean/Chinese Female, Smile)</option>
                    <option value="DGSA 2">DGSA 2 (Korean/Chinese Male, Smile)</option>
                    <option value="DGSA 3">DGSA 3 (Korean/Chinese Female, 1:1)</option>
                    <option value="DGSA 4">DGSA 4 (Korean/Chinese Male, 1:1)</option>
                    <option value="DGSA 5">DGSA 5 (Korean/Chinese Female & Male, Smile)</option>
                    <option value="DGSA 6">DGSA 6 (Korean/Chinese Female & Male, 1:1)</option>
                    <option disabled>── Luxury Brand Styles ──</option>
                    <option value="Dior Haute Couture">🤍 Dior Haute Couture (Sculptural Blush)</option>
                    <option value="Chanel Noir & Gold">🖤 Chanel Noir & Gold (Bold Contrast)</option>
                    <option value="SK-II Crystal Clear">💎 SK-II Crystal Clear (Radiant Purity)</option>
                    <option value="La Mer Ocean Luxe">🌊 La Mer Ocean Luxe (Oceanic Blue)</option>
                    <option value="Estée Lauder Golden Hour">✨ Estée Lauder Golden Hour (Warm Gold)</option>
                    <option value="Hermès Terracotta Garden">🧡 Hermès Terracotta Garden (Earthy Luxe)</option>
                    <option value="Tom Ford Velvet Noir">🖤 Tom Ford Velvet Noir (Dark Sensual)</option>
                    <option value="YSL Rouge Rebel">💄 YSL Rouge Rebel (Bold Red)</option>
                    <option value="Sulwhasoo Heritage Gold">🏮 Sulwhasoo Heritage Gold (Asian Luxe)</option>
                    <option value="Charlotte Tilbury Pillow Talk">💋 Charlotte Tilbury Pillow Talk (Nude Glam)</option>
                  </select>
                  {imageStyle === 'Auto (AI Recommended)' && (
                    <div className="mt-2 p-3 bg-gradient-to-r from-primary/5 via-purple-500/5 to-pink-500/5 border border-primary/20 rounded-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-primary">AI Art Director Mode</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        AI will analyze your content goal, target audience, product type, and campaign theme to auto-select the most professional, high-converting visual style.
                      </p>
                      {autoStyleAnalysis && (
                        <div className="mt-2 pt-2 border-t border-primary/10">
                          <p className="text-[10px] font-semibold text-foreground">{autoStyleAnalysis}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Quality</label>
                  <select 
                    value={imageSize} 
                    onChange={(e) => setImageSize(e.target.value)} 
                    className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="512">512px (Draft)</option>
                    <option value="1K">1K HD</option>
                    <option value="2K">2K QHD</option>
                    <option value="4K">4K UHD</option>
                  </select>
                </div>
              </div>

                <div className="pt-6 border-t border-border">
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground mb-4 ml-1">Logo Overlay (Optional)</label>
                  <div className="space-y-4">
                    {!logoImage ? (
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-2xl cursor-pointer hover:bg-muted/50 transition-all group">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <Upload className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <p className="text-xs font-medium text-muted-foreground">Upload PNG Logo</p>
                        </div>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => setLogoImage(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    ) : (
                      <div className="relative group p-4 bg-card rounded-2xl border border-border">
                        <div className="flex items-center gap-4">
                          <div className="relative h-16 w-16 bg-background rounded-xl shadow-sm p-2">
                            <NextImage 
                              src={logoImage} 
                              alt="Logo" 
                              fill 
                              className="object-contain p-2" 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-foreground">Logo Active</p>
                            <p className="text-[10px] text-muted-foreground">Will be overlaid on generation</p>
                          </div>
                          <button 
                            onClick={() => setLogoImage('')}
                            className="p-2 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white rounded-xl transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mt-6">
                          <div className="space-y-2">
                            <label className="block text-[9px] uppercase font-bold text-muted-foreground">Position</label>
                            <select 
                              value={logoPosition} 
                              onChange={(e) => setLogoPosition(e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="top-left">Top Left</option>
                              <option value="top-right">Top Right</option>
                              <option value="bottom-left">Bottom Left</option>
                              <option value="bottom-right">Bottom Right</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="block text-[9px] uppercase font-bold text-muted-foreground">Scale</label>
                            <input 
                              type="range" min="0.05" max="0.4" step="0.01" 
                              value={logoScale} 
                              onChange={(e) => setLogoScale(parseFloat(e.target.value))}
                              className="w-full accent-primary h-1.5 bg-muted rounded-full appearance-none cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div 
                  className={`p-5 rounded-2xl border transition-all duration-300 flex items-center justify-between group cursor-pointer ${
                    includeModel 
                      ? 'bg-gradient-to-br from-primary/10 to-transparent border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.1)]' 
                      : 'bg-card border-border hover:bg-muted/50'
                  }`}
                  onClick={() => setIncludeModel(!includeModel)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      includeModel ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted text-muted-foreground'
                    }`}>
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-foreground cursor-pointer block">
                        Include Human Model
                      </label>
                      <p className={`text-[10px] font-medium mt-0.5 transition-colors ${
                        includeModel ? 'text-primary/80' : 'text-muted-foreground'
                      }`}>
                        Adds a hyper-realistic, life-like 8K model to the scene.
                      </p>
                    </div>
                  </div>
                  <div className="relative inline-block w-14 h-7 transition duration-200 ease-in ml-4">
                    <input 
                      type="checkbox" 
                      name="toggle" 
                      id="includeModelToggle" 
                      checked={includeModel}
                      readOnly
                      className="sr-only peer"
                    />
                    <div className={`w-14 h-7 rounded-full flex items-center justify-between px-2 transition-colors duration-300 ${
                      includeModel ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}>
                      <span className={`text-[9px] font-bold ${includeModel ? 'text-primary-foreground opacity-100' : 'opacity-0'}`}>ON</span>
                      <span className={`text-[9px] font-bold ${!includeModel ? 'text-muted-foreground opacity-100' : 'opacity-0'}`}>OFF</span>
                    </div>
                    <div className={`absolute left-1 top-1 w-5 h-5 bg-white rounded-full transition-transform duration-300 shadow-sm ${
                      includeModel ? 'translate-x-7' : 'translate-x-0'
                    }`}></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">AI Engine</label>
                  <select 
                    value={selectedImageModel}
                    onChange={(e) => setSelectedImageModel(e.target.value)}
                    className="w-full px-4 py-3 bg-card border border-border rounded-2xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="gemini-3-pro-image-preview">🍌 Nano Banana Pro (Recommended Default)</option>
                    <option value="gemini-2.5-flash-image">🆓 Gemini Image Gen (Fast)</option>
                    <option value="imagen-4.0-fast-generate-001">💎 Imagen 4 Fast (Paid)</option>
                    <option value="imagen-4.0-generate-001">💎 Imagen 4 Standard HD (Paid)</option>
                    <option value="imagen-4.0-ultra-generate-001">💎 Imagen 4 Ultra (Paid, Best)</option>
                  </select>
                </div>

                <div className="pt-6 border-t border-border flex gap-3">
                  <button 
                    onClick={handleGenerateImage} 
                    disabled={isGeneratingImage} 
                    className="flex-1 btn-premium-chrome py-5 px-8 rounded-2xl flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl shadow-primary/20"
                  >
                    {isGeneratingImage ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                    <span className="text-lg font-bold">{isGeneratingImage ? 'Generating...' : 'Generate 4K Asset'}</span>
                  </button>
                  
                  {isGeneratingImage && (
                    <button 
                      onClick={handleStopGeneration}
                      className="bg-destructive/10 text-destructive hover:bg-destructive hover:text-white p-5 rounded-2xl shadow-sm transition-all flex items-center justify-center"
                      title="Stop Generation"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Result */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-8"
          >
            <div className="bg-white dark:bg-[#191919] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm p-8 min-h-[500px] flex flex-col items-center justify-center relative group">
              {isGeneratingImage && !finalImageWithLogo && (
                <div className="flex flex-col items-center gap-4 text-neutral-500 w-full max-w-md">
                  <Loader2 className="w-12 h-12 animate-spin" />
                  <p className="font-medium animate-pulse">{generationStep || 'Generating your visual asset...'}</p>
                  <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-2.5 mt-4 overflow-hidden">
                    <div 
                      className="bg-primary h-2.5 rounded-full transition-all duration-500 ease-out" 
                      style={{ width: `${Math.round(generationProgress)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-neutral-400 font-mono">{Math.round(generationProgress)}%</p>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-widest mt-2">
                    Estimated time: {selectedImageModel.includes('fast') ? '10-15s' : selectedImageModel.includes('flash') ? '25-40s' : '60-90s'}
                  </p>
                </div>
              )}
              
              {finalImageWithLogo && (
                <div className={`relative w-full rounded-xl overflow-hidden bg-neutral-50 dark:bg-neutral-900 ${aspectRatio === '9:16' ? 'max-w-md mx-auto aspect-[9/16]' : aspectRatio === '16:9' ? 'aspect-video' : 'max-w-xl mx-auto aspect-square'}`}>
                  <NextImage 
                    src={finalImageWithLogo} 
                    alt="Generated visual" 
                    fill 
                    className={`object-contain transition-opacity duration-500 ${isGeneratingImage ? 'opacity-40 grayscale-[0.5]' : 'opacity-100'}`} 
                    referrerPolicy="no-referrer"
                  />
                  
                  {isGeneratingImage && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-neutral-900/80 backdrop-blur-[2px] z-20 rounded-xl">
                      <div className="relative">
                        <Loader2 className="w-12 h-12 animate-spin text-white" />
                        <div className="absolute inset-0 animate-pulse bg-white/20 rounded-full blur-xl"></div>
                      </div>
                      <div className="text-center w-full max-w-[80%]">
                        <p className="text-white font-serif italic text-lg mb-1 drop-shadow-md">{generationStep || 'Creating your visual...'}</p>
                        <div className="w-full bg-white/20 rounded-full h-1.5 my-3 overflow-hidden">
                          <div 
                            className="bg-white h-1.5 rounded-full transition-all duration-500 ease-out" 
                            style={{ width: `${Math.round(generationProgress)}%` }}
                          ></div>
                        </div>
                        <p className="text-white/80 text-xs font-mono mb-2">{Math.round(generationProgress)}%</p>
                        <p className="text-white/60 text-[10px] uppercase tracking-widest">
                          Estimated time: {selectedImageModel.includes('fast') ? '10-15s' : selectedImageModel.includes('flash') ? '25-40s' : '60-90s'}
                        </p>
                      </div>
                      <button 
                        onClick={handleStopGeneration}
                        className="mt-4 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-[10px] uppercase tracking-widest transition-all border border-white/20"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {!isGeneratingImage && (
                    <div className="absolute inset-0 bg-neutral-900 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                      <a 
                        href={finalImageWithLogo} 
                        download={`day-${selectedDay.day}-${productName.replace(/\s+/g, '-').toLowerCase()}.png`} 
                        className="btn-premium-chrome px-8 py-4 rounded-full font-medium flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" /> Download Image
                      </a>
                    </div>
                  )}
                </div>
              )}
              
              {!isGeneratingImage && !finalImageWithLogo && (
                <div className="text-center text-neutral-800/40 dark:text-neutral-100/20">
                  <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Adjust settings and click Generate Image to see results here.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // DETAILED VIEW (NEW PAGE)
  // ---------------------------------------------------------------------------
  if (selectedDay) {
    return (
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative min-h-screen">
        <SakuraFalling />
        <div className="absolute top-4 right-4 sm:top-8 sm:right-8 z-10 flex items-center gap-3">
          <button 
            onClick={() => setShowApiKeyModal(true)}
            className="h-9 px-3.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground border border-border bg-card shadow-sm flex items-center gap-2 text-xs font-semibold"
            title="Configure Custom Gemini API Key"
          >
            <Key className="w-3.5 h-3.5 text-primary" />
            <span>{userApiKey ? 'Custom Key Active' : 'API Key'}</span>
          </button>
          <ThemeToggle />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button 
            onClick={handleBackToPlan}
            className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300 hover:text-neutral-800 dark:hover:text-neutral-100 transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Back to {isLifestyleMode ? 'Lifestyle' : `${daysCount}-Day`} Plan
          </button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Brief & Actions */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-4 space-y-6"
          >
            <div className="bg-white dark:bg-[#191919] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm p-8 ">
              <div className="flex items-center gap-3 mb-2">
                <div className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Day {selectedDay.day}</div>
                {isLifestyleMode && (
                  <span className="text-[9px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full bg-gradient-to-r from-violet-500/10 to-pink-500/10 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800">
                    ⚡ Lifestyle Post
                  </span>
                )}
              </div>
              <h1 className="font-serif text-3xl text-neutral-900 dark:text-neutral-100 mb-6">{selectedDay.title}</h1>
              
              <div className="space-y-4 mb-8">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-neutral-800/50 dark:text-neutral-100/40 mb-1">Format</div>
                  <div className="text-neutral-900 dark:text-neutral-100 font-medium">{selectedDay.format}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-neutral-800/50 dark:text-neutral-100/40 mb-1">Hook</div>
                  <div className="text-neutral-900 dark:text-neutral-100 italic">&quot;{selectedDay.hook}&quot;</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-neutral-800/50 dark:text-neutral-100/40 mb-1">Summary</div>
                  <div className="text-neutral-900/80 dark:text-neutral-100/80 text-sm leading-relaxed">{selectedDay.summary}</div>
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-neutral-200 dark:border-neutral-100/10">
                <button
                  onClick={handleGenerateFullPost}
                  disabled={isGeneratingFullPost}
                  className="relative overflow-hidden w-full btn-premium-chrome py-4 px-6 rounded-full flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGeneratingFullPost && (
                    <div className="absolute bottom-0 left-0 h-1 bg-white/20 dark:bg-black/20 w-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-white dark:bg-black w-1/3 rounded-full"
                        animate={{ x: ['-100%', '300%'] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                      />
                    </div>
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    {isGeneratingFullPost ? <Loader2 className="w-5 h-5 animate-spin" /> : postVariations.length > 0 ? <RefreshCw className="w-5 h-5" /> : <PenTool className="w-5 h-5" />}
                    {isGeneratingFullPost ? 'Generating...' : postVariations.length > 0 ? 'Regenerate All Variations' : 'Generate Full Post'}
                  </span>
                </button>
                
                <button
                  onClick={() => setIsImageGenView(true)}
                  disabled={postVariations.length === 0 || isGeneratingFullPost}
                  className="w-full btn-premium-silver py-4 px-6 rounded-full flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ImageIcon className="w-5 h-5" />
                  Proceed to Image Generation
                </button>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Generated Content */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-8 space-y-6"
          >
            {/* Content Result */}
            {(postVariations.length > 0 || isGeneratingFullPost) && (
              <div className="bg-white dark:bg-[#191919] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm p-8 min-h-[400px] ">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                  <h2 className="font-serif text-2xl text-neutral-900 dark:text-neutral-100 flex items-center gap-3">
                    <FileText className="w-5 h-5 text-neutral-400" /> Post Variations
                  </h2>
                  
                  {!isGeneratingFullPost && postVariations.length > 0 && (
                    <div className="flex gap-2">
                      {isEditingPost ? (
                        <>
                          <button
                            onClick={handleUndo}
                            disabled={historyIndex <= 0}
                            className="p-2 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900/20 rounded-full transition-colors disabled:opacity-30"
                            title="Undo"
                          >
                            <Undo className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleRedo}
                            disabled={historyIndex >= postHistory.length - 1}
                            className="p-2 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900/20 rounded-full transition-colors disabled:opacity-30"
                            title="Redo"
                          >
                            <Redo className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setIsEditingPost(false)}
                            className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-full transition-colors"
                            title="Done Editing"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setIsEditingPost(true)}
                            className="p-2 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900/20 rounded-full transition-colors"
                            title="Edit Post"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCopyPost()}
                            className="p-2 text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900/20 rounded-full transition-colors"
                            title="Copy Post"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {isGeneratingFullPost ? (
                  <div className="flex flex-col items-center justify-center text-neutral-300 dark:text-neutral-100/20 py-20">
                    <Loader2 className="w-10 h-10 animate-spin-slow mb-4" />
                    <p className="font-serif italic text-lg">Writing your masterpiece...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Tabs */}
                    <div className="flex flex-wrap gap-2 border-b border-neutral-200 dark:border-neutral-100/10 pb-4">
                      {postVariations.map((variation, idx) => (
                        <button
                          key={`${variation.id}-${idx}`}
                          onClick={() => {
                            setActiveVariationIndex(idx);
                            setIsEditingPost(false);
                            setPostHistory([variation.content]);
                            setHistoryIndex(0);
                          }}
                          className={`px-4 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-2 ${
                            activeVariationIndex === idx
                              ? 'btn-premium-chrome'
                              : 'bg-neutral-50 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                          }`}
                        >
                          {variation.title}
                          {isGeneratingVariation === idx && <Loader2 className="w-3 h-3 animate-spin" />}
                        </button>
                      ))}
                    </div>

                    {/* Active Variation Content */}
                    <div className="prose prose-stone dark:prose-invert max-w-none text-neutral-900/80 dark:text-neutral-100/80 font-sans leading-relaxed selection:bg-neutral-200 dark:selection:bg-neutral-900">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">
                            {postVariations[activeVariationIndex]?.platform}
                          </span>
                          {postVariations[activeVariationIndex]?.flags && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
                              {postVariations[activeVariationIndex]?.flags}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleRegenerateVariation(activeVariationIndex)}
                          disabled={isGeneratingVariation !== -1}
                          className="text-[10px] uppercase tracking-widest text-neutral-400 hover:text-neutral-600 transition-colors flex items-center gap-1"
                        >
                          <RefreshCw className={`w-3 h-3 ${isGeneratingVariation === activeVariationIndex ? 'animate-spin' : ''}`} />
                          Regenerate this variation
                        </button>
                      </div>

                      {isEditingPost ? (
                        <textarea
                          value={postVariations[activeVariationIndex]?.content || ''}
                          onChange={(e) => {
                            const newContent = e.target.value;
                            setPostVariations(prev => {
                              const newVars = [...prev];
                              newVars[activeVariationIndex] = { ...newVars[activeVariationIndex], content: newContent };
                              return newVars;
                            });
                          }}
                          className="w-full h-[300px] p-4 bg-transparent border border-neutral-200 dark:border-neutral-100/10 rounded-xl focus:outline-none focus:border-neutral-500 transition-all resize-y text-sm"
                        />
                      ) : (
                        <div className="space-y-6">
                          <div className="bg-neutral-50 dark:bg-neutral-900 p-4 rounded-xl border border-neutral-100 dark:border-neutral-100/5">
                            <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-2">Strategy Insight</div>
                            <p className="text-xs italic">{postVariations[activeVariationIndex]?.explanation}</p>
                          </div>
                          <Markdown>{postVariations[activeVariationIndex]?.content || ''}</Markdown>
                          
                          {postVariations[activeVariationIndex]?.visualDirection && (
                            <div className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-100/10">
                              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-3">
                                <Camera className="w-3 h-3" />
                                Visual Direction
                              </div>
                              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                                {postVariations[activeVariationIndex]?.visualDirection}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {postVariations.length === 0 && !isGeneratingFullPost && !generatedImage && !isGeneratingImage && (
               <div className="bg-white dark:bg-[#191919] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm p-8 h-full min-h-[400px] flex flex-col items-center justify-center text-neutral-300 dark:text-neutral-100/20 text-center">
                 <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                 <p className="font-serif italic text-xl max-w-sm">Generate the full post or visual asset to see it here.</p>
               </div>
            )}
          </motion.div>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // DASHBOARD VIEW (DYNAMIC PLAN)
  // ---------------------------------------------------------------------------
  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative min-h-screen bg-background transition-colors duration-300">
      <SakuraFalling />
      
      <div className="absolute top-4 right-4 sm:top-8 sm:right-8 z-10 flex items-center gap-3">
        <button 
          onClick={() => setShowApiKeyModal(true)}
          className="h-9 px-3.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground border border-border bg-card shadow-sm flex items-center gap-2 text-xs font-semibold"
          title="Configure Custom Gemini API Key"
        >
          <Key className="w-3.5 h-3.5 text-primary" />
          <span>{userApiKey ? 'Custom Key Active' : 'API Key'}</span>
        </button>
        <ThemeToggle />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-20 pt-10"
      >
        <h1 className="font-serif text-6xl md:text-8xl text-foreground mb-8 tracking-tighter leading-[0.85]">
          Princess&apos;s Viral <br className="hidden md:block" />
          <span className="italic font-light bg-clip-text text-transparent bg-gradient-to-r from-primary via-foreground to-primary bg-[length:200%_100%] animate-[shimmer_3s_infinite_linear]">Campaign Studio</span>
        </h1>
        <p className="text-muted-foreground text-xl max-w-2xl mx-auto font-light tracking-tight leading-relaxed">
          Configure your strategy. Generate a {daysCount}-day blueprint. <br className="hidden sm:block" />
          Expand each day into viral, high-fidelity Myanmar content.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-4 space-y-8"
        >
          {/* Saved Templates Gallery */}
          <div className="glass border border-border rounded-3xl shadow-2xl p-6 card-hover">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif text-lg text-foreground flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-primary/60" />
                My Templates
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={fetchTemplates}
                  disabled={isFetchingTemplates}
                  className="p-2 text-muted-foreground hover:bg-muted rounded-xl transition-all hover:text-foreground disabled:opacity-50"
                  title="Refresh Templates"
                >
                  {isFetchingTemplates ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingTemplateId(null); setTemplateNameInput(''); setShowSaveModal(true); }}
                  disabled={isSavingSettings}
                  className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5 text-xs font-semibold"
                  title="Save Current Settings as Template"
                >
                  <Plus className="w-3.5 h-3.5" /> Save
                </button>
              </div>
            </div>

            {savedTemplates.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                  <FolderOpen className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <p className="text-xs text-muted-foreground">No templates yet.</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">Click "+ Save" to create your first template.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                {savedTemplates.map((tmpl, idx) => (
                  <motion.div
                    key={tmpl.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="relative rounded-2xl border border-border/50 hover:border-primary/30 transition-all overflow-hidden"
                  >

                    {/* Top: Click to load */}
                    <div
                      className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-primary/[0.03] transition-colors"
                      onClick={() => handleLoadTemplate(tmpl)}
                    >
                      {/* 3D Icon or Image Thumbnail */}
                      {tmpl.product_image_urls && tmpl.product_image_urls.length > 0 ? (
                        <div className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 shadow-lg border border-border/30">
                          <NextImage
                            src={tmpl.product_image_urls[0]}
                            alt={tmpl.name}
                            fill
                            className="object-cover"
                            referrerPolicy="no-referrer"
                          />
                          {tmpl.product_image_urls.length > 1 && (
                            <div className="absolute bottom-0 right-0 bg-black/60 text-white text-[8px] font-bold px-1 rounded-tl-md">
                              +{tmpl.product_image_urls.length - 1}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${templateColors[idx % templateColors.length]} shadow-lg flex items-center justify-center flex-shrink-0`}
                          style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.15), inset 0 1px 2px rgba(255,255,255,0.2)' }}
                        >
                          <span className="text-white text-lg font-bold drop-shadow-sm">
                            {tmpl.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}

                      {/* Template Info */}
                      <div className="flex-1 min-w-0">
                        {renamingTemplateId === tmpl.id ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={renameInput}
                              onChange={(e) => setRenameInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameTemplate(tmpl); if (e.key === 'Escape') setRenamingTemplateId(null); }}
                              className="flex-1 px-2.5 py-1.5 text-xs bg-card border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30"
                              autoFocus
                            />
                            <button onClick={() => handleRenameTemplate(tmpl)} className="p-1.5 text-green-500 hover:bg-green-500/10 rounded-lg"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setRenamingTemplateId(null)} className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-foreground truncate">{tmpl.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {tmpl.product_name || 'No product'} · {tmpl.product_image_urls?.length || 0} images
                            </p>
                          </>
                        )}
                      </div>

                      {isLoadingSettings && <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />}
                    </div>

                    {/* Image thumbnails strip */}
                    {tmpl.product_image_urls && tmpl.product_image_urls.length > 0 && (
                      <div className="px-3.5 pb-2 flex gap-1.5 overflow-x-auto custom-scrollbar">
                        {tmpl.product_image_urls.slice(0, 5).map((imgUrl, imgIdx) => (
                          <button
                            key={imgIdx}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowImagePreview(imgUrl); }}
                            className="relative w-10 h-10 rounded-lg overflow-hidden border border-border/40 hover:border-primary/50 transition-all flex-shrink-0 group/img hover:scale-105"
                          >
                            <NextImage
                              src={imgUrl}
                              alt={`${tmpl.name} image ${imgIdx + 1}`}
                              fill
                              className="object-cover"
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-all flex items-center justify-center">
                              <Eye className="w-3 h-3 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-md" />
                            </div>
                          </button>
                        ))}
                        {tmpl.product_image_urls.length > 5 && (
                          <div className="w-10 h-10 rounded-lg bg-muted/50 border border-border/40 flex items-center justify-center flex-shrink-0">
                            <span className="text-[9px] font-bold text-muted-foreground">+{tmpl.product_image_urls.length - 5}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bottom: Action buttons row */}
                    <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-t border-border/30 bg-muted/20">
                      <button
                        onClick={() => handleLoadTemplate(tmpl)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-primary hover:bg-primary/10 rounded-lg transition-all"
                      >
                        <Upload className="w-3 h-3" /> Load
                      </button>
                      <button
                        onClick={() => openEditDataModal(tmpl)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                      >
                        <Database className="w-3 h-3" /> Edit Data
                      </button>
                      <button
                        onClick={() => handleEditTemplate(tmpl)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                      >
                        <Edit2 className="w-3 h-3" /> Update
                      </button>
                      <button
                        onClick={() => { setRenamingTemplateId(tmpl.id); setRenameInput(tmpl.name); }}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all"
                      >
                        <PenTool className="w-3 h-3" /> Rename
                      </button>
                      <div className="flex-1" />
                      <button
                        onClick={() => handleDeleteTemplate(tmpl)}
                        disabled={isDeletingTemplate === tmpl.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                      >
                        {isDeletingTemplate === tmpl.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Delete
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          <div className="glass border border-border rounded-3xl shadow-2xl p-8 card-hover">
            <div className="flex items-center justify-between mb-10">
              <h2 className="font-serif text-2xl text-foreground flex items-center gap-3">
                <Target className="w-6 h-6 text-primary/60" />
                Campaign Settings
              </h2>
            </div>
            
            <AnimatePresence>
              {toastMessage && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-6 p-3 bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 text-xs rounded-xl text-center border border-neutral-200 dark:border-neutral-800/50"
                >
                  {toastMessage}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleGeneratePlan} className="space-y-8">
              <div className="space-y-2">
                <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Product Name</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g., Glow Up Skincare Set"
                  className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/30"
                  required
                />
              </div>
              <div className="space-y-4">
                <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Product Images (Drag & Drop or Click to Upload)</label>
                <div 
                  className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 p-3 ${
                    isDraggingImage 
                      ? 'border-primary bg-primary/5 dark:bg-primary/10 scale-[1.01] shadow-lg shadow-primary/10' 
                      : 'border-border hover:border-muted-foreground/30'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingImage(true); }}
                  onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingImage(true); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDraggingImage(false); }}
                  onDrop={handleImageDrop}
                >
                  {/* Drag overlay */}
                  <AnimatePresence>
                    {isDraggingImage && (
                      <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 rounded-2xl bg-primary/10 dark:bg-primary/15 backdrop-blur-[2px] flex flex-col items-center justify-center pointer-events-none"
                      >
                        <motion.div 
                          animate={{ y: [0, -6, 0] }} 
                          transition={{ repeat: Infinity, duration: 1.2 }}
                        >
                          <Upload className="w-10 h-10 text-primary mb-2" />
                        </motion.div>
                        <p className="text-sm font-bold text-primary">Drop images here</p>
                        <p className="text-[10px] text-primary/60 mt-0.5">JPG, PNG, WEBP supported</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="grid grid-cols-4 gap-3">
                    {productImages.map((img, idx) => (
                      <div key={idx} className="relative aspect-square rounded-2xl border border-border overflow-hidden group shadow-sm">
                        <NextImage 
                          src={img} 
                          alt={`Product ${idx}`} 
                          fill 
                          className="object-cover transition-transform group-hover:scale-110" 
                          referrerPolicy="no-referrer"
                        />
                        <button type="button" onClick={() => removeImage(idx)} className="absolute inset-0 bg-destructive/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    ))}
                    <label className="cursor-pointer flex flex-col items-center justify-center aspect-square rounded-2xl border-2 border-dashed border-border hover:bg-muted/50 hover:border-primary/40 transition-all group">
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                      <Upload className="w-6 h-6 text-muted-foreground group-hover:text-primary group-hover:scale-110 transition-all" />
                      <span className="text-[8px] uppercase font-bold text-muted-foreground group-hover:text-primary mt-1 transition-colors">Add</span>
                    </label>
                  </div>
                  {productImages.length === 0 && !isDraggingImage && (
                    <p className="text-center text-[10px] text-muted-foreground/50 mt-2 pb-1">Drag & drop product images here, or click the + button</p>
                  )}
                </div>
              </div>
              <div className="pt-2 pb-6 flex flex-wrap gap-3 items-center justify-between">
                <button
                  type="button"
                  onClick={handleLetAIThink}
                  disabled={isLetAIThinking || !productName}
                  className="group relative flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest disabled:opacity-50 overflow-hidden shadow-xl bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white hover:shadow-purple-500/30 hover:scale-[1.02] transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                  {isLetAIThinking ? <Loader2 className="w-4 h-4 animate-spin relative z-10" /> : <Sparkles className="w-4 h-4 relative z-10" />}
                  <span className="relative z-10">🧠 Let AI Think (Auto-Pilot)</span>
                </button>
                <button
                  type="button"
                  onClick={handleGenerateAllOptions}
                  disabled={isGeneratingOptions || !productName}
                  className="group relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest btn-premium-silver disabled:opacity-50 overflow-hidden shadow-lg"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                  {isGeneratingOptions ? <Loader2 className="w-3.5 h-3.5 animate-spin relative z-10" /> : <Wand2 className="w-3.5 h-3.5 relative z-10" />}
                  <span className="relative z-10">Auto-Generate Options</span>
                </button>
              </div>

              {/* Loading overlay for Let AI Think */}
              <AnimatePresence>
                {isLetAIThinking && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }} 
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6 p-5 bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-indigo-500/10 dark:from-violet-500/5 dark:via-purple-500/5 dark:to-indigo-500/5 border border-purple-200 dark:border-purple-800/30 rounded-2xl text-center"
                  >
                    <motion.div animate={{ rotate: [0, 360] }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}>
                      <Sparkles className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                    </motion.div>
                    <p className="text-sm font-bold text-purple-700 dark:text-purple-300">AI is analyzing your product...</p>
                    <p className="text-[10px] text-purple-500/70 dark:text-purple-400/50 mt-1">Selecting the best strategy, audience, platform & more</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Product Benefits with regen */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Product Benefits</label>
                  <button 
                    type="button" 
                    onClick={() => handleRegenerateField('benefits')} 
                    disabled={isRegeneratingBenefits || !productName}
                    className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold text-muted-foreground/60 hover:text-primary transition-colors disabled:opacity-40"
                  >
                    {isRegeneratingBenefits ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Regen
                  </button>
                </div>
                <input
                  type="text"
                  value={productBenefits}
                  onChange={(e) => setProductBenefits(e.target.value)}
                  placeholder="e.g., အသားအရေကြည်လင်စေတယ်၊ အမဲစက်ပျောက်တယ်"
                  className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/30"
                />
                {generatedBenefitsOptions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {generatedBenefitsOptions.map((opt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setProductBenefits(opt)}
                        className={`text-[10px] font-bold px-4 py-2 rounded-xl border transition-all ${productBenefits === opt ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20' : 'border-border text-muted-foreground hover:bg-muted hover:border-muted-foreground/30'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Desired Emotional Response with regen */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Desired Emotional Response</label>
                  <button 
                    type="button" 
                    onClick={() => handleRegenerateField('emotions')} 
                    disabled={isRegeneratingEmotions || !productName}
                    className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold text-muted-foreground/60 hover:text-primary transition-colors disabled:opacity-40"
                  >
                    {isRegeneratingEmotions ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Regen
                  </button>
                </div>
                <input
                  type="text"
                  value={emotionalResponse}
                  onChange={(e) => setEmotionalResponse(e.target.value)}
                  placeholder="e.g., Confident, main character vibes"
                  className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/30"
                />
                {generatedEmotionalOptions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {generatedEmotionalOptions.map((opt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setEmotionalResponse(opt)}
                        className={`text-[10px] font-bold px-4 py-2 rounded-xl border transition-all ${emotionalResponse === opt ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20' : 'border-border text-muted-foreground hover:bg-muted hover:border-muted-foreground/30'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Target Audience with regen */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Target Audience</label>
                  <button 
                    type="button" 
                    onClick={() => handleRegenerateField('audiences')} 
                    disabled={isRegeneratingAudience || !productName}
                    className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold text-muted-foreground/60 hover:text-primary transition-colors disabled:opacity-40"
                  >
                    {isRegeneratingAudience ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Regen
                  </button>
                </div>
                <textarea
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g., Gen Z & Millennials in Yangon"
                  className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all h-24 resize-none placeholder:text-muted-foreground/30"
                  required
                />
                {generatedAudienceOptions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {generatedAudienceOptions.map((opt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setTargetAudience(opt)}
                        className={`text-[10px] font-bold px-4 py-2 rounded-xl border transition-all text-left ${targetAudience === opt ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20' : 'border-border text-muted-foreground hover:bg-muted hover:border-muted-foreground/30'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Campaign Goal</label>
                <select
                  value={campaignGoal}
                  onChange={(e) => setCampaignGoal(e.target.value)}
                  className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer text-sm"
                >
                  <option value="Increase brand awareness">Increase brand awareness</option>
                  <option value="Drive sales">Drive sales</option>
                  <option value="Boost engagement">Boost engagement</option>
                  <option value="Educate audience">Educate audience</option>
                  <option value="Build community">Build community</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Marketing Framework</label>
                <select
                  value={framework}
                  onChange={(e) => setFramework(e.target.value)}
                  className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer text-sm"
                >
                  <option value="AIDA (Attention, Interest, Desire, Action)">AIDA (Attention, Interest, Desire, Action)</option>
                  <option value="PAS (Problem, Agitate, Solution)">PAS (Problem, Agitate, Solution)</option>
                  <option value="StoryBrand (Character, Problem, Guide, Success)">StoryBrand (Character, Problem, Guide, Success)</option>
                  <option value="Hook, Story, Offer">Hook, Story, Offer</option>
                  <option value="FAB (Features, Advantages, Benefits)">FAB (Features, Advantages, Benefits)</option>
                  <option value="Educational & Debunking">Educational & Debunking</option>
                  <option value="Transformation (Before/After)">Transformation (Before/After)</option>
                  <option value="BAB (Before, After, Bridge)">BAB (Before, After, Bridge)</option>
                  <option value="4 C's (Clear, Concise, Compelling, Credible)">4 C&apos;s (Clear, Concise, Compelling, Credible)</option>
                  <option value="QUEST (Qualify, Understand, Educate, Stimulate, Transition)">QUEST (Qualify, Understand, Educate, Stimulate, Transition)</option>
                  <option value="PASTOR (Problem, Amplify, Story, Transformation, Offer, Response)">PASTOR (Problem, Amplify, Story, Transformation, Offer, Response)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Primary Platform</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer text-sm"
                >
                  <option value="Instagram / TikTok (Visual-first)">Instagram / TikTok (Visual-first)</option>
                  <option value="LinkedIn (Professional)">LinkedIn (Professional)</option>
                  <option value="Twitter / X (Short-form)">Twitter / X (Short-form)</option>
                  <option value="Facebook (Community-focused)">Facebook (Community-focused)</option>
                </select>
              </div>
              
              <div className="space-y-6 pt-8 border-t border-border">
                <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-primary/60 mb-2 ml-1">Advanced Strategy</h3>
                
                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Content Pillars</label>
                  <select
                    value={contentPillars}
                    onChange={(e) => setContentPillars(e.target.value)}
                    className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer text-sm"
                  >
                    <option value="Education, Lifestyle, Product Demo">Education, Lifestyle, Product Demo</option>
                    <option value="Inspiration, Behind-the-Scenes, User Generated Content (UGC)">Inspiration, Behind-the-Scenes, User Generated Content (UGC)</option>
                    <option value="Entertainment, Storytelling, Social Proof">Entertainment, Storytelling, Social Proof</option>
                    <option value="Tips & Tricks, Industry News, Community Spotlight">Tips & Tricks, Industry News, Community Spotlight</option>
                    <option value="Promotional, Educational, Entertaining (The 3 E's)">Promotional, Educational, Entertaining (The 3 E&apos;s)</option>
                    <option value="Relatable Struggle, Glow Up, Review">Relatable Struggle, Glow Up, Review</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Call-to-Action Style</label>
                  <select
                    value={ctaStyle}
                    onChange={(e) => setCtaStyle(e.target.value)}
                    className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer text-sm"
                  >
                    <option value="Engagement ရယူရန် (Save & Share လုပ်ပါ)">Engagement ရယူရန် (Save & Share လုပ်ပါ)</option>
                    <option value="ချက်ချင်းဝယ်ယူရန် (Link in Bio / အခုပဲဝယ်ယူပါ)">ချက်ချင်းဝယ်ယူရန် (Link in Bio / အခုပဲဝယ်ယူပါ)</option>
                    <option value="အပြန်အလှန်ဆွေးနွေးရန် (Comment ရေးပါ / Tag တွဲပါ)">အပြန်အလှန်ဆွေးနွေးရန် (Comment ရေးပါ / Tag တွဲပါ)</option>
                    <option value="သွယ်ဝိုက်ရောင်းချရန် (အသေးစိတ်သိရှိရန် / DM ပို့ပါ)">သွယ်ဝိုက်ရောင်းချရန် (အသေးစိတ်သိရှိရန် / DM ပို့ပါ)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2 space-y-2">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Campaign Duration (Days)</label>
                    <select
                      value={daysCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setDaysCount(val);
                        setReelsCount(0);
                        setCarouselCount(0);
                      }}
                      className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer text-sm"
                    >
                      <option value={7}>7 Days</option>
                      <option value={10}>10 Days</option>
                      <option value={14}>14 Days</option>
                      <option value={21}>21 Days</option>
                      <option value={30}>30 Days</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Reels Count</label>
                    <input
                      type="number"
                      min="0"
                      max={daysCount}
                      value={reelsCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setReelsCount(Math.min(daysCount - carouselCount, Math.max(0, val)));
                      }}
                      className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Carousel Count</label>
                    <input
                      type="number"
                      min="0"
                      max={daysCount}
                      value={carouselCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setCarouselCount(Math.min(daysCount - reelsCount, Math.max(0, val)));
                      }}
                      className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-10">
                <button
                  type="submit"
                  disabled={isGeneratingPlan || !productName || !targetAudience}
                  className="w-full btn-premium-chrome py-5 px-8 rounded-2xl flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl shadow-primary/20 group"
                >
                  {isGeneratingPlan ? <Loader2 className="w-6 h-6 animate-spin" /> : <Layout className="w-6 h-6 group-hover:rotate-12 transition-transform" />}
                  <span className="text-lg font-bold">{isGeneratingPlan ? 'Strategizing...' : `Generate ${daysCount}-Day Outline`}</span>
                </button>
              </div>
            </form>
          </div>

          <div className="glass border border-border rounded-3xl shadow-2xl p-6 hover:shadow-primary/5 transition-all mt-6">
            <h2 className="font-serif text-xl bg-gradient-to-br from-neutral-800 to-neutral-500 dark:from-neutral-100 dark:to-neutral-400 bg-clip-text text-transparent flex items-center gap-2 mb-6">
               <Zap className="w-5 h-5 text-primary" />
               Buffer Post Gen
            </h2>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Content Style</label>
                <select
                  value={standaloneEngagementStyle}
                  onChange={(e) => setStandaloneEngagementStyle(e.target.value)}
                  className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer text-sm font-semibold text-primary"
                >
                    <option value="Educational / Info-tainment (ဗဟုသုတပေးခြင်း + စိတ်ဝင်စားစရာ)">1. Educational / Info-tainment</option>
                    <option value="DIY Beauty Hacks (အလွယ်တကူ လိုက်လုပ်နိုင်သော နည်းလမ်းများ)">2. DIY Beauty Hacks</option>
                    <option value="Problem & Solution (ပြဿနာနှင့် ဖြေရှင်းနည်း)">3. Problem & Solution</option>
                    <option value="Myth vs. Fact (အယူအဆအမှားများကို ရှင်းလင်းချက်ပြခြင်း)">4. Myth vs. Fact</option>
                    <option value="Lifestyle / Routine (နေ့စဉ်ဘဝနှင့် ပေါင်းစပ်အသုံးပြုပုံ)">5. Lifestyle / Routine</option>
                    <option value="User Testimonials (အသုံးပြုသူများ၏ တကယ့်ရလဒ်များ)">6. User Testimonials</option>
                    <option value="Behind the Scenes (ထုတ်ကုန်ပြင်ဆင်မှု နောက်ကွယ်မှ အကြောင်းများ)">7. Behind the Scenes</option>
                    <option value="Trend Jacking (ခေတ်စားနေသော အကြောင်းအရာများနှင့် ချိတ်ဆက်ခြင်း)">8. Trend Jacking</option>
                    <option value="Q&A / FAQ (အမေးများသော မေးခွန်းများကို ဖြေကြားပေးခြင်း)">9. Q&A / FAQ</option>
                    <option value="Product Spotlight (ထုတ်ကုန်၏ သေချာဆွဲဆောင်မှုရှိသော အသေးစိတ်ပုံရိပ်များ)">10. Product Spotlight</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Blueprint Duration</label>
                <select
                  value={standaloneDaysCount}
                  onChange={(e) => setStandaloneDaysCount(parseInt(e.target.value))}
                  className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer text-sm font-semibold text-neutral-800 dark:text-neutral-200"
                >
                  <option value={7}>7 Days Plan</option>
                  <option value={10}>10 Days Plan</option>
                  <option value={15}>15 Days Plan</option>
                  <option value={30}>30 Days Plan</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleGenerateStandaloneLifestyle}
                disabled={isGeneratingStandaloneLifestyle}
                className="w-full btn-premium-silver py-4 px-6 rounded-2xl flex items-center justify-center gap-3 disabled:opacity-50 transition-all group"
              >
                {isGeneratingStandaloneLifestyle ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform text-neutral-600 dark:text-neutral-300" />}
                <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">{isGeneratingStandaloneLifestyle ? 'Generating...' : `Generate ${standaloneDaysCount}-Day Blueprint`}</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Results (Dynamic Day Grid) */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-8"
        >
          <div className="bg-white dark:bg-[#191919] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm p-8 min-h-[600px] h-full">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-serif text-2xl text-neutral-900 dark:text-neutral-100 flex items-center gap-3">
                <Calendar className="w-5 h-5 text-neutral-400" />
                {isLifestyleMode ? 'Lifestyle Blueprint' : 'Campaign Blueprint'}
              </h2>
              {planItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => isLifestyleMode ? handleGenerateStandaloneLifestyle() : handleGeneratePlan(undefined, true)}
                  disabled={isGeneratingPlan || isGeneratingStandaloneLifestyle}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium btn-premium-silver rounded-full disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${(isGeneratingPlan || isGeneratingStandaloneLifestyle) ? 'animate-spin' : ''}`} />
                  Regenerate {isLifestyleMode ? 'Lifestyle' : 'Plan'}
                </button>
              )}
            </div>
            
            {(isGeneratingPlan || isGeneratingStandaloneLifestyle) ? (
              <div className="h-full flex flex-col items-center justify-center text-neutral-300 dark:text-neutral-100/20 py-32">
                <Loader2 className="w-12 h-12 animate-spin-slow mb-6" />
                <p className="font-serif italic text-xl">{isLifestyleMode ? `Creating your ${standaloneDaysCount}-day lifestyle blueprint...` : `Architecting your ${daysCount}-day strategy...`}</p>
                <p className="text-sm mt-2 opacity-60">This may take a few moments.</p>
              </div>
            ) : planItems.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {planItems.map((item, idx) => (
                  <motion.div 
                    key={`${item.day}-${idx}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    onClick={() => setSelectedDay(item)}
                    className="bg-white dark:bg-[#191919] border border-neutral-200 dark:border-neutral-800 p-5 rounded-xl cursor-pointer hover:shadow-md hover:border-violet-300 dark:hover:border-violet-700 transition-all group relative overflow-hidden"
                  >
                    {/* Subtle gradient accent on hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-50/0 to-pink-50/0 group-hover:from-violet-50/30 group-hover:to-pink-50/20 dark:group-hover:from-violet-900/10 dark:group-hover:to-pink-900/10 transition-all duration-300 pointer-events-none" />
                    
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-3">
                        <div className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider bg-neutral-100 dark:bg-neutral-900 px-2 py-1 rounded-md">
                          Day {item.day}
                        </div>
                        <div className="text-[10px] text-neutral-800/50 dark:text-neutral-100/40 uppercase tracking-wider bg-neutral-50 dark:bg-neutral-800/50 px-2 py-1 rounded-md">
                          {item.format}
                        </div>
                      </div>
                      <h3 className="font-serif text-lg text-neutral-900 dark:text-neutral-100 mb-2 leading-tight group-hover:text-violet-700 dark:group-hover:text-violet-400 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-xs text-violet-700/80 dark:text-violet-400/70 mb-2 leading-relaxed font-medium italic">
                        &quot;{item.hook}&quot;
                      </p>
                      {item.summary && (
                        <div className="mt-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                          <p className="text-[11px] text-neutral-600/80 dark:text-neutral-400/70 line-clamp-3 leading-relaxed">
                            {item.summary}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center gap-1 mt-3 text-[10px] text-violet-500/60 dark:text-violet-400/40 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="w-3 h-3" />
                        <span>Click to view full details</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-neutral-200 dark:text-neutral-100/10 py-32 text-center">
                <Sparkles className="w-16 h-16 mb-6 opacity-20" />
                <p className="font-serif italic text-2xl max-w-sm">Configure your campaign settings to generate the blueprint.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

          {/* Gemini API Key Settings Modal */}
          <AnimatePresence>
            {showApiKeyModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={() => setShowApiKeyModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="glass border border-border rounded-3xl shadow-2xl p-8 w-full max-w-md mx-4"
                >
                  <h3 className="font-serif text-xl text-foreground mb-2 flex items-center gap-2">
                    <Key className="w-5 h-5 text-primary" />
                    Gemini API Settings
                  </h3>
                  <p className="text-xs text-muted-foreground mb-6">
                    Enter your custom Gemini API Key below to override the server key. Leave blank to use server defaults.
                  </p>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="AIzaSy... (or leave empty)"
                    className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all mb-6 text-sm"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveApiKey(); }}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowApiKeyModal(false)}
                      className="flex-1 py-3 px-4 bg-muted text-foreground rounded-2xl text-sm font-semibold hover:bg-muted/80 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveApiKey}
                      className="flex-1 py-3 px-4 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-2xl text-sm font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save Key
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Save Template Modal */}
          <AnimatePresence>
            {showSaveModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={() => { setShowSaveModal(false); setEditingTemplateId(null); }}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="glass border border-border rounded-3xl shadow-2xl p-8 w-full max-w-md mx-4"
                >
                  <h3 className="font-serif text-xl text-foreground mb-2 flex items-center gap-2">
                    <Save className="w-5 h-5 text-primary" />
                    {editingTemplateId ? 'Update Template' : 'Save as Template'}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-6">
                    {editingTemplateId ? 'Overwrite this template with current settings.' : 'Give your template a name to save it.'}
                  </p>
                  <input
                    type="text"
                    value={templateNameInput}
                    onChange={(e) => setTemplateNameInput(e.target.value)}
                    placeholder="e.g. Nu Skin Campaign, Skincare Promo..."
                    className="w-full px-4 py-3.5 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all mb-6"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveSettings(); }}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setShowSaveModal(false); setEditingTemplateId(null); }}
                      className="flex-1 py-3 px-4 bg-muted text-foreground rounded-2xl text-sm font-semibold hover:bg-muted/80 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveSettings()}
                      disabled={!templateNameInput.trim() || isSavingSettings}
                      className="flex-1 py-3 px-4 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-2xl text-sm font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {editingTemplateId ? 'Update' : 'Save'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Image Preview Modal */}
          <AnimatePresence>
            {showImagePreview && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md"
                onClick={() => setShowImagePreview(null)}
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="relative max-w-3xl max-h-[80vh] w-auto h-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <NextImage
                    src={showImagePreview}
                    alt="Preview"
                    width={800}
                    height={800}
                    className="rounded-2xl object-contain max-h-[80vh] w-auto shadow-2xl"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    onClick={() => setShowImagePreview(null)}
                    className="absolute -top-3 -right-3 p-2 bg-white dark:bg-neutral-800 rounded-full shadow-lg hover:scale-110 transition-transform"
                  >
                    <X className="w-5 h-5 text-foreground" />
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Edit Data Modal */}
          <AnimatePresence>
            {showEditDataModal && editDataTemplate && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8"
                onClick={() => { setShowEditDataModal(false); setEditDataTemplate(null); }}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  onClick={(e) => e.stopPropagation()}
                  className="glass border border-border rounded-3xl shadow-2xl p-8 w-full max-w-2xl mx-4 my-auto"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-serif text-xl text-foreground flex items-center gap-2">
                      <Database className="w-5 h-5 text-emerald-500" />
                      Edit Template Data
                    </h3>
                    <button
                      onClick={() => { setShowEditDataModal(false); setEditDataTemplate(null); }}
                      className="p-2 text-muted-foreground hover:bg-muted rounded-xl transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Template Name */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Template Name</label>
                      <input
                        type="text"
                        value={editFormData.name}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-4 py-3 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                      />
                    </div>

                    {/* Product Name */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Product Name</label>
                      <input
                        type="text"
                        value={editFormData.product_name}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, product_name: e.target.value }))}
                        className="w-full px-4 py-3 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                      />
                    </div>

                    {/* Product Images */}
                    <div className="space-y-3">
                      <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">
                        Product Images
                      </label>

                      {/* Existing images from Supabase */}
                      {editFormData.product_image_urls.length > 0 && (
                        <div>
                          <p className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground/60 mb-2 ml-1">Saved Images</p>
                          <div className="grid grid-cols-5 gap-2">
                            {editFormData.product_image_urls.map((url, idx) => (
                              <div key={`existing-${idx}`} className="relative aspect-square rounded-xl border border-border overflow-hidden group">
                                <NextImage
                                  src={url}
                                  alt={`Product ${idx + 1}`}
                                  fill
                                  className="object-cover"
                                  referrerPolicy="no-referrer"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeEditExistingImage(idx)}
                                  className="absolute inset-0 bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-5 h-5 text-white" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Newly added images (not yet uploaded) */}
                      {editFormData.newImages.length > 0 && (
                        <div>
                          <p className="text-[9px] uppercase tracking-wider font-semibold text-emerald-500/80 mb-2 ml-1">New Images (will be uploaded on save)</p>
                          <div className="grid grid-cols-5 gap-2">
                            {editFormData.newImages.map((img, idx) => (
                              <div key={`new-${idx}`} className="relative aspect-square rounded-xl border-2 border-emerald-500/30 overflow-hidden group">
                                <NextImage
                                  src={img}
                                  alt={`New ${idx + 1}`}
                                  fill
                                  className="object-cover"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute top-0.5 left-0.5 bg-emerald-500 text-white text-[7px] font-bold px-1 rounded-full">NEW</div>
                                <button
                                  type="button"
                                  onClick={() => removeEditNewImage(idx)}
                                  className="absolute inset-0 bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-5 h-5 text-white" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Add images button */}
                      <label className="cursor-pointer flex items-center gap-2 px-4 py-3 border-2 border-dashed border-border hover:border-primary/40 rounded-2xl hover:bg-muted/30 transition-all group">
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handleEditModalImageUpload} />
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                          <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">Add Product Images</p>
                          <p className="text-[10px] text-muted-foreground">JPG, PNG, WEBP supported</p>
                        </div>
                      </label>
                    </div>

                    {/* Product Benefits */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Product Benefits</label>
                      <input
                        type="text"
                        value={editFormData.product_benefits}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, product_benefits: e.target.value }))}
                        className="w-full px-4 py-3 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                      />
                    </div>

                    {/* Emotional Response */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Emotional Response</label>
                      <input
                        type="text"
                        value={editFormData.emotional_response}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, emotional_response: e.target.value }))}
                        className="w-full px-4 py-3 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                      />
                    </div>

                    {/* Target Audience */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Target Audience</label>
                      <textarea
                        value={editFormData.target_audience}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, target_audience: e.target.value }))}
                        className="w-full px-4 py-3 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm h-20 resize-none"
                      />
                    </div>

                    {/* Campaign Goal */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Campaign Goal</label>
                      <select
                        value={editFormData.campaign_goal}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, campaign_goal: e.target.value }))}
                        className="w-full px-4 py-3 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer text-sm"
                      >
                        <option value="Increase brand awareness">Increase brand awareness</option>
                        <option value="Drive sales">Drive sales</option>
                        <option value="Boost engagement">Boost engagement</option>
                        <option value="Educate audience">Educate audience</option>
                        <option value="Build community">Build community</option>
                      </select>
                    </div>

                    {/* Framework */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Marketing Framework</label>
                      <select
                        value={editFormData.framework}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, framework: e.target.value }))}
                        className="w-full px-4 py-3 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer text-sm"
                      >
                        <option value="AIDA (Attention, Interest, Desire, Action)">AIDA</option>
                        <option value="PAS (Problem, Agitate, Solution)">PAS</option>
                        <option value="StoryBrand (Character, Problem, Guide, Success)">StoryBrand</option>
                        <option value="Hook, Story, Offer">Hook, Story, Offer</option>
                        <option value="FAB (Features, Advantages, Benefits)">FAB</option>
                        <option value="Educational & Debunking">Educational & Debunking</option>
                        <option value="Transformation (Before/After)">Transformation (Before/After)</option>
                        <option value="BAB (Before, After, Bridge)">BAB</option>
                        <option value="4 C's (Clear, Concise, Compelling, Credible)">4 C&apos;s</option>
                        <option value="QUEST (Qualify, Understand, Educate, Stimulate, Transition)">QUEST</option>
                        <option value="PASTOR (Problem, Amplify, Story, Transformation, Offer, Response)">PASTOR</option>
                      </select>
                    </div>

                    {/* Platform */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Platform</label>
                      <select
                        value={editFormData.platform}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, platform: e.target.value }))}
                        className="w-full px-4 py-3 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer text-sm"
                      >
                        <option value="Instagram / TikTok (Visual-first)">Instagram / TikTok</option>
                        <option value="LinkedIn (Professional)">LinkedIn</option>
                        <option value="Twitter / X (Short-form)">Twitter / X</option>
                        <option value="Facebook (Community-focused)">Facebook</option>
                      </select>
                    </div>


                    {/* Days / Reels / Carousel counts */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Days</label>
                        <select
                          value={editFormData.days_count}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, days_count: parseInt(e.target.value), reels_count: 0, carousel_count: 0 }))}
                          className="w-full px-3 py-3 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                        >
                          <option value={7}>7</option>
                          <option value={10}>10</option>
                          <option value={14}>14</option>
                          <option value={21}>21</option>
                          <option value={30}>30</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Reels</label>
                        <input
                          type="number"
                          min="0"
                          max={editFormData.days_count}
                          value={editFormData.reels_count}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, reels_count: Math.min(prev.days_count - prev.carousel_count, Math.max(0, parseInt(e.target.value) || 0)) }))}
                          className="w-full px-3 py-3 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ml-1">Carousel</label>
                        <input
                          type="number"
                          min="0"
                          max={editFormData.days_count}
                          value={editFormData.carousel_count}
                          onChange={(e) => setEditFormData(prev => ({ ...prev, carousel_count: Math.min(prev.days_count - prev.reels_count, Math.max(0, parseInt(e.target.value) || 0)) }))}
                          className="w-full px-3 py-3 bg-card border border-border rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer with save/cancel */}
                  <div className="flex gap-3 pt-6 mt-4 border-t border-border">
                    <button
                      onClick={() => { setShowEditDataModal(false); setEditDataTemplate(null); }}
                      className="flex-1 py-3 px-4 bg-muted text-foreground rounded-2xl text-sm font-semibold hover:bg-muted/80 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEditData}
                      disabled={!editFormData.name.trim() || isSavingEditData}
                      className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-2xl text-sm font-semibold hover:shadow-lg hover:shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSavingEditData ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Changes
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>


    </main>
  );
}






