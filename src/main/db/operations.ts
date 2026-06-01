import Decimal from 'decimal.js'
import { getDatabase } from './init'
import type {
  Account, Transaction, InvestmentSnapshot, Category, PhysicalAsset,
  Settings, NetWorthSnapshot, FamilyInfo, QuarterlyReportData,
  BalanceSheetItem, IncomeExpenseItem, CashFlowItem, KPIData,
  BalanceSnapshot,
} from '@shared/types'

// ===== Accounts =====

export function getAllAccounts(): Account[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM accounts ORDER BY id').all() as any[]
  return rows.map(r => ({ ...r, is_active: !!r.is_active }))
}

export function addAccount(account: Omit<Account, 'id'>): Account {
  const db = getDatabase()
  const result = db.prepare(
    'INSERT INTO accounts (name, type, sub_type, balance, currency, is_active, notes, original_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(account.name, account.type, account.sub_type, account.balance, account.currency, account.is_active ? 1 : 0, account.notes || '', account.original_amount || '')
  return { ...account, id: Number(result.lastInsertRowid) }
}

export function updateAccount(id: number, updates: Partial<Account>): void {
  const db = getDatabase()
  const fields: string[] = []
  const values: any[] = []
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name) }
  if (updates.type !== undefined) { fields.push('type = ?'); values.push(updates.type) }
  if (updates.sub_type !== undefined) { fields.push('sub_type = ?'); values.push(updates.sub_type) }
  if (updates.balance !== undefined) { fields.push('balance = ?'); values.push(updates.balance) }
  if (updates.currency !== undefined) { fields.push('currency = ?'); values.push(updates.currency) }
  if (updates.is_active !== undefined) { fields.push('is_active = ?'); values.push(updates.is_active ? 1 : 0) }
  if (updates.notes !== undefined) { fields.push('notes = ?'); values.push(updates.notes) }
  if (updates.original_amount !== undefined) { fields.push('original_amount = ?'); values.push(updates.original_amount) }
  if (fields.length === 0) return
  values.push(id)
  db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}

export function deleteAccount(id: number): void {
  const db = getDatabase()
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
}

// ===== Balance Sync =====

export interface SyncBalanceParams {
  account_id: number
  new_balance: string
  diff_handling: 'expense' | 'income' | 'ignore'
  note?: string
}

export function syncBalance(params: SyncBalanceParams): { account: Account; snapshot: BalanceSnapshot } {
  const db = getDatabase()

  const syncInTransaction = db.transaction(() => {
    // 获取账户当前余额
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(params.account_id) as any
    if (!account) throw new Error('Account not found')

    const oldBalance = account.balance
    const newBalance = params.new_balance
    const diff = new Decimal(newBalance).minus(new Decimal(oldBalance)).toFixed(2)

    // 更新账户余额和同步时间
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    db.prepare('UPDATE accounts SET balance = ?, last_synced_at = ? WHERE id = ?').run(newBalance, now, params.account_id)

    // 记录快照
    const snapshotResult = db.prepare(
      'INSERT INTO balance_snapshots (account_id, date, old_balance, new_balance, diff, diff_handling, note) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      params.account_id,
      now,
      oldBalance,
      newBalance,
      diff,
      params.diff_handling,
      params.note || ''
    )

    // 如果差额需要记为收入或支出，创建交易记录
    if (params.diff_handling !== 'ignore' && diff !== '0.00') {
      const absDiff = new Decimal(diff).abs().toFixed(2)
      const txType = params.diff_handling === 'income' ? 'income' : 'expense'

      // 根据账户类型决定 from_account_id 或 to_account_id
      if (account.type === 'asset') {
        if (txType === 'income') {
          db.prepare(
            'INSERT INTO transactions (date, type, amount, from_account_id, to_account_id, category_id, description, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(now.slice(0, 10), 'income', absDiff, null, params.account_id, null, params.note || '余额同步差额', '["余额同步"]')
        } else {
          db.prepare(
            'INSERT INTO transactions (date, type, amount, from_account_id, to_account_id, category_id, description, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(now.slice(0, 10), 'expense', absDiff, params.account_id, null, null, params.note || '余额同步差额', '["余额同步"]')
        }
      } else {
        // 负债账户
        if (txType === 'income') {
          db.prepare(
            'INSERT INTO transactions (date, type, amount, from_account_id, to_account_id, category_id, description, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(now.slice(0, 10), 'income', absDiff, null, null, null, params.note || '余额同步差额', '["余额同步"]')
        } else {
          db.prepare(
            'INSERT INTO transactions (date, type, amount, from_account_id, to_account_id, category_id, description, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(now.slice(0, 10), 'expense', absDiff, null, null, null, params.note || '余额同步差额', '["余额同步"]')
        }
      }
    }

    return {
      account: { ...account, balance: newBalance, last_synced_at: now, is_active: !!account.is_active },
      snapshot: {
        id: Number(snapshotResult.lastInsertRowid),
        account_id: params.account_id,
        date: now,
        old_balance: oldBalance,
        new_balance: newBalance,
        diff,
        diff_handling: params.diff_handling,
        note: params.note || '',
      }
    }
  })

  return syncInTransaction()
}

export function getBalanceSnapshots(accountId: number): BalanceSnapshot[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM balance_snapshots WHERE account_id = ? ORDER BY date DESC').all(accountId) as BalanceSnapshot[]
}

// ===== Categories =====

export function getAllCategories(): Category[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM categories ORDER BY id').all() as Category[]
}

// ===== Transactions =====

export function getAllTransactions(): Transaction[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM transactions ORDER BY date DESC, id DESC').all() as Transaction[]
}

/** 检查账户是否为精确同步模式（需要自动更新余额） */
function isExactSync(db: Database.Database, accountId: number | null | undefined): boolean {
  if (!accountId) return false
  const account = db.prepare('SELECT sync_mode FROM accounts WHERE id = ?').get(accountId) as { sync_mode: string } | undefined
  return account?.sync_mode === 'exact'
}

export function addTransaction(tx: Omit<Transaction, 'id'>): Transaction {
  const db = getDatabase()

  const insertAndBalance = db.transaction(() => {
    const result = db.prepare(
      'INSERT INTO transactions (date, type, amount, from_account_id, to_account_id, category_id, description, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(tx.date, tx.type, tx.amount, tx.from_account_id, tx.to_account_id, tx.category_id, tx.description, tx.tags)

    const amount = new Decimal(tx.amount)

    // 仅精确同步的账户才自动更新余额
    if (tx.type === 'expense' && tx.from_account_id && isExactSync(db, tx.from_account_id)) {
      const account = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(tx.from_account_id) as { balance: string } | undefined
      if (account) {
        const newBalance = new Decimal(account.balance).minus(amount).toFixed(2)
        db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(newBalance, tx.from_account_id)
      }
    } else if (tx.type === 'income' && tx.to_account_id && isExactSync(db, tx.to_account_id)) {
      const account = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(tx.to_account_id) as { balance: string } | undefined
      if (account) {
        const newBalance = new Decimal(account.balance).plus(amount).toFixed(2)
        db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(newBalance, tx.to_account_id)
      }
    } else if (tx.type === 'transfer') {
      if (tx.from_account_id && isExactSync(db, tx.from_account_id)) {
        const from = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(tx.from_account_id) as { balance: string } | undefined
        if (from) {
          db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(new Decimal(from.balance).minus(amount).toFixed(2), tx.from_account_id)
        }
      }
      if (tx.to_account_id && isExactSync(db, tx.to_account_id)) {
        const to = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(tx.to_account_id) as { balance: string } | undefined
        if (to) {
          db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(new Decimal(to.balance).plus(amount).toFixed(2), tx.to_account_id)
        }
      }
    }

    return { ...tx, id: Number(result.lastInsertRowid) }
  })

  return insertAndBalance()
}

export function updateTransaction(id: number, updates: Partial<Transaction>): Transaction {
  const db = getDatabase()

  const updateAndRebalance = db.transaction(() => {
    // 获取原始交易
    const oldTx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Transaction | undefined
    if (!oldTx) throw new Error('Transaction not found')

    const oldAmount = new Decimal(oldTx.amount)

    // 撤销原交易的余额影响（仅精确同步账户）
    if (oldTx.type === 'expense' && oldTx.from_account_id && isExactSync(db, oldTx.from_account_id)) {
      const account = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(oldTx.from_account_id) as { balance: string } | undefined
      if (account) {
        db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(new Decimal(account.balance).plus(oldAmount).toFixed(2), oldTx.from_account_id)
      }
    } else if (oldTx.type === 'income' && oldTx.to_account_id && isExactSync(db, oldTx.to_account_id)) {
      const account = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(oldTx.to_account_id) as { balance: string } | undefined
      if (account) {
        db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(new Decimal(account.balance).minus(oldAmount).toFixed(2), oldTx.to_account_id)
      }
    } else if (oldTx.type === 'transfer') {
      if (oldTx.from_account_id && isExactSync(db, oldTx.from_account_id)) {
        const from = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(oldTx.from_account_id) as { balance: string } | undefined
        if (from) {
          db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(new Decimal(from.balance).plus(oldAmount).toFixed(2), oldTx.from_account_id)
        }
      }
      if (oldTx.to_account_id && isExactSync(db, oldTx.to_account_id)) {
        const to = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(oldTx.to_account_id) as { balance: string } | undefined
        if (to) {
          db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(new Decimal(to.balance).minus(oldAmount).toFixed(2), oldTx.to_account_id)
        }
      }
    }

    // 更新交易记录
    const fields: string[] = []
    const values: any[] = []
    if (updates.date !== undefined) { fields.push('date = ?'); values.push(updates.date) }
    if (updates.type !== undefined) { fields.push('type = ?'); values.push(updates.type) }
    if (updates.amount !== undefined) { fields.push('amount = ?'); values.push(updates.amount) }
    if (updates.from_account_id !== undefined) { fields.push('from_account_id = ?'); values.push(updates.from_account_id) }
    if (updates.to_account_id !== undefined) { fields.push('to_account_id = ?'); values.push(updates.to_account_id) }
    if (updates.category_id !== undefined) { fields.push('category_id = ?'); values.push(updates.category_id) }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description) }
    if (updates.tags !== undefined) { fields.push('tags = ?'); values.push(updates.tags) }

    if (fields.length > 0) {
      values.push(id)
      db.prepare(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    }

    // 获取更新后的交易
    const newTx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Transaction
    const newAmount = new Decimal(newTx.amount)

    // 应用新交易的余额影响（仅精确同步账户）
    if (newTx.type === 'expense' && newTx.from_account_id && isExactSync(db, newTx.from_account_id)) {
      const account = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(newTx.from_account_id) as { balance: string } | undefined
      if (account) {
        db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(new Decimal(account.balance).minus(newAmount).toFixed(2), newTx.from_account_id)
      }
    } else if (newTx.type === 'income' && newTx.to_account_id && isExactSync(db, newTx.to_account_id)) {
      const account = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(newTx.to_account_id) as { balance: string } | undefined
      if (account) {
        db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(new Decimal(account.balance).plus(newAmount).toFixed(2), newTx.to_account_id)
      }
    } else if (newTx.type === 'transfer') {
      if (newTx.from_account_id && isExactSync(db, newTx.from_account_id)) {
        const from = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(newTx.from_account_id) as { balance: string } | undefined
        if (from) {
          db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(new Decimal(from.balance).minus(newAmount).toFixed(2), newTx.from_account_id)
        }
      }
      if (newTx.to_account_id && isExactSync(db, newTx.to_account_id)) {
        const to = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(newTx.to_account_id) as { balance: string } | undefined
        if (to) {
          db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(new Decimal(to.balance).plus(newAmount).toFixed(2), newTx.to_account_id)
        }
      }
    }

    return newTx
  })

  return updateAndRebalance()
}

export function deleteTransaction(id: number): void {
  const db = getDatabase()

  const deleteAndReverse = db.transaction(() => {
    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Transaction | undefined
    if (!tx) return

    const amount = new Decimal(tx.amount)

    // 撤销余额影响（仅精确同步账户）
    if (tx.type === 'expense' && tx.from_account_id && isExactSync(db, tx.from_account_id)) {
      const account = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(tx.from_account_id) as { balance: string } | undefined
      if (account) {
        db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(new Decimal(account.balance).plus(amount).toFixed(2), tx.from_account_id)
      }
    } else if (tx.type === 'income' && tx.to_account_id && isExactSync(db, tx.to_account_id)) {
      const account = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(tx.to_account_id) as { balance: string } | undefined
      if (account) {
        db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(new Decimal(account.balance).minus(amount).toFixed(2), tx.to_account_id)
      }
    } else if (tx.type === 'transfer') {
      if (tx.from_account_id && isExactSync(db, tx.from_account_id)) {
        const from = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(tx.from_account_id) as { balance: string } | undefined
        if (from) {
          db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(new Decimal(from.balance).plus(amount).toFixed(2), tx.from_account_id)
        }
      }
      if (tx.to_account_id && isExactSync(db, tx.to_account_id)) {
        const to = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(tx.to_account_id) as { balance: string } | undefined
        if (to) {
          db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(new Decimal(to.balance).minus(amount).toFixed(2), tx.to_account_id)
        }
      }
    }

    db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
  })

  deleteAndReverse()
}

// ===== Investment Snapshots =====

export function getAllInvestmentSnapshots(): InvestmentSnapshot[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM investment_snapshots ORDER BY date DESC').all() as InvestmentSnapshot[]
}

export function addInvestmentSnapshot(snapshot: Omit<InvestmentSnapshot, 'id'>): InvestmentSnapshot {
  const db = getDatabase()
  const result = db.prepare(
    'INSERT INTO investment_snapshots (account_id, date, market_value, cost_basis, note) VALUES (?, ?, ?, ?, ?)'
  ).run(snapshot.account_id, snapshot.date, snapshot.market_value, snapshot.cost_basis, snapshot.note)
  return { ...snapshot, id: Number(result.lastInsertRowid) }
}

export function updateInvestmentSnapshot(id: number, updates: Partial<InvestmentSnapshot>): void {
  const db = getDatabase()
  const fields: string[] = []
  const values: any[] = []
  if (updates.account_id !== undefined) { fields.push('account_id = ?'); values.push(updates.account_id) }
  if (updates.date !== undefined) { fields.push('date = ?'); values.push(updates.date) }
  if (updates.market_value !== undefined) { fields.push('market_value = ?'); values.push(updates.market_value) }
  if (updates.cost_basis !== undefined) { fields.push('cost_basis = ?'); values.push(updates.cost_basis) }
  if (updates.note !== undefined) { fields.push('note = ?'); values.push(updates.note) }
  if (fields.length === 0) return
  values.push(id)
  db.prepare(`UPDATE investment_snapshots SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}

// ===== Physical Assets =====

export function getAllPhysicalAssets(): PhysicalAsset[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM physical_assets ORDER BY id').all() as PhysicalAsset[]
}

export function addPhysicalAsset(asset: Omit<PhysicalAsset, 'id'>): PhysicalAsset {
  const db = getDatabase()
  const result = db.prepare(
    'INSERT INTO physical_assets (name, category, icon_emoji, purchase_price, purchase_date, current_value, image_url, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(asset.name, asset.category, asset.icon_emoji, asset.purchase_price, asset.purchase_date, asset.current_value, asset.image_url, asset.notes, asset.status)
  return { ...asset, id: Number(result.lastInsertRowid) }
}

export function updatePhysicalAsset(id: number, updates: Partial<PhysicalAsset>): void {
  const db = getDatabase()
  const fields: string[] = []
  const values: any[] = []
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name) }
  if (updates.category !== undefined) { fields.push('category = ?'); values.push(updates.category) }
  if (updates.icon_emoji !== undefined) { fields.push('icon_emoji = ?'); values.push(updates.icon_emoji) }
  if (updates.purchase_price !== undefined) { fields.push('purchase_price = ?'); values.push(updates.purchase_price) }
  if (updates.purchase_date !== undefined) { fields.push('purchase_date = ?'); values.push(updates.purchase_date) }
  if (updates.current_value !== undefined) { fields.push('current_value = ?'); values.push(updates.current_value) }
  if (updates.image_url !== undefined) { fields.push('image_url = ?'); values.push(updates.image_url) }
  if (updates.notes !== undefined) { fields.push('notes = ?'); values.push(updates.notes) }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status) }
  if (fields.length === 0) return
  values.push(id)
  db.prepare(`UPDATE physical_assets SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}

export function deletePhysicalAsset(id: number): void {
  const db = getDatabase()
  db.prepare('DELETE FROM physical_assets WHERE id = ?').run(id)
}

// ===== Settings =====

export function getAllSettings(): Settings[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM settings ORDER BY key').all() as Settings[]
}

export function getSetting(key: string): string | null {
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row ? row.value : null
}

export function updateSetting(key: string, value: string): void {
  const db = getDatabase()
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}

// ===== Net Worth Snapshots =====

export function getAllNetWorthSnapshots(): NetWorthSnapshot[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM net_worth_snapshots ORDER BY date').all() as NetWorthSnapshot[]
}

export function addNetWorthSnapshot(snapshot: Omit<NetWorthSnapshot, 'id'>): NetWorthSnapshot {
  const db = getDatabase()
  const result = db.prepare(
    'INSERT INTO net_worth_snapshots (date, total_assets, total_liabilities, net_worth) VALUES (?, ?, ?, ?)'
  ).run(snapshot.date, snapshot.total_assets, snapshot.total_liabilities, snapshot.net_worth)
  return { ...snapshot, id: Number(result.lastInsertRowid) }
}

// ===== Quarterly Report Generation =====

/** 获取季度日期范围 */
function getQuarterRange(year: number, quarter: number): { start: string; end: string; label: string; dateRange: string } {
  const startMonth = (quarter - 1) * 3 + 1
  const endMonth = quarter * 3
  const start = `${year}-${String(startMonth).padStart(2, '0')}-01`
  const lastDay = new Date(year, endMonth, 0).getDate()
  const end = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const quarterNames = ['', '第一季度', '第二季度', '第三季度', '第四季度']
  const label = `${year}年${quarterNames[quarter]}`
  const dateRange = `${startMonth}月1日 — ${endMonth}月${lastDay}日`
  return { start, end, label, dateRange }
}

/** 获取上一个季度 */
function getPrevQuarter(year: number, quarter: number): { year: number; quarter: number } {
  if (quarter === 1) return { year: year - 1, quarter: 4 }
  return { year, quarter: quarter - 1 }
}

export function generateQuarterlyReport(year: number, quarter: number): QuarterlyReportData {
  const db = getDatabase()
  const range = getQuarterRange(year, quarter)
  const prevQ = getPrevQuarter(year, quarter)
  const prevRange = getQuarterRange(prevQ.year, prevQ.quarter)

  // 查询基础数据
  const accounts = db.prepare('SELECT * FROM accounts WHERE is_active = 1').all() as any[]
  const categories = db.prepare('SELECT * FROM categories').all() as Category[]
  const physicalAssets = db.prepare("SELECT * FROM physical_assets WHERE status = '使用中'").all() as any[]

  // 当季交易
  const quarterTransactions = db.prepare(
    'SELECT * FROM transactions WHERE date >= ? AND date <= ?'
  ).all(range.start, range.end) as Transaction[]

  // 净资产快照
  const snapshots = db.prepare('SELECT * FROM net_worth_snapshots ORDER BY date').all() as NetWorthSnapshot[]

  // 家庭信息
  let familyInfo: FamilyInfo = {
    familyName: '家庭',
    members: [],
    city: '',
    preparer: '',
    reviewer: '',
  }
  const infoStr = getSetting('family_info')
  if (infoStr) {
    try { familyInfo = JSON.parse(infoStr) } catch { /* 忽略 */ }
  }

  // ===== 资产分类计算 =====
  const assetAccounts = accounts.filter((a: any) => a.type === 'asset')
  const liabilityAccounts = accounts.filter((a: any) => a.type === 'liability')

  // 流动资产：cash + bank
  const liquidAccounts = assetAccounts.filter((a: any) => a.sub_type === 'cash' || a.sub_type === 'bank')
  const liquidTotal = liquidAccounts.reduce((s: number, a: any) => s + Number(a.balance), 0)

  // 投资资产：investment
  const investmentAccounts = assetAccounts.filter((a: any) => a.sub_type === 'investment')
  const investmentTotal = investmentAccounts.reduce((s: number, a: any) => s + Number(a.balance), 0)

  // 固定资产：实物资产中的房产和汽车
  const fixedAssets = physicalAssets.filter((a: any) => a.category === '房产' || a.category === '汽车')
  const fixedTotal = fixedAssets.reduce((s: number, a: any) => s + Number(a.current_value), 0)

  const totalAssets = liquidTotal + investmentTotal + fixedTotal

  // 负债
  const shortTermLiabilities = liabilityAccounts.filter((a: any) => a.sub_type === 'credit')
  const shortTermTotal = shortTermLiabilities.reduce((s: number, a: any) => s + Number(a.balance), 0)
  const longTermLiabilities = liabilityAccounts.filter((a: any) => a.sub_type === 'loan')
  const longTermTotal = longTermLiabilities.reduce((s: number, a: any) => s + Number(a.balance), 0)
  const totalLiabilities = shortTermTotal + longTermTotal

  // 构建资产负债表项
  const mapAccountToItem = (acc: any, total: number): BalanceSheetItem => ({
    name: acc.name,
    amount: Number(acc.balance),
    percentage: total > 0 ? Math.round(Number(acc.balance) / total * 1000) / 10 : 0,
    note: acc.notes || '',
  })

  // 固定资产明细
  const fixedItems: BalanceSheetItem[] = fixedAssets.map((a: any) => ({
    name: a.name,
    amount: Number(a.current_value),
    percentage: totalAssets > 0 ? Math.round(Number(a.current_value) / totalAssets * 1000) / 10 : 0,
    note: a.notes || '',
  }))
  if (fixedItems.length === 0) {
    fixedItems.push({ name: '实物资产', amount: 0, percentage: 0, note: '暂无' })
  }

  // ===== 收支计算 =====
  const catMap = new Map<number, Category>()
  categories.forEach(c => catMap.set(c.id, c))

  const incomeTx = quarterTransactions.filter(t => t.type === 'income')
  const expenseTx = quarterTransactions.filter(t => t.type === 'expense')

  // 收入按分类聚合
  const incomeByCategory = new Map<string, number>()
  incomeTx.forEach(t => {
    const cat = catMap.get(t.category_id ?? -1)
    const name = cat?.name || '其他收入'
    incomeByCategory.set(name, (incomeByCategory.get(name) || 0) + Number(t.amount))
  })
  const totalIncome = incomeTx.reduce((s, t) => s + Number(t.amount), 0)

  const incomeItems: IncomeExpenseItem[] = Array.from(incomeByCategory.entries())
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: totalIncome > 0 ? Math.round(amount / totalIncome * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  // 支出按分类聚合，区分固定/弹性
  const expenseFixedByCategory = new Map<string, number>()
  const expenseVariableByCategory = new Map<string, number>()
  expenseTx.forEach(t => {
    const cat = catMap.get(t.category_id ?? -1)
    const name = cat?.name || '其他支出'
    if (cat?.expense_nature === 'fixed') {
      expenseFixedByCategory.set(name, (expenseFixedByCategory.get(name) || 0) + Number(t.amount))
    } else {
      expenseVariableByCategory.set(name, (expenseVariableByCategory.get(name) || 0) + Number(t.amount))
    }
  })
  const totalExpense = expenseTx.reduce((s, t) => s + Number(t.amount), 0)
  const fixedExpenseTotal = Array.from(expenseFixedByCategory.values()).reduce((s, v) => s + v, 0)
  const variableExpenseTotal = Array.from(expenseVariableByCategory.values()).reduce((s, v) => s + v, 0)

  const mapToItems = (map: Map<string, number>, total: number): IncomeExpenseItem[] =>
    Array.from(map.entries())
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: total > 0 ? Math.round(amount / total * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)

  // ===== 现金流计算 =====
  const getCashflowItems = (cfType: string): CashFlowItem[] => {
    const items: CashFlowItem[] = []
    const matched = quarterTransactions.filter(t => {
      if (t.type === 'transfer') return false
      const cat = catMap.get(t.category_id ?? -1)
      return cat?.cashflow_type === cfType
    })

    const byCategory = new Map<string, { amount: number; isIncome: boolean }>()
    matched.forEach(t => {
      const cat = catMap.get(t.category_id ?? -1)
      const name = cat?.name || '其他'
      const existing = byCategory.get(name) || { amount: 0, isIncome: t.type === 'income' }
      existing.amount += Number(t.amount)
      byCategory.set(name, existing)
    })

    byCategory.forEach((v, name) => {
      items.push({
        name,
        amount: v.isIncome ? v.amount : -v.amount,
        note: v.isIncome ? '收入' : '支出',
      })
    })
    return items.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
  }

  const operatingItems = getCashflowItems('operating')
  const investingItems = getCashflowItems('investing')
  const financingItems = getCashflowItems('financing')

  const operatingTotal = operatingItems.reduce((s, i) => s + i.amount, 0)
  const investingTotal = investingItems.reduce((s, i) => s + i.amount, 0)
  const financingTotal = financingItems.reduce((s, i) => s + i.amount, 0)

  // ===== 季度对比（上季数据）=====
  // 上季净资产快照
  const prevSnapshot = snapshots.find(s => s.date <= prevRange.end)
  const currentSnapshot = snapshots.find(s => s.date <= range.end)
  const prevNetWorth = prevSnapshot ? Number(prevSnapshot.net_worth) : 0
  const currentNetWorth = currentSnapshot ? Number(currentSnapshot.net_worth) : (totalAssets - totalLiabilities)
  const prevTotalAssets = prevSnapshot ? Number(prevSnapshot.total_assets) : 0
  const prevTotalLiabilities = prevSnapshot ? Number(prevSnapshot.total_liabilities) : 0

  const pctChange = (current: number, prev: number): number => {
    if (prev === 0) return 0
    return Math.round((current - prev) / Math.abs(prev) * 1000) / 10
  }

  // 储蓄计算：优先使用净资产变动（更准确），回退到收支差额
  const netWorthChange = currentNetWorth - prevNetWorth
  const netSavingsFromTx = totalIncome - totalExpense
  // 使用净资产变动作为实际储蓄，因为它包含了所有资金流动
  const netSavings = netWorthChange !== 0 ? netWorthChange : netSavingsFromTx
  // 储蓄率基于净资产变动
  const savingsRate = totalIncome > 0 ? Math.round(netSavings / totalIncome * 1000) / 10 : 0

  // ===== KPI 计算 =====
  const monthlyExpense = totalExpense / 3
  const monthlyIncome = totalIncome / 3
  const liquidForKPI = liquidTotal + investmentTotal * 0.3

  // 房贷月供
  const mortgageTx = expenseTx.filter(t => {
    const cat = catMap.get(t.category_id ?? -1)
    return cat?.name === '房贷还款'
  })
  const mortgageMonthly = mortgageTx.length > 0
    ? mortgageTx.reduce((s, t) => s + Number(t.amount), 0) / 3
    : 6500

  const kpis: KPIData[] = [
    {
      name: '资产负债率',
      formula: '总负债 / 总资产',
      value: totalAssets > 0 ? Math.round(totalLiabilities / totalAssets * 1000) / 10 : 0,
      displayValue: totalAssets > 0 ? `${(totalLiabilities / totalAssets * 100).toFixed(1)}%` : '0%',
      status: totalLiabilities / totalAssets < 0.5 ? 'good' : totalLiabilities / totalAssets < 0.6 ? 'warn' : 'bad',
      verdict: totalLiabilities / totalAssets < 0.5
        ? '✅ 健康 — 低于50%安全线，杠杆适中'
        : totalLiabilities / totalAssets < 0.6
          ? '⚠️ 偏高 — 接近60%警戒线，需关注'
          : '🔴 过高 — 超过60%警戒线，风险较大',
      barPercentage: Math.min(totalLiabilities / totalAssets * 100, 100),
    },
    {
      name: '储蓄率',
      formula: '净结余 / 总收入',
      value: savingsRate,
      displayValue: `${savingsRate}%`,
      status: savingsRate >= 30 ? 'good' : savingsRate >= 20 ? 'warn' : 'bad',
      verdict: savingsRate >= 30
        ? '✅ 优秀 — 超过30%基准，储蓄能力良好'
        : savingsRate >= 20
          ? '⚠️ 一般 — 低于30%目标，有提升空间'
          : '🔴 偏低 — 低于20%，需控制支出',
      barPercentage: Math.min(savingsRate, 100),
    },
    {
      name: '紧急备用金',
      formula: '流动资产 / 月均支出',
      value: monthlyExpense > 0 ? Math.round(liquidForKPI / monthlyExpense * 10) / 10 : 0,
      displayValue: monthlyExpense > 0 ? `${(liquidForKPI / monthlyExpense).toFixed(1)} 个月` : '—',
      status: liquidForKPI / monthlyExpense >= 6 ? 'good' : liquidForKPI / monthlyExpense >= 3 ? 'warn' : 'bad',
      verdict: liquidForKPI / monthlyExpense >= 6
        ? '✅ 充裕 — 超过6个月安全底线'
        : liquidForKPI / monthlyExpense >= 3
          ? '⚠️ 偏低 — 建议至少储备6个月支出'
          : '🔴 不足 — 低于3个月，风险较高',
      barPercentage: Math.min(liquidForKPI / monthlyExpense / 18 * 100, 100),
    },
    {
      name: '房贷收入比',
      formula: '月供 / 月收入',
      value: monthlyIncome > 0 ? Math.round(mortgageMonthly / monthlyIncome * 1000) / 10 : 0,
      displayValue: monthlyIncome > 0 ? `${(mortgageMonthly / monthlyIncome * 100).toFixed(1)}%` : '—',
      status: mortgageMonthly / monthlyIncome < 0.3 ? 'good' : mortgageMonthly / monthlyIncome < 0.4 ? 'warn' : 'bad',
      verdict: mortgageMonthly / monthlyIncome < 0.3
        ? '✅ 健康 — 低于30%安全线'
        : mortgageMonthly / monthlyIncome < 0.4
          ? '⚠️ 偏高 — 接近40%警戒线，需关注'
          : '🔴 过高 — 超过40%，还款压力大',
      barPercentage: Math.min(mortgageMonthly / monthlyIncome * 100, 100),
    },
    {
      name: '投资资产占比',
      formula: '投资资产 / 总资产',
      value: totalAssets > 0 ? Math.round(investmentTotal / totalAssets * 1000) / 10 : 0,
      displayValue: totalAssets > 0 ? `${(investmentTotal / totalAssets * 100).toFixed(1)}%` : '0%',
      status: investmentTotal / totalAssets >= 0.2 ? 'good' : investmentTotal / totalAssets >= 0.1 ? 'warn' : 'bad',
      verdict: investmentTotal / totalAssets >= 0.2
        ? '✅ 良好 — 投资资产占比达标'
        : investmentTotal / totalAssets >= 0.1
          ? '⚠️ 偏低 — 资产过度集中于固定资产'
          : '🔴 不足 — 投资资产占比过低',
      barPercentage: Math.min(investmentTotal / totalAssets * 100, 100),
    },
    {
      name: '净资产增长率',
      formula: '(本季净资产 - 上季净资产) / 上季净资产',
      value: prevNetWorth !== 0 ? Math.round((currentNetWorth - prevNetWorth) / Math.abs(prevNetWorth) * 1000) / 10 : 0,
      displayValue: prevNetWorth !== 0
        ? `${((currentNetWorth - prevNetWorth) / Math.abs(prevNetWorth) * 100).toFixed(1)}%`
        : '—',
      status: (currentNetWorth - prevNetWorth) / Math.abs(prevNetWorth || 1) > 0.03 ? 'good'
        : (currentNetWorth - prevNetWorth) / Math.abs(prevNetWorth || 1) > 0 ? 'warn' : 'bad',
      verdict: (currentNetWorth - prevNetWorth) / Math.abs(prevNetWorth || 1) > 0.03
        ? '✅ 良好 — 年化增长可观'
        : (currentNetWorth - prevNetWorth) / Math.abs(prevNetWorth || 1) > 0
          ? '⚠️ 一般 — 增长较慢'
          : '🔴 下降 — 净资产减少，需关注',
      barPercentage: Math.min(Math.abs((currentNetWorth - prevNetWorth) / (prevNetWorth || 1)) * 100, 100),
    },
  ]

  // ===== 资产结构分析 =====
  const assetComposition = [
    { name: '🏠 固定资产', value: fixedTotal, percentage: totalAssets > 0 ? Math.round(fixedTotal / totalAssets * 1000) / 10 : 0 },
    { name: '💰 流动资产', value: liquidTotal, percentage: totalAssets > 0 ? Math.round(liquidTotal / totalAssets * 1000) / 10 : 0 },
    { name: '📈 投资资产', value: investmentTotal, percentage: totalAssets > 0 ? Math.round(investmentTotal / totalAssets * 1000) / 10 : 0 },
  ].filter(a => a.value > 0)

  const expenseComposition = Array.from(
    [...expenseFixedByCategory, ...expenseVariableByCategory].reduce((map, [name, amount]) => {
      map.set(name, (map.get(name) || 0) + amount)
      return map
    }, new Map<string, number>()).entries()
  )
    .map(([name, amount]) => ({
      name,
      value: amount,
      percentage: totalExpense > 0 ? Math.round(amount / totalExpense * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.value - a.value)

  // ===== 组装报表 =====
  return {
    meta: {
      familyName: familyInfo.familyName,
      members: familyInfo.members,
      city: familyInfo.city,
      preparer: familyInfo.preparer,
      reviewer: familyInfo.reviewer,
      year,
      quarter,
      quarterLabel: range.label,
      dateRange: range.dateRange,
      generatedAt: new Date().toISOString(),
      dataNote: '资产负债数据基于账户余额（准确），收支数据基于已记录交易（可能有遗漏）',
    },
    summary: {
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
      quarterlyNetSavings: netSavings,
      savingsRate,
      totalAssetsChange: pctChange(totalAssets, prevTotalAssets),
      totalLiabilitiesChange: pctChange(totalLiabilities, prevTotalLiabilities),
      netWorthChange: pctChange(currentNetWorth, prevNetWorth),
    },
    balanceSheet: {
      assets: {
        liquid: liquidAccounts.map((a: any) => mapAccountToItem(a, totalAssets)),
        investment: investmentAccounts.map((a: any) => mapAccountToItem(a, totalAssets)),
        fixed: fixedItems,
        liquidTotal,
        investmentTotal,
        fixedTotal,
        grandTotal: totalAssets,
      },
      liabilities: {
        shortTerm: shortTermLiabilities.map((a: any) => mapAccountToItem(a, totalLiabilities)),
        longTerm: longTermLiabilities.map((a: any) => mapAccountToItem(a, totalLiabilities)),
        shortTermTotal,
        longTermTotal,
        grandTotal: totalLiabilities,
      },
    },
    incomeStatement: {
      income: {
        categories: incomeItems,
        total: totalIncome,
      },
      expense: {
        fixed: mapToItems(expenseFixedByCategory, totalExpense),
        variable: mapToItems(expenseVariableByCategory, totalExpense),
        fixedTotal: fixedExpenseTotal,
        variableTotal: variableExpenseTotal,
        total: totalExpense,
      },
      netSavings: Math.round(netSavings / 3),
      savingsRate,
    },
    cashFlow: {
      operating: operatingItems,
      investing: investingItems,
      financing: financingItems,
      operatingTotal,
      investingTotal,
      financingTotal,
      netCashFlow: operatingTotal + investingTotal + financingTotal,
    },
    kpis,
    assetStructure: {
      assetComposition,
      expenseComposition,
    },
  }
}
