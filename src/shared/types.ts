// ===== Database Schema Types =====

export type AccountType = 'asset' | 'liability'
export type AccountSubType = 'cash' | 'bank' | 'investment' | 'loan' | 'credit'

export interface Account {
  id: number
  name: string
  type: AccountType
  sub_type: AccountSubType
  balance: string // stored as string for decimal precision
  currency: string
  is_active: boolean
}

export type TransactionType = 'expense' | 'income' | 'transfer'

export interface Transaction {
  id: number
  date: string // YYYY-MM-DD
  type: TransactionType
  amount: string
  from_account_id: number | null
  to_account_id: number | null
  category_id: number | null
  description: string
  tags: string // JSON string
}

export interface InvestmentSnapshot {
  id: number
  account_id: number
  date: string
  market_value: string
  cost_basis: string
  note: string
}

export type PhysicalAssetCategory = '家电' | '数码' | '汽车' | '奢侈品'
export type PhysicalAssetStatus = '使用中' | '已出售' | '已报废'

export interface PhysicalAsset {
  id: number
  name: string
  category: PhysicalAssetCategory
  icon_emoji: string
  purchase_price: string
  purchase_date: string
  current_value: string
  image_url: string
  notes: string
  status: PhysicalAssetStatus
}

export interface Category {
  id: number
  name: string
  type: 'income' | 'expense'
  icon: string
}

// ===== IPC Channel Names =====

export const IPC_CHANNELS = {
  PING: 'ping',
  GET_ACCOUNTS: 'get-accounts',
  ADD_TRANSACTION: 'add-transaction',
  GET_TRANSACTIONS: 'get-transactions',
  GET_STATISTICS: 'get-statistics',
  GET_NET_WORTH: 'get-net-worth',
  GET_ASSET_ALLOCATION: 'get-asset-allocation',
  UPDATE_INVESTMENT_SNAPSHOT: 'update-investment-snapshot',
  GET_PHYSICAL_ASSETS: 'get-physical-assets',
  ADD_PHYSICAL_ASSET: 'add-physical-asset',
  UPDATE_PHYSICAL_ASSET: 'update-physical-asset',
  DELETE_PHYSICAL_ASSET: 'delete-physical-asset',
} as const
