 
/**
 * Test suite for scheduled recurring transactions creation
 *
 * To run these tests:
 * npm test -- scheduled-transactions.test.ts
 */

import { RecurringTransactionService } from '../../../services/recurring-transaction.service';

describe('RecurringTransactionService - Scheduled Transactions', () => {
  describe('createScheduledTransactions', () => {
    it('should process transactions for current month when no parameters provided', async () => {
      const result =
        await RecurringTransactionService.createScheduledTransactions();

      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.processedMonth).toBeDefined();

      if (result.stats) {
        expect(typeof result.stats.totalRecurringTransactions).toBe('number');
        expect(typeof result.stats.totalOccurrencesGenerated).toBe('number');
        expect(typeof result.stats.totalTransactionsCreated).toBe('number');
        expect(Array.isArray(result.stats.errors)).toBe(true);
      }
    });

    it('should process transactions for specific month', async () => {
      const targetMonth = 12;
      const targetYear = 2025;

      const result =
        await RecurringTransactionService.createScheduledTransactions(
          targetMonth,
          targetYear
        );

      expect(result.success).toBe(true);
      expect(result.processedMonth).toBe('2025-12');
    });

    it('should handle case with no recurring transactions gracefully', async () => {
      // This test assumes a clean database or filtered state
      const result =
        await RecurringTransactionService.createScheduledTransactions();

      expect(result.success).toBe(true);

      if (result.stats && result.stats.totalRecurringTransactions === 0) {
        expect(result.stats.totalTransactionsCreated).toBe(0);
      }
    });

    it('should return proper format when errors occur', async () => {
      const result =
        await RecurringTransactionService.createScheduledTransactions();

      if (result.stats && result.stats.errors.length > 0) {
        const firstError = result.stats.errors[0];
        expect(firstError).toHaveProperty('recurringId');
        expect(firstError).toHaveProperty('error');
        expect(typeof firstError.recurringId).toBe('string');
        expect(typeof firstError.error).toBe('string');
      }
    });
  });
});
