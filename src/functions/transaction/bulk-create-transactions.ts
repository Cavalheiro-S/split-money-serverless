/**
 * Bulk-create transactions with idempotent dedupe via `external_id`.
 *
 * Used by the /import flow in the frontend to upload parsed OFX/CSV statements
 * from Nubank, 99Pay, etc. Re-importing the same file is a no-op: transactions
 * whose (user_id, external_id) already exists are skipped.
 *
 * REQUIRED DB SCHEMA CHANGE (run once in Supabase SQL editor):
 *
 *   ALTER TABLE transactions
 *     ADD COLUMN IF NOT EXISTS source TEXT,
 *     ADD COLUMN IF NOT EXISTS external_id TEXT;
 *
 *   CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_external_id_key
 *     ON transactions (user_id, external_id)
 *     WHERE external_id IS NOT NULL;
 */

import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { supabase } from '../../libs/supabase';
import { Database } from '../../types/database/database.type';

type Tables = Database['public']['Tables'];
type TransactionInsert = Tables['transactions']['Insert'];

const MAX_BATCH_SIZE = 500;

const itemSchema = z.object({
  description: z.string().min(1),
  date: z.coerce.date(),
  amount: z.number(),
  type: z.enum(['income', 'outcome']),
  note: z.string().optional(),
  categoryId: z.string().optional(),
  tagId: z.string().optional(),
  paymentStatusId: z.string().optional(),
  source: z.enum(['ofx', 'csv']),
  externalId: z.string().min(1),
});

const bodySchema = z.object({
  transactions: z.array(itemSchema).min(1).max(MAX_BATCH_SIZE),
});

type FailedItem = { externalId: string; reason: string };

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
) => {
  try {
    const sub = event.requestContext.authorizer.jwt.claims.sub as string;

    let body: unknown;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid JSON in request body' }),
      };
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid data',
          error: parsed.error.flatten(),
        }),
      };
    }

    const incoming = parsed.data.transactions;

    // Deduplicate within the payload itself (last write wins).
    const byExternalId = new Map<string, (typeof incoming)[number]>();
    for (const tx of incoming) {
      byExternalId.set(tx.externalId, tx);
    }

    // Find which external_ids already exist for this user.
    const externalIds = Array.from(byExternalId.keys());
    const { data: existing, error: existingError } = (await supabase
      .from('transactions')
      .select('external_id')
      .eq('user_id', sub)
      .in('external_id', externalIds)) as {
      data: { external_id: string }[] | null;
      error: any;
    };

    if (existingError) {
      console.error('Error checking existing transactions:', existingError);
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error checking existing transactions',
          error: existingError.message || 'Unknown database error',
        }),
      };
    }

    const alreadyImported = new Set(
      (existing ?? []).map(row => row.external_id)
    );

    const toInsert: TransactionInsert[] = [];
    const skipped: string[] = [];
    const failed: FailedItem[] = [];

    for (const [externalId, tx] of byExternalId) {
      if (alreadyImported.has(externalId)) {
        skipped.push(externalId);
        continue;
      }
      toInsert.push({
        id: uuidv4(),
        description: tx.description,
        date: tx.date,
        amount: tx.amount,
        type: tx.type,
        note: tx.note,
        category_id: tx.categoryId,
        tag_id: tx.tagId,
        payment_status_id: tx.paymentStatusId,
        user_id: sub,
        updated_at: new Date(),
        source: tx.source,
        external_id: externalId,
      });
    }

    let created: { id: string; external_id?: string }[] = [];
    if (toInsert.length > 0) {
      const { data: insertedData, error: insertError } = (await (
        supabase as any
      )
        .from('transactions')
        .insert(toInsert)
        .select('id, external_id')) as {
        data: { id: string; external_id?: string }[] | null;
        error: any;
      };

      if (insertError) {
        console.error('Error bulk-inserting transactions:', insertError);
        return {
          statusCode: 500,
          body: JSON.stringify({
            message: 'Error bulk-inserting transactions',
            error: insertError.message || 'Unknown database error',
          }),
        };
      }

      created = insertedData ?? [];
    }

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'Bulk import completed',
        summary: {
          total: incoming.length,
          created: created.length,
          skipped: skipped.length,
          failed: failed.length,
        },
        results: {
          created,
          skipped,
          failed,
        },
      }),
    };
  } catch (error) {
    console.error('Unexpected error in bulk-create-transactions:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
