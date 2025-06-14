export interface Transaction {
  Row: {
    id: string
    description: string
    date: Date
    amount: number
    note?: string
    type: 'income' | 'outcome'
    created_at: Date
    updated_at: Date
    user_id: string
    tag_id?: string
    category_id?: string
    payment_status_id?: string
    recurrent_transaction_id?: string
  }
  Insert: Omit<Transaction['Row'], 'created_at'>
  Update: Partial<Transaction['Insert']>
}
