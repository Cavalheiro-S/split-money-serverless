import { createClient } from "@supabase/supabase-js";
import 'dotenv/config'
import { Database } from '../types/database/database.types'

export const supabase = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);