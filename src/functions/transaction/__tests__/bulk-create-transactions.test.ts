import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handler, checkRateLimit, rateLimitStore } from '../bulk-create-transactions';

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

const buildEventForUser = (userId: string, body: unknown) => ({
  ...buildEvent(body),
  requestContext: {
    authorizer: {
      jwt: { claims: { sub: userId }, scopes: [] },
      principalId: userId,
      integrationLatency: 0,
    },
  },
});

const validItem = (overrides: Record<string, unknown> = {}) => ({
  description: 'Coffee',
  date: '2024-01-15T10:00:00Z',
  amount: -12.5,
  type: 'outcome' as const,
  source: 'ofx' as const,
  externalId: 'ofx:nubank:abc123',
  ...overrides,
});

const NOW = 1_700_000_000_000;

describe('bulk-create-transactions handler', () => {
  let existingSelectMock: any;
  let insertSelectMock: any;

  beforeEach(() => {
    jest.clearAllMocks();
    rateLimitStore.clear();

    existingSelectMock = { data: [], error: null };
    insertSelectMock = { data: [], error: null };

    (mockSupabase.from as any).mockImplementation(((_table: string) => ({
      select: ((_cols: string) => ({
        eq: ((_col: string, _val: string) => ({
          in: (() => Promise.resolve(existingSelectMock)) as any,
        })) as any,
      })) as any,
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
      expect(parsed.summary).toMatchObject({
        total: 2,
        created: 2,
        skipped: 0,
        skipped_modified: 0,
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
      existingSelectMock.data = [
        {
          external_id: 'ofx:nubank:a',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];
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
      expect(parsed.summary).toMatchObject({
        total: 2,
        created: 1,
        skipped: 1,
        failed: 0,
      });
      expect(parsed.results.skipped).toContain('ofx:nubank:a');
    });

    it('returns created:0 when all transactions already exist', async () => {
      existingSelectMock.data = [
        {
          external_id: 'ofx:nubank:a',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          external_id: 'ofx:nubank:b',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
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

  // T7 – rate limiting
  describe('Rate limiting', () => {
    it('allows up to 3 imports per user within the window', () => {
      expect(checkRateLimit('u1', NOW).allowed).toBe(true);
      expect(checkRateLimit('u1', NOW + 100).allowed).toBe(true);
      expect(checkRateLimit('u1', NOW + 200).allowed).toBe(true);
      expect(checkRateLimit('u1', NOW + 300).allowed).toBe(false);
    });

    it('returns a positive retryAfter when blocked', () => {
      checkRateLimit('u2', NOW);
      checkRateLimit('u2', NOW + 100);
      checkRateLimit('u2', NOW + 200);
      const { allowed, retryAfter } = checkRateLimit('u2', NOW + 300);
      expect(allowed).toBe(false);
      expect(retryAfter).toBeGreaterThan(0);
    });

    it('resets counter after the window expires', () => {
      checkRateLimit('u3', NOW);
      checkRateLimit('u3', NOW + 100);
      checkRateLimit('u3', NOW + 200);
      // Window expired
      expect(checkRateLimit('u3', NOW + 61_000).allowed).toBe(true);
    });

    it('different users do not interfere with each other', () => {
      checkRateLimit('userA', NOW);
      checkRateLimit('userA', NOW + 100);
      checkRateLimit('userA', NOW + 200);
      // userA is blocked but userB should still be allowed
      expect(checkRateLimit('userB', NOW + 300).allowed).toBe(true);
    });

    it('handler returns 429 on 4th call and includes Retry-After header', async () => {
      // Exhaust the rate limit using real time so the handler's Date.now() stays in window
      const now = Date.now();
      checkRateLimit('user-123', now);
      checkRateLimit('user-123', now + 100);
      checkRateLimit('user-123', now + 200);

      // 4th attempt via handler (handler uses Date.now() internally, still within window)
      const result = await handler(buildEvent({ transactions: [validItem()] }));
      expect(result.statusCode).toBe(429);
      expect(result.headers?.['Retry-After']).toBeDefined();
      const body = JSON.parse(result.body);
      expect(body.message).toMatch(/Muitas importações/);
    });
  });

  // T8 – skipped_modified
  describe('skipped_modified detection', () => {
    it('counts a skipped transaction as modified when updated_at >> created_at', async () => {
      existingSelectMock.data = [
        {
          external_id: 'ofx:nubank:a',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z', // edited 1 day later
        },
      ];

      const result = await handler(
        buildEvent({ transactions: [validItem({ externalId: 'ofx:nubank:a' })] })
      );

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.summary.skipped_modified).toBe(1);
    });

    it('does not count as modified when updated_at equals created_at', async () => {
      existingSelectMock.data = [
        {
          external_id: 'ofx:nubank:a',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      const result = await handler(
        buildEvent({ transactions: [validItem({ externalId: 'ofx:nubank:a' })] })
      );

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.summary.skipped_modified).toBe(0);
    });

    it('does not count as modified within the 1s tolerance', async () => {
      existingSelectMock.data = [
        {
          external_id: 'ofx:nubank:a',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.500Z', // 500ms difference → within tolerance
        },
      ];

      const result = await handler(
        buildEvent({ transactions: [validItem({ externalId: 'ofx:nubank:a' })] })
      );

      const body = JSON.parse(result.body);
      expect(body.summary.skipped_modified).toBe(0);
    });
  });
});
