import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn('Supabase env vars not set — using dev mode')
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder')

export const DEV_USER_ID = import.meta.env.VITE_DEV_USER_ID || '00000000-0000-0000-0000-000000000000'
