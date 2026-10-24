import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient() {
  const store = await cookies();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !publishableKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be configured.');
  }
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options as never)); } catch { /* read-only in Server Components */ }
      },
    },
  });
}
