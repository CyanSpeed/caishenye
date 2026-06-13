// ===== Database Schema Types =====

export type AccountType = 'asset' | 'liability'
export type AccountSubType = 'cash' | 'bank' | 'investment' | 'receivable' | 'mortgage' | 'consumer_loan' | 'private_loan'

export type AccountSyncMode = 'exact' | 'approximate' // exact=精确同步, approximate=近似记账

export interface Account {
  id: number
  name: string
  type: AccountType
  sub_type: AccountSubType
  balance: string // stored as string for decimal precision
  currency: string
  is_active: boolean
  notes: string
  original_amount: string // 负债的原始总金额，仅负债类型使用
  sync_mode: AccountSyncMode // 账户同步模式
  last_synced_at: string | null // 上次同步时间
}

export interface BalanceSnapshot {
  id: number
  account_id: number
  date: string // YYYY-MM-DD HH:mm:ss
  old_balance: string
  new_balance: string
  diff: string // 差额 = new - old
  diff_handling: 'expense' | 'income' | 'ignore' // 差额处理方式
  note: string
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
  member_name: string // 家庭成员姓名，仅支出类型使用
}

export interface InvestmentSnapshot {
  id: number
  account_id: number
  date: string
  market_value: string
  cost_basis: string
  note: string
}

export type PhysicalAssetCategory = '家电' | '数码' | '汽车' | '奢侈品' | '房产'
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
  expense_nature: '' | 'fixed' | 'variable'
  cashflow_type: 'operating' | 'investing' | 'financing'
}

// ===== Settings =====

export interface Settings {
  key: string
  value: string
}

export interface FamilyMember {
  name: string
  role: string
  age: number
  avatar: string // base64 头像图片数据
}

export interface FamilyInfo {
  familyName: string
  members: FamilyMember[]
  city: string
  preparer: string
  reviewer: string
}

// ===== Net Worth Snapshots =====

export interface NetWorthSnapshot {
  id: number
  date: string
  total_assets: string
  total_liabilities: string
  net_worth: string
}

// ===== Quarterly Report =====

export interface BalanceSheetItem {
  name: string
  amount: number
  percentage: number
  note: string
}

export interface IncomeExpenseItem {
  name: string
  amount: number
  percentage: number
}

export interface CashFlowItem {
  name: string
  amount: number
  note: string
}

export interface KPIData {
  name: string
  formula: string
  value: number
  displayValue: string
  status: 'good' | 'warn' | 'bad'
  verdict: string
  barPercentage: number
}

export interface QuarterlyReportData {
  meta: {
    familyName: string
    members: { name: string; role: string; age: number }[]
    city: string
    preparer: string
    reviewer: string
    year: number
    quarter: number
    quarterLabel: string
    dateRange: string
    generatedAt: string
    dataNote: string
  }
  summary: {
    totalAssets: number
    totalLiabilities: number
    netWorth: number
    quarterlyNetSavings: number
    savingsRate: number
    totalAssetsChange: number
    totalLiabilitiesChange: number
    netWorthChange: number
  }
  balanceSheet: {
    assets: {
      liquid: BalanceSheetItem[]
      investment: BalanceSheetItem[]
      fixed: BalanceSheetItem[]
      liquidTotal: number
      investmentTotal: number
      fixedTotal: number
      grandTotal: number
    }
    liabilities: {
      shortTerm: BalanceSheetItem[]
      longTerm: BalanceSheetItem[]
      shortTermTotal: number
      longTermTotal: number
      grandTotal: number
    }
  }
  incomeStatement: {
    income: {
      categories: IncomeExpenseItem[]
      total: number
    }
    expense: {
      fixed: IncomeExpenseItem[]
      variable: IncomeExpenseItem[]
      fixedTotal: number
      variableTotal: number
      total: number
    }
    netSavings: number
    savingsRate: number
  }
  cashFlow: {
    operating: CashFlowItem[]
    investing: CashFlowItem[]
    financing: CashFlowItem[]
    operatingTotal: number
    investingTotal: number
    financingTotal: number
    netCashFlow: number
  }
  kpis: KPIData[]
  assetStructure: {
    assetComposition: { name: string; value: number; percentage: number }[]
    expenseComposition: { name: string; value: number; percentage: number }[]
  }
}

// ===== IPC Channel Names =====

export const IPC_CHANNELS = {
  PING: 'ping',
  // Accounts
  GET_ACCOUNTS: 'get-accounts',
  ADD_ACCOUNT: 'add-account',
  UPDATE_ACCOUNT: 'update-account',
  DELETE_ACCOUNT: 'delete-account',
  SYNC_BALANCE: 'sync-balance',
  GET_BALANCE_SNAPSHOTS: 'get-balance-snapshots',
  // Transactions
  GET_TRANSACTIONS: 'get-transactions',
  ADD_TRANSACTION: 'add-transaction',
  UPDATE_TRANSACTION: 'update-transaction',
  DELETE_TRANSACTION: 'delete-transaction',
  // Categories
  GET_CATEGORIES: 'get-categories',
  // Investment Snapshots
  GET_INVESTMENT_SNAPSHOTS: 'get-investment-snapshots',
  ADD_INVESTMENT_SNAPSHOT: 'add-investment-snapshot',
  UPDATE_INVESTMENT_SNAPSHOT: 'update-investment-snapshot',
  // Physical Assets
  GET_PHYSICAL_ASSETS: 'get-physical-assets',
  ADD_PHYSICAL_ASSET: 'add-physical-asset',
  UPDATE_PHYSICAL_ASSET: 'update-physical-asset',
  DELETE_PHYSICAL_ASSET: 'delete-physical-asset',
  // Settings
  GET_SETTINGS: 'get-settings',
  UPDATE_SETTING: 'update-setting',
  // Net Worth Snapshots
  GET_NET_WORTH_SNAPSHOTS: 'get-net-worth-snapshots',
  // Quarterly Report
  GENERATE_REPORT: 'generate-report',
  EXPORT_REPORT_PDF: 'export-report-pdf',
  // Image Recognition
  RECOGNIZE_EXPENSE_IMAGE: 'recognize-expense-image',
  BATCH_ADD_TRANSACTIONS: 'batch-add-transactions',
  // Reset
  RESET_TRANSACTION_DATA: 'reset-transaction-data',
  // Database Export
  EXPORT_DATABASE: 'export-database',
  GET_DATABASE_PATH: 'get-database-path',
  // File Dialog
  SELECT_IMAGE_FILE: 'select-image-file',
  SELECT_DIRECTORY: 'select-directory',
  // Auto Backup
  GET_BACKUP_CONFIG: 'get-backup-config',
  UPDATE_BACKUP_CONFIG: 'update-backup-config',
  RUN_BACKUP: 'run-backup',
} as const

// ===== Image Recognition Types =====

export type RecognitionProvider = 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom'

export interface RecognitionConfig {
  provider: RecognitionProvider
  apiKey: string
  baseUrl: string
  model: string
}

export interface RecognizedCategory {
  name: string           // 识别出的类别名（如"餐饮"）
  amount: string         // 识别出的金额（字符串，Decimal精度）
  confidence: number     // 置信度 0-1
  matchedCategoryId?: number  // 匹配到的系统分类ID
  matchedCategoryName?: string // 匹配到的系统分类名
}

export interface RecognitionResult {
  categories: RecognizedCategory[]
  totalAmount: string
  rawResponse?: string   // 原始API响应，用于调试
}

export interface BatchImportItem {
  category_id: number
  amount: string
  description: string
  member_name?: string // 可选：家庭成员姓名
}

export interface BatchImportParams {
  items: BatchImportItem[]
  date: string           // YYYY-MM-DD
  from_account_id: number
}
