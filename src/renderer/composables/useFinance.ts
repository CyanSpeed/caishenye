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

  // ---- Helper: get last N month keys ----
  function getLastNMonths(n: number): string[] {
    const now = new Date()
    const months: string[] = []
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return months
  }

  // ---- 1. Net Worth Trend (all months with data) ----
  const netWorthTrend = computed(() => {
    // 找到最早交易月份
    const dates = state.transactions.map(t => t.date).filter(Boolean).sort()
    const earliest = dates[0]
    const now = new Date()
    let startMonth: string
    if (earliest) {
      startMonth = earliest.slice(0, 7)
    } else {
      startMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    }

    // 生成从最早月份到当前月份的完整列表
    const months: string[] = []
    const [startY, startM] = startMonth.split('-').map(Number)
    const endY = now.getFullYear()
    const endM = now.getMonth() + 1
    let y = startY, m = startM
    while (y < endY || (y === endY && m <= endM)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`)
      m++
      if (m > 12) { m = 1; y++ }
    }

    // 从当前净资产反推：每月净收支 = 收入 - 支出（不含转账）
    const monthlyNets = months.map(month => {
      const income = state.transactions
        .filter(t => t.type === 'income' && t.date.startsWith(month))
        .reduce((s, t) => s.plus(new Decimal(t.amount)), new Decimal(0))
      const expense = state.transactions
        .filter(t => t.type === 'expense' && t.date.startsWith(month))
        .reduce((s, t) => s.plus(new Decimal(t.amount)), new Decimal(0))
      return income.minus(expense)
    })
    // 从当前净资产开始，逐月回减得到每月末净资产
    const currentNW = netWorth.value
    const len = months.length
    const values: number[] = new Array(len).fill(0)
    values[len - 1] = currentNW.toNumber()
    for (let i = len - 2; i >= 0; i--) {
      values[i] = new Decimal(values[i + 1]).minus(monthlyNets[i + 1]).toNumber()
    }
    return months.map((m, i) => ({ month: m, value: Math.round(values[i]) }))
  })

  // ---- 2. Asset Composition (accounts + physical assets) ----
  const assetComposition = computed(() => {
    // 流动性：现金 + 银行
    let liquidity = new Decimal(0)
    assetAccounts.value
      .filter(a => a.sub_type === 'cash' || a.sub_type === 'bank')
      .forEach(a => { liquidity = liquidity.plus(new Decimal(a.balance)) })

    // 投资性：投资账户
    let investment = new Decimal(0)
    assetAccounts.value
      .filter(a => a.sub_type === 'investment')
      .forEach(a => { investment = investment.plus(new Decimal(a.balance)) })

    // 固定资产：汽车类实物
    let fixed = new Decimal(0)
    state.physicalAssets
      .filter(a => a.status === '使用中' && a.category === '汽车')
      .forEach(a => { fixed = fixed.plus(new Decimal(a.current_value)) })

    // 消费性资产：家电 + 数码 + 奢侈品
    let consumer = new Decimal(0)
    state.physicalAssets
      .filter(a => a.status === '使用中' && a.category !== '汽车')
      .forEach(a => { consumer = consumer.plus(new Decimal(a.current_value)) })

    return [
      { name: '流动性资产', value: liquidity.toNumber(), category: 'liquidity' },
      { name: '投资性资产', value: investment.toNumber(), category: 'investment' },
      { name: '固定资产', value: fixed.toNumber(), category: 'fixed' },
      { name: '消费性资产', value: consumer.toNumber(), category: 'consumer' },
    ].filter(g => g.value > 0)
  })

  // ---- 3. Cash Flow Sankey Data ----
  const cashFlowData = computed(() => {
    const months = getLastNMonths(6)
    // 左侧：收入来源（按分类聚合）
    const incomeByCategory: Record<string, number> = {}
    const expenseByCategory: Record<string, number> = {}

    months.forEach(month => {
      state.transactions
        .filter(t => t.date.startsWith(month))
        .forEach(t => {
          const cat = state.categories.find(c => c.id === t.category_id)
          const catName = cat?.name || (t.type === 'income' ? '其他收入' : '其他支出')
          if (t.type === 'income') {
            incomeByCategory[catName] = (incomeByCategory[catName] || 0) + new Decimal(t.amount).toNumber()
          } else if (t.type === 'expense') {
            expenseByCategory[catName] = (expenseByCategory[catName] || 0) + new Decimal(t.amount).toNumber()
          }
        })
    })

    const incomeNodes = Object.entries(incomeByCategory).map(([name, value]) => ({ name, value }))
    const expenseNodes = Object.entries(expenseByCategory).map(([name, value]) => ({ name, value }))

    // 桑基图链接：收入分类 -> 支出分类，按比例分配
    const totalIncome = incomeNodes.reduce((s, n) => s + n.value, 0)
    const totalExpense = expenseNodes.reduce((s, n) => s + n.value, 0)
    const links: { source: string; target: string; value: number }[] = []

    if (totalIncome > 0 && totalExpense > 0) {
      incomeNodes.forEach(income => {
        expenseNodes.forEach(expense => {
          const ratio = (income.value / totalIncome) * (expense.value / totalExpense)
          const value = Math.round(ratio * Math.min(totalIncome, totalExpense))
          if (value > 0) {
            links.push({ source: income.name, target: expense.name, value })
          }
        })
      })
    }

    return { incomeNodes, expenseNodes, links }
  })

  // ---- 4. Monthly Comparison (12 months) ----
  const monthlyComparison = computed(() => {
    const months = getLastNMonths(12)
    return months.map(month => {
      const income = state.transactions
        .filter(t => t.type === 'income' && t.date.startsWith(month))
        .reduce((s, t) => s.plus(new Decimal(t.amount)), new Decimal(0))
      const expense = state.transactions
        .filter(t => t.type === 'expense' && t.date.startsWith(month))
        .reduce((s, t) => s.plus(new Decimal(t.amount)), new Decimal(0))
      return { month: month.slice(5), income: income.toNumber(), expense: expense.toNumber() }
    })
  })

  // ---- 5. Physical Assets Depreciation Analysis ----
  const DEPRECIATION_YEARS: Record<string, number> = { '家电': 5, '数码': 3, '汽车': 10, '奢侈品': 20, '房产': 40 }
  const RESIDUAL_RATE = 0.05

  const physicalAssetsDepreciation = computed(() => {
    const activeAssets = state.physicalAssets.filter(a => a.status === '使用中')

    const assetsWithCost = activeAssets.map(asset => {
      const purchasePrice = new Decimal(asset.purchase_price)
      const purchaseDate = new Date(asset.purchase_date)
      const now = new Date()
      const daysOwned = Math.max(1, Math.floor((now.getTime() - purchaseDate.getTime()) / 86400000))
      const years = DEPRECIATION_YEARS[asset.category] || 5
      const residualValue = purchasePrice.mul(RESIDUAL_RATE)
      const totalDepreciation = purchasePrice.minus(residualValue)
      const dailyCost = totalDepreciation.div(years * 365)
      const totalDays = years * 365

      // 生成折旧曲线数据点（按月）
      const points: { date: string; value: number }[] = []
      const totalMonths = years * 12
      for (let m = 0; m <= Math.min(totalMonths, 60); m++) {
        const d = new Date(purchaseDate)
        d.setMonth(d.getMonth() + m)
        if (d > now && m > 0) break
        const elapsed = Math.min(m * 30.44, totalDays)
        const depreciated = totalDepreciation.mul(elapsed).div(totalDays)
        const value = purchasePrice.minus(depreciated).toNumber()
        points.push({
          date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          value: Math.max(Math.round(value), Math.round(residualValue.toNumber())),
        })
      }

      return {
        id: asset.id,
        name: asset.name,
        icon: asset.icon_emoji,
        category: asset.category,
        purchasePrice: purchasePrice.toNumber(),
        currentValue: new Decimal(asset.current_value).toNumber(),
        daysOwned,
        dailyCost: dailyCost.toNumber(),
        points,
      }
    })

    // Top 5 by daily cost
    return assetsWithCost.sort((a, b) => b.dailyCost - a.dailyCost).slice(0, 5)
  })

  // ---- All Physical Assets Depreciation (for asset selector) ----
  const allPhysicalAssetsDepreciation = computed(() => {
    const activeAssets = state.physicalAssets.filter(a => a.status === '使用中')
    return activeAssets.map(asset => {
      const purchasePrice = new Decimal(asset.purchase_price)
      const purchaseDate = new Date(asset.purchase_date)
      const now = new Date()
      const daysOwned = Math.max(1, Math.floor((now.getTime() - purchaseDate.getTime()) / 86400000))
      const years = DEPRECIATION_YEARS[asset.category] || 5
      const residualValue = purchasePrice.mul(RESIDUAL_RATE)
      const totalDepreciation = purchasePrice.minus(residualValue)
      const dailyCost = totalDepreciation.div(years * 365)
      const totalDays = years * 365
      const totalMonths = years * 12
      const points: { date: string; value: number }[] = []
      for (let m = 0; m <= Math.min(totalMonths, 60); m++) {
        const d = new Date(purchaseDate)
        d.setMonth(d.getMonth() + m)
        if (d > now && m > 0) break
        const elapsed = Math.min(m * 30.44, totalDays)
        const depreciated = totalDepreciation.mul(elapsed).div(totalDays)
        const value = purchasePrice.minus(depreciated).toNumber()
        points.push({
          date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          value: Math.max(Math.round(value), Math.round(residualValue.toNumber())),
        })
      }
      return {
        id: asset.id,
        name: asset.name,
        icon: asset.icon_emoji,
        category: asset.category,
        purchasePrice: purchasePrice.toNumber(),
        currentValue: new Decimal(asset.current_value).toNumber(),
        daysOwned,
        dailyCost: dailyCost.toNumber(),
        points,
      }
    }).sort((a, b) => b.dailyCost - a.dailyCost)
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
    netWorthTrend,
    assetComposition,
    cashFlowData,
    monthlyComparison,
    physicalAssetsDepreciation,
    allPhysicalAssetsDepreciation,
    getAccountById,
    getCategoryById,
    addTransaction,
    addPhysicalAsset,
    updatePhysicalAsset,
    deletePhysicalAsset,
  }
}
