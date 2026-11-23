
'use client'

import { createClient } from '@supabase/supabase-js'

export function createSupabaseClient(url: string, publishableKey: string) {
  return createClient(url, publishableKey)
}
