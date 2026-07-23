import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'https://ibhrmenurandwvvebqfb.supabase.co';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_7gVIo8ypfpXtAAjofQ1qVQ_QCkKwvkk';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session?.access_token) headers.set('Authorization', `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers });
}
