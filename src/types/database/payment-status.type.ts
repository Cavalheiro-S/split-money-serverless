import { Database } from "./database.types"

export interface PaymentStatus {
    Row: {
      id: string
      status: string
      createdAt: Date
      updatedAt: Date
    }
    Insert: Omit<Database['public']['Tables']['payment_status']['Row'], 'createdAt'>
    Update: Partial<Database['public']['Tables']['payment_status']['Insert']>
  }
