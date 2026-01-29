// public/js/supabaseClient.js
// Single place for your Supabase config

export const SUPABASE_URL = "https://ywqkgttthlpytpwaxwpr.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_nrvv6YM3tKg0NZL1Bkvk0w_tlVWRoEA";

export function getSupabase() {
  // supabase-js is loaded via CDN on pages that need it
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
