import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get environment variables
// Use type assertion for import.meta.env since TypeScript might not know about Vite's env types by default
const supabaseUrl = "https://ynpwsfflqqgjktctucrn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlucHdzZmZscXFnamt0Y3R1Y3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MTU2OTQsImV4cCI6MjEwNTE5MTY5NH0.pbTrAeUb7jR4ygu9Va5kVOyb6sMkGnZ9qyoKYH8QC-k";

console.log("Supabase initialization check:");
console.log("- URL exists:", !!supabaseUrl);
console.log("- Key exists:", !!supabaseAnonKey);

// Create Supabase client
// We check if the environment variables are available to prevent errors during initial setup
let supabaseClient: SupabaseClient | null = null;

try {
  if (supabaseUrl && supabaseAnonKey) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
} catch (error) {
  console.error("Failed to initialize Supabase client:", error);
}

export const supabase = supabaseClient;
