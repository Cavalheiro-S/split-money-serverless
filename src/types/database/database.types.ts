import { Transaction } from "./transaction.type"
import { PaymentStatus } from "./payment-status.type"
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      transactions: Transaction
      payment_status: PaymentStatus
    }
  }
} 