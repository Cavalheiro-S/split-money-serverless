export interface Category {
    Row: {
      id: string
      description: string
      created_at: Date
      updated_at: Date
      user_id: string
    }
    Insert: Omit<Category['Row'], 'created_at'>
    Update: Partial<Category['Insert']>
  }
