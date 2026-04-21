export interface Goal {
  Row: {
    id: string;
    user_id: string;
    title: string;
    description: string | null;
    target_amount: number;
    deadline: string;
    created_at: Date;
    updated_at: Date;
  };
  Insert: Omit<Goal['Row'], 'created_at' | 'updated_at'>;
  Update: Partial<Goal['Insert']>;
}

export interface GoalContribution {
  Row: {
    id: string;
    goal_id: string;
    user_id: string;
    amount: number;
    date: string;
    note: string | null;
    created_at: Date;
  };
  Insert: Omit<GoalContribution['Row'], 'created_at'>;
  Update: Partial<GoalContribution['Insert']>;
}
