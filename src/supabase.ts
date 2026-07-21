import { createClient } from '@supabase/supabase-js'

// Publishable key — safe to ship in the bundle. Every row in the sync
// store is protected by row-level security tied to the signed-in user.
const SUPABASE_URL = 'https://cbuqgfoapcxrnzshjdce.supabase.co'
const SUPABASE_KEY = 'sb_publishable_yIwXXaCfeM4L1easAGXrhQ__rw_P2H4'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
