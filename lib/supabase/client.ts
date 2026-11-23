
'use client'

import { createClient } from '@supabase/supabase-js'

// Vercel's Supabase integration injects these server-prefixed names.
// NEXT_PUBLIC_* aliases remain supported for local environments.
const supabaseUrl =
  process.env.NEXT_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishableKey =
  process.env.NEXT_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

// Make sure both environment variables exist
if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables.')
}

// Create and export the Supabase client
export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
)
