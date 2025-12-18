import { getMonth, getYear } from 'date-fns';

import { RecurringTransactionService } from '../../services/recurring-transaction.service';

export const handler = async () => {
  console.log('Starting scheduled recurring transactions creation');

  try {
    const now = new Date();
    const month = getMonth(now) + 1;
    const year = getYear(now);

    const result =
      await RecurringTransactionService.createScheduledTransactions(
        month,
        year
      );

    if (!result.success) {
      console.error('Error creating scheduled transactions:', result.error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error creating scheduled transactions',
          error:
            result.error instanceof Error
              ? result.error.message
              : 'Unknown error',
        }),
      };
    }

    console.log('Scheduled transactions created successfully');
    console.log('Stats:', JSON.stringify(result.stats, null, 2));

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Scheduled transactions created successfully',
        stats: result.stats,
        processedMonth: result.processedMonth,
      }),
    };
  } catch (error) {
    console.error('Unexpected error in scheduled function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
