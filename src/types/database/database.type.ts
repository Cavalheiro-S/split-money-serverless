import { Category } from './category.type';
import { PaymentStatus } from './payment-status.type';
import { RecurringTransaction } from './recurring-transaction.type';
import { Tag } from './tag.type';
import { Transaction } from './transaction.type';

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
    };
  };
}
