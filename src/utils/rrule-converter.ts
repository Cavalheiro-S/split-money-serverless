import { RRule } from "rrule";
import { TransactionFrequencyEnum } from "../enums/transaction";

export const convertToRRule = (
  frequency: TransactionFrequencyEnum,
  count: number = 1
): string => {
  if (count <= 0) {
    throw new Error("Interval must be a positive number");
  }

  const frequencyMap = {
    [TransactionFrequencyEnum.DAILY]: RRule.DAILY,
    [TransactionFrequencyEnum.WEEKLY]: RRule.WEEKLY,
    [TransactionFrequencyEnum.MONTHLY]: RRule.MONTHLY,
    [TransactionFrequencyEnum.YEARLY]: RRule.YEARLY,
  };

  const rule = new RRule({
    freq: frequencyMap[frequency],
    count: count,
  });

  return rule.toString().replace("RRULE:", "");
};
