import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://joguflygbdmxbyikwlva.supabase.co';
// Provide a fallback JWT token structure so createClient doesn't throw 'supabaseKey is required' if env var is missing
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvZ3VmbHlnamRteGJ5aWt3bHZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.dummy_fallback_key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

