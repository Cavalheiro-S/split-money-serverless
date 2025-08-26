import { createClient } from "@supabase/supabase-js";
import 'dotenv/config'
import { Database } from '../types/database/database.type'

export const supabase = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);