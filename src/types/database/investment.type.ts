import { Database } from "./database.types"

export interface Investment {
  Row: {
    id: string
    userId: string
    ticker: string
    quantity: number
    purchasePrice: number
    purchaseDate: Date
    currency: string
    createdAt: Date
    updatedAt: Date
  }
  Insert: Omit<Database['public']['Tables']['investments']['Row'], 'createdAt'>
  Update: Partial<Database['public']['Tables']['investments']['Insert']>
}
