import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../libs/supabase';

const DEFAULT_TAGS = [
  'Pessoal',
  'Trabalho',
  'Alimentação',
  'Transporte',
  'Lazer',
  'Saúde',
  'Moradia',
];

const DEFAULT_CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Lazer',
  'Saúde',
  'Moradia',
  'Compras',
  'Educação',
  'Outros',
];

const DEFAULT_PAYMENT_STATUSES = ['Pendente', 'Pago', 'Atrasado', 'Cancelado'];

export async function initializeUserDefaults(userId: string): Promise<void> {
  const now = new Date();
  const toPayload = (descriptions: string[]) =>
    descriptions.map((description) => ({
      id: uuidv4(),
      description,
      user_id: userId,
      updated_at: now,
    }));

  const results = await Promise.allSettled([
    supabase.from('tags').insert(toPayload(DEFAULT_TAGS)),
    supabase.from('categories').insert(toPayload(DEFAULT_CATEGORIES)),
    supabase.from('payment_status').insert(toPayload(DEFAULT_PAYMENT_STATUSES)),
  ]);

  const tables = ['tags', 'categories', 'payment_status'];
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`Error initializing defaults for ${tables[i]}:`, result.reason);
    } else if (result.value.error) {
      console.error(`Error initializing defaults for ${tables[i]}:`, result.value.error);
    }
  });
}
