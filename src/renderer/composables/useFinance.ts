import { reactive, computed } from 'vue'
import Decimal from 'decimal.js'
import type { Account, Transaction, InvestmentSnapshot, Category, PhysicalAsset } from '@shared/types'

interface FinanceState {
  accounts: Account[]
  transactions: Transaction[]
  snapshots: InvestmentSnapshot[]
  categories: Category[]
  physicalAssets: PhysicalAsset[]
  initialized: boolean
}

const state = reactive<FinanceState>({
  accounts: [],
  transactions: [],
  snapshots: [],
  categories: [],
  physicalAssets: [],
  initialized: false,
})

let initPromise: Promise<void> | null = null

async function init() {
  if (state.initialized) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    const api = window.electronAPI
    const [accounts, transactions, snapshots, categories, physicalAssets] = await Promise.all([
      api.getAccounts(),
      api.getTransactions(),
      api.getInvestmentSnapshots(),
      api.getCategories(),
      api.getPhysicalAssets(),
    ])
    state.accounts = accounts as Account[]
    state.transactions = transactions as Transaction[]
    state.snapshots = snapshots as InvestmentSnapshot[]
    state.categories = categories as Category[]
    state.physicalAssets = physicalAssets as PhysicalAsset[]
    state.initialized = true
  })()

  return initPromise
}

export function useFinance() {
  // Trigger init on first use (non-blocking)
  if (!state.initialized) init()

  // ---- Accounts ----
  const assetAccounts = computed(() => state.accounts.filter(a => a.type === 'asset' && a.is_active))
  const liabilityAccounts = computed(() => state.accounts.filter(a => a.type === 'liability' && a.is_active))
  const investmentAccounts = computed(() => state.accounts.filter(a => a.sub_type === 'investment' && a.is_active))

  // ---- Net Worth ----
  const totalAssets = computed(() =>
    assetAccounts.value.reduce((sum, a) => sum.plus(new Decimal(a.balance)), new Decimal(0))
  )
  const totalLiabilities = computed(() =>
    liabilityAccounts.value.reduce((sum, a) => sum.plus(new Decimal(a.balance)), new Decimal(0))
  )
  const netWorth = computed(() => totalAssets.value.minus(totalLiabilities.value))

  // ---- Monthly Summary ----
  const currentMonth = new Date().toISOString().slice(0, 7)

  const monthlyIncome = computed(() =>
    state.transactions
      .filter(t => t.type === 'income' && t.date.startsWith(currentMonth))
      .reduce((sum, t) => sum.plus(new Decimal(t.amount)), new Decimal(0))
  )
  const monthlyExpense = computed(() =>
    state.transactions
      .filter(t => t.type === 'expense' && t.date.startsWith(currentMonth))
      .reduce((sum, t) => sum.plus(new Decimal(t.amount)), new Decimal(0))
  )

  // ---- Asset Allocation (for pie chart) ----
  const assetAllocation = computed(() => {
    const groups: Record<string, Decimal> = { cash: new Decimal(0), bank: new Decimal(0), investment: new Decimal(0) }
    assetAccounts.value.forEach(a => {
      if (groups[a.sub_type] !== undefined) {
        groups[a.sub_type] = groups[a.sub_type].plus(new Decimal(a.balance))
      }
    })
    return [
      { name: '现金', value: groups.cash.toNumber(), sub_type: 'cash' as const },
      { name: '银行存款', value: groups.bank.toNumber(), sub_type: 'bank' as const },
      { name: '投资', value: groups.investment.toNumber(), sub_type: 'investment' as const },
    ].filter(g => g.value > 0)
  })

  // ---- Liability Overview (for ring chart) ----
  const liabilityOverview = computed(() => {
    const groups: Record<string, Decimal> = { loan: new Decimal(0), credit: new Decimal(0) }
    liabilityAccounts.value.forEach(a => {
      if (groups[a.sub_type] !== undefined) {
        groups[a.sub_type] = groups[a.sub_type].plus(new Decimal(a.balance))
      }
    })
    return [
      { name: '贷款', value: groups.loan.toNumber(), sub_type: 'loan' as const },
      { name: '信用卡', value: groups.credit.toNumber(), sub_type: 'credit' as const },
    ].filter(g => g.value > 0)
  })

  // ---- Recent Transactions ----
  const recentTransactions = computed(() =>
    [...state.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  )

  // ---- All transactions sorted ----
  const sortedTransactions = computed(() =>
    [...state.transactions].sort((a, b) => b.date.localeCompare(a.date))
  )

  // ---- Categories by type ----
  const expenseCategories = computed(() => state.categories.filter(c => c.type === 'expense'))
  const incomeCategories = computed(() => state.categories.filter(c => c.type === 'income'))

  // ---- Category monthly spending ----
  const categoryMonthlySpending = computed(() => {
    const map: Record<number, Decimal> = {}
    state.transactions
      .filter(t => t.type === 'expense' && t.date.startsWith(currentMonth) && t.category_id)
      .forEach(t => {
        const cid = t.category_id!
        map[cid] = (map[cid] || new Decimal(0)).plus(new Decimal(t.amount))
      })
    return state.categories
      .filter(c => c.type === 'expense')
      .map(c => ({ ...c, total: map[c.id] || new Decimal(0) }))
      .filter(c => c.total.gt(0))
      .sort((a, b) => b.total.minus(a.total).toNumber())
  })

  // ---- Investment Performance ----
  const investmentPerformance = computed(() => {
    return investmentAccounts.value.map(acc => {
      const accSnapshots = state.snapshots
        .filter(s => s.account_id === acc.id)
        .sort((a, b) => b.date.localeCompare(a.date))
      const latest = accSnapshots[0]
      const first = accSnapshots[accSnapshots.length - 1]
      if (!latest || !first) {
        return { account: acc, latestValue: new Decimal(acc.balance), costBasis: new Decimal(0), returnAmount: new Decimal(0), returnRate: new Decimal(0), snapshots: [] as InvestmentSnapshot[] }
      }
      const latestValue = new Decimal(latest.market_value)
      const costBasis = new Decimal(latest.cost_basis)
      const returnAmount = latestValue.minus(costBasis)
      const returnRate = costBasis.eq(0) ? new Decimal(0) : returnAmount.div(costBasis)
      return { account: acc, latestValue, costBasis, returnAmount, returnRate, snapshots: accSnapshots }
    })
  })

  // ---- Monthly trend (last 6 months) ----
  const monthlyTrend = computed(() => {
    const now = new Date()
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return months.map(month => {
      const income = state.transactions
        .filter(t => t.type === 'income' && t.date.startsWith(month))
        .reduce((sum, t) => sum.plus(new Decimal(t.amount)), new Decimal(0))
      const expense = state.transactions
        .filter(t => t.type === 'expense' && t.date.startsWith(month))
        .reduce((sum, t) => sum.plus(new Decimal(t.amount)), new Decimal(0))
      return { month: month.slice(5), income: income.toNumber(), expense: expense.toNumber() }
    })
  })

  // ---- Getters by ID ----
  function getAccountById(id: number): Account | undefined {
    return state.accounts.find(a => a.id === id)
  }
  function getCategoryById(id: number): Category | undefined {
    return state.categories.find(c => c.id === id)
  }

  // ---- Mutations: Transactions ----
  async function addTransaction(tx: Omit<Transaction, 'id'>): Promise<Transaction> {
    const created = await window.electronAPI.addTransaction(tx) as Transaction
    state.transactions.push(created)
    // Refresh accounts (balances changed)
    const accounts = await window.electronAPI.getAccounts() as Account[]
    state.accounts = accounts
    return created
  }

  // ---- Mutations: Physical Assets ----
  async function addPhysicalAsset(asset: Omit<PhysicalAsset, 'id'>): Promise<PhysicalAsset> {
    const created = await window.electronAPI.addPhysicalAsset(asset) as PhysicalAsset
    state.physicalAssets.push(created)
    return created
  }

  async function updatePhysicalAsset(id: number, updates: Partial<PhysicalAsset>): Promise<void> {
    await window.electronAPI.updatePhysicalAsset(id, updates)
    const idx = state.physicalAssets.findIndex(a => a.id === id)
    if (idx !== -1) {
      state.physicalAssets[idx] = { ...state.physicalAssets[idx], ...updates }
    }
  }

  async function deletePhysicalAsset(id: number): Promise<void> {
    await window.electronAPI.deletePhysicalAsset(id)
    const idx = state.physicalAssets.findIndex(a => a.id === id)
    if (idx !== -1) state.physicalAssets.splice(idx, 1)
  }

  return {
    state,
    init,
    assetAccounts,
    liabilityAccounts,
    investmentAccounts,
    totalAssets,
    totalLiabilities,
    netWorth,
    monthlyIncome,
    monthlyExpense,
    assetAllocation,
    liabilityOverview,
    recentTransactions,
    sortedTransactions,
    expenseCategories,
    incomeCategories,
    categoryMonthlySpending,
    investmentPerformance,
    monthlyTrend,
    getAccountById,
    getCategoryById,
    addTransaction,
    addPhysicalAsset,
    updatePhysicalAsset,
    deletePhysicalAsset,
  }
}
