export interface Tag {
    Row: {
      id: string
      description: string
      created_at: Date
      updated_at: Date
      user_id: string
    }
    Insert: Omit<Tag['Row'], 'created_at'>
    Update: Partial<Tag['Insert']>
  }
