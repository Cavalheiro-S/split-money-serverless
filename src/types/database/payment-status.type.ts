export interface PaymentStatus {
  Row: {
    id: string;
    description: string;
    created_at: Date;
    updated_at: Date;
    user_id: string;
  };
  Insert: Omit<PaymentStatus['Row'], 'created_at'>;
  Update: Partial<PaymentStatus['Insert']>;
}
