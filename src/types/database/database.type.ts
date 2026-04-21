import { Transaction } from './transaction.type';
import { PaymentStatus } from './payment-status.type';
import { Category } from './category.type';
import { Tag } from './tag.type';
import { RecurringTransaction } from './recurring-transaction.type';
import { Goal, GoalContribution } from './goal.type';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      transactions: Transaction;
      payment_status: PaymentStatus;
      categories: Category;
      tags: Tag;
      recurring_transactions: RecurringTransaction;
      goals: Goal;
      goal_contributions: GoalContribution;
    };
  };
}
