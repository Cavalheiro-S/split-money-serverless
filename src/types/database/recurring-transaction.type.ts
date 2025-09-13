export interface RecurringTransaction {
  Row: {
    id: string;
    description: string;
    type: 'income' | 'outcome';
    amount: number;
    recurrence_rule: string; // e.g., "FREQ=MONTHLY;INTERVAL=1"
    start_date: Date;
    end_date?: Date; // Optional, if the recurrence has an end date
    last_generated_at?: Date;
    note?: string;
    created_at: Date;
    updated_at: Date;
    user_id: string;
  };
  Insert: Omit<RecurringTransaction['Row'], 'created_at'>;
  Update: Partial<RecurringTransaction['Insert']>;
}
