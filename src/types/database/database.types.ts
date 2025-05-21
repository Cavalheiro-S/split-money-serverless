import { Transaction } from "./transaction.type"
import { PaymentStatus } from "./payment-status.type"
import { Investment } from "./investment.type"

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
      investments: Investment
    }
  }
}