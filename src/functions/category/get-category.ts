import { supabase } from '../../libs/supabase';
import {
  withStandardMiddleware,
  AuthenticatedEvent,
  ResponseBuilder,
} from '../../presentation/middleware';
import { Database } from '../../types/database/database.type';

type Tables = Database['public']['Tables'];
type Category = Tables['categories']['Row'];

/**
 * Get all categories for the authenticated user
 * Uses standard middleware: auth + error handling
 */
export const handler = withStandardMiddleware(
  async (event: AuthenticatedEvent) => {
    const userId = event.userId; // Already validated by authMiddleware

    const { data: categories, error } = (await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)) as {
      data: Category[] | null;
      error: any;
    };

    // If error, throw it - errorMiddleware will handle it
    if (error) {
      throw error;
    }

    return ResponseBuilder.ok(categories || []);
  }
);
