import { RRule } from 'rrule';
import { TransactionFrequencyEnum } from '../enums/transaction';

export const convertToRRule = (
  frequency: TransactionFrequencyEnum,
  count: number = 1
): string => {
  if (count <= 0) {
    throw new Error('Interval must be a positive number');
  }

  const frequencyMap = {
    [TransactionFrequencyEnum.DAILY]: RRule.DAILY,
    [TransactionFrequencyEnum.WEEKLY]: RRule.WEEKLY,
    [TransactionFrequencyEnum.MONTHLY]: RRule.MONTHLY,
    [TransactionFrequencyEnum.YEARLY]: RRule.YEARLY,
  };

  const rule = new RRule({
    freq: frequencyMap[frequency],
    count,
  });

  return rule.toString().replace('RRULE:', '');
};

export const generateOccurrences = (
  rruleString: string,
  startDate: Date,
  dateRange: { start: Date; end: Date }
): Date[] => {
  try {
    // Use dtstart from the recurring transaction's start_date
    const ruleWithStart = new RRule({
      ...RRule.parseString(`RRULE:${rruleString}`),
      dtstart: startDate,
    });

    // Generate occurrences between the date range, inclusive
    const occurrences = ruleWithStart.between(
      dateRange.start,
      dateRange.end,
      true // inclusive
    );

    return occurrences;
  } catch (error) {
    console.error('Error generating occurrences from RRULE:', error);
    return [];
  }
};
