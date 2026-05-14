import { reactive, computed } from 'vue'
import Decimal from 'decimal.js'
import { mockAccounts, mockTransactions, mockSnapshots, mockCategories } from '../../mock/data'
import type { Account, Transaction, InvestmentSnapshot, Category } from '@shared/types'

interface FinanceState {
  accounts: Account[]
  transactions: Transaction[]
  snapshots: InvestmentSnapshot[]
  categories: Category[]
}

const state = reactive<FinanceState>({
  accounts: mockAccounts.map(a => ({ ...a })),
  transactions: mockTransactions.map(t => ({ ...t })),
  snapshots: mockSnapshots.map(s => ({ ...s })),
  categories: mockCategories.map(c => ({ ...c })),
})

export function useFinance() {
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
  const currentMonth = new Date().toISOString().slice(0, 7) // "2026-05"

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

  // ---- Mutations (for later SQLite integration) ----
  function addTransaction(tx: Transaction) {
    state.transactions.push(tx)
  }

  return {
    state,
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
  }
}
