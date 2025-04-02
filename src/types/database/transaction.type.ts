import { Database } from "./database.types"

export interface Transaction{
    Row: {
      id: string
      description: string
      date: Date
      amount: number
      type: 'income' | 'outcome'
      category: string
      createdAt: Date
      updatedAt: Date
      paymentStatusId: string | undefined
      userId: string
      parentId: string | undefined
    }
    Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'createdAt'>
    Update: Partial<Database['public']['Tables']['transactions']['Insert']>
  }
