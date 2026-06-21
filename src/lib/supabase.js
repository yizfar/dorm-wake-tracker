import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '⚠️ חיבור לסופהבייס לא הוגדר. ' +
    'יש להוסיף VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY לקובץ .env (לוקאלית) או למשתני הסביבה ב-Vercel.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
