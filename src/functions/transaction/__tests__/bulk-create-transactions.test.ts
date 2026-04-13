import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handler } from '../bulk-create-transactions';

jest.mock('../../../libs/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('uuid', () => {
  let counter = 0;
  return {
    v4: jest.fn(() => `mock-uuid-${++counter}`),
  };
});

import { supabase } from '../../../libs/supabase';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

const buildEvent = (body: unknown) =>
  ({
    body: typeof body === 'string' ? body : JSON.stringify(body),
    requestContext: {
      authorizer: {
        jwt: {
          claims: { sub: 'user-123' },
          scopes: [],
        },
        principalId: 'user-123',
        integrationLatency: 0,
      },
    },
  }) as any;

const validItem = (overrides: Record<string, unknown> = {}) => ({
  description: 'Coffee',
  date: '2024-01-15T10:00:00Z',
  amount: -12.5,
  type: 'outcome' as const,
  source: 'ofx' as const,
  externalId: 'ofx:nubank:abc123',
  ...overrides,
});

describe('bulk-create-transactions handler', () => {
  let existingSelectMock: any;
  let insertSelectMock: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the "check existing" chain: from(...).select(...).eq(...).in(...)
    existingSelectMock = {
      data: [],
      error: null,
    };

    insertSelectMock = {
      data: [],
      error: null,
    };

    (mockSupabase.from as any).mockImplementation(((_table: string) => ({
      // for SELECT existing
      select: ((_cols: string) => ({
        eq: ((_col: string, _val: string) => ({
          in: (() => Promise.resolve(existingSelectMock)) as any,
        })) as any,
      })) as any,
      // for INSERT
      insert: ((_rows: any) => ({
        select: (() => Promise.resolve(insertSelectMock)) as any,
      })) as any,
    })) as any);
  });

  describe('Validation', () => {
    it('returns 400 on empty body', async () => {
      const result = await handler(buildEvent(''));
      expect(result.statusCode).toBe(400);
    });

    it('returns 400 when transactions array is missing', async () => {
      const result = await handler(buildEvent({}));
      expect(result.statusCode).toBe(400);
    });

    it('returns 400 when transactions array is empty', async () => {
      const result = await handler(buildEvent({ transactions: [] }));
      expect(result.statusCode).toBe(400);
    });

    it('returns 400 when an item is missing required fields', async () => {
      const result = await handler(
        buildEvent({
          transactions: [{ description: 'x', amount: 10 }],
        })
      );
      expect(result.statusCode).toBe(400);
    });
  });

  describe('Successful import', () => {
    it('creates all transactions when none exist yet', async () => {
      insertSelectMock.data = [
        { id: 'mock-uuid-1', external_id: 'ofx:nubank:a' },
        { id: 'mock-uuid-2', external_id: 'ofx:nubank:b' },
      ];

      const result = await handler(
        buildEvent({
          transactions: [
            validItem({ externalId: 'ofx:nubank:a' }),
            validItem({ externalId: 'ofx:nubank:b', description: 'Lunch' }),
          ],
        })
      );

      expect(result.statusCode).toBe(201);
      const parsed = JSON.parse(result.body);
      expect(parsed.summary).toEqual({
        total: 2,
        created: 2,
        skipped: 0,
        failed: 0,
      });
    });

    it('deduplicates within the same payload', async () => {
      insertSelectMock.data = [
        { id: 'mock-uuid-1', external_id: 'ofx:nubank:a' },
      ];

      const result = await handler(
        buildEvent({
          transactions: [
            validItem({ externalId: 'ofx:nubank:a' }),
            validItem({ externalId: 'ofx:nubank:a' }),
          ],
        })
      );

      expect(result.statusCode).toBe(201);
      const parsed = JSON.parse(result.body);
      expect(parsed.summary.total).toBe(2);
      expect(parsed.summary.created).toBe(1);
    });

    it('skips transactions whose external_id already exists', async () => {
      existingSelectMock.data = [{ external_id: 'ofx:nubank:a' }];
      insertSelectMock.data = [
        { id: 'mock-uuid-1', external_id: 'ofx:nubank:b' },
      ];

      const result = await handler(
        buildEvent({
          transactions: [
            validItem({ externalId: 'ofx:nubank:a' }),
            validItem({ externalId: 'ofx:nubank:b' }),
          ],
        })
      );

      expect(result.statusCode).toBe(201);
      const parsed = JSON.parse(result.body);
      expect(parsed.summary).toEqual({
        total: 2,
        created: 1,
        skipped: 1,
        failed: 0,
      });
      expect(parsed.results.skipped).toContain('ofx:nubank:a');
    });

    it('returns created:0 when all transactions already exist', async () => {
      existingSelectMock.data = [
        { external_id: 'ofx:nubank:a' },
        { external_id: 'ofx:nubank:b' },
      ];

      const result = await handler(
        buildEvent({
          transactions: [
            validItem({ externalId: 'ofx:nubank:a' }),
            validItem({ externalId: 'ofx:nubank:b' }),
          ],
        })
      );

      expect(result.statusCode).toBe(201);
      const parsed = JSON.parse(result.body);
      expect(parsed.summary.created).toBe(0);
      expect(parsed.summary.skipped).toBe(2);
    });
  });

  describe('Error handling', () => {
    it('returns 500 when checking existing fails', async () => {
      existingSelectMock.error = { message: 'db down' };

      const result = await handler(
        buildEvent({
          transactions: [validItem()],
        })
      );

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).message).toMatch(/Error checking/);
    });

    it('returns 500 when insert fails', async () => {
      insertSelectMock.error = { message: 'unique violation' };

      const result = await handler(
        buildEvent({
          transactions: [validItem()],
        })
      );

      expect(result.statusCode).toBe(500);
      expect(JSON.parse(result.body).message).toMatch(/bulk-inserting/);
    });
  });
});
