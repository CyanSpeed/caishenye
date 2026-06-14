import Decimal from 'decimal.js'
import { getDatabase } from './init'
import type {
  Account, Transaction, InvestmentSnapshot, Category, PhysicalAsset,
  Settings, NetWorthSnapshot, FamilyInfo, ReportData, TrendItem,
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
  const newId = Number(result.lastInsertRowid)
  // 记录初始余额快照 + 净资产快照
  recordBalanceChange(db, newId, '0', account.balance, 'ignore', '账户创建')
  recordNetWorthSnapshot(db)
  return { ...account, id: newId }
}

export function updateAccount(id: number, updates: Partial<Account>): void {
  const db = getDatabase()

  // 如果余额即将变更，提前获取旧值用于快照
  const oldAccount = updates.balance !== undefined
    ? db.prepare('SELECT balance FROM accounts WHERE id = ?').get(id) as { balance: string } | undefined
    : null

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

  // 余额变更时记录快照 + 净资产快照
  if (oldAccount && updates.balance !== undefined) {
    recordBalanceChange(db, id, oldAccount.balance, updates.balance, 'ignore', '手动编辑余额')
    recordNetWorthSnapshot(db)
  }
}

export function deleteAccount(id: number): void {
  const db = getDatabase()
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
}

// ===== 快照工具函数 =====

/** 记录账户余额变动快照（所有余额变更的入口都会调用，同时自动更新净资产快照） */
function recordBalanceChange(
  db: ReturnType<typeof getDatabase>,
  accountId: number,
  oldBalance: string,
  newBalance: string,
  handling: 'expense' | 'income' | 'ignore' = 'ignore',
  note: string = '',
): { lastInsertRowid: number | bigint } {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const diff = new Decimal(newBalance).minus(new Decimal(oldBalance)).toFixed(2)
  const result = db.prepare(
    'INSERT INTO balance_snapshots (account_id, date, old_balance, new_balance, diff, diff_handling, note) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    accountId,
    now,
    oldBalance,
    newBalance,
    diff,
    handling,
    note,
  )
  // 余额变动自动触发净资产快照（defer 到当前事务提交后）
  // 避免在事务内重复计算，通过标记延迟执行
  return result
}

/** 记录实物资产估值变动快照 */
function recordPhysicalAssetChange(
  db: ReturnType<typeof getDatabase>,
  physicalAssetId: number,
  oldValue: string,
  newValue: string,
  note: string = '',
): void {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  db.prepare(
    'INSERT INTO physical_asset_snapshots (physical_asset_id, date, old_value, new_value, note) VALUES (?, ?, ?, ?, ?)'
  ).run(physicalAssetId, now, oldValue, newValue, note)
}

/** 自动记录净资产快照（从账户+实物资产实时计算） */
function recordNetWorthSnapshot(db: ReturnType<typeof getDatabase>): void {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const accounts = db.prepare('SELECT * FROM accounts WHERE is_active = 1').all() as any[]
  const physicalAssets = db.prepare("SELECT * FROM physical_assets WHERE status = '使用中'").all() as any[]

  // 账户资产总和
  const accountAssets = accounts
    .filter((a: any) => a.type === 'asset')
    .reduce((s: number, a: any) => s + Number(a.balance), 0)
  // 实物资产总和
  const physicalTotal = physicalAssets
    .reduce((s: number, a: any) => s + Number(a.current_value), 0)
  // 负债总和
  const totalLiabilities = accounts
    .filter((a: any) => a.type === 'liability')
    .reduce((s: number, a: any) => s + Number(a.balance), 0)

  const totalAssets = accountAssets + physicalTotal
  const netWorth = totalAssets - totalLiabilities

  db.prepare(
    'INSERT INTO net_worth_snapshots (date, total_assets, total_liabilities, net_worth) VALUES (?, ?, ?, ?)'
  ).run(now, String(totalAssets), String(totalLiabilities), String(netWorth))
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

    // 记录快照 + 净资产快照
    const snapshotResult = recordBalanceChange(db, params.account_id, oldBalance, newBalance, params.diff_handling, params.note || '')
    recordNetWorthSnapshot(db)

    // 如果差额需要记为收入或支出，创建交易记录
    if (params.diff_handling !== 'ignore' && diff !== '0.00') {
      const absDiff = new Decimal(diff).abs().toFixed(2)
      const txType = params.diff_handling === 'income' ? 'income' : 'expense'

      // 根据账户类型决定 from_account_id 或 to_account_id
      if (account.type === 'asset') {
        if (txType === 'income') {
          db.prepare(
            'INSERT INTO transactions (date, type, amount, from_account_id, to_account_id, category_id, description, tags, member_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(now.slice(0, 10), 'income', absDiff, null, params.account_id, null, params.note || '余额同步差额', '["余额同步"]', '')
        } else {
          db.prepare(
            'INSERT INTO transactions (date, type, amount, from_account_id, to_account_id, category_id, description, tags, member_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(now.slice(0, 10), 'expense', absDiff, params.account_id, null, null, params.note || '余额同步差额', '["余额同步"]', '')
        }
      } else {
        // 负债账户
        if (txType === 'income') {
          db.prepare(
            'INSERT INTO transactions (date, type, amount, from_account_id, to_account_id, category_id, description, tags, member_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(now.slice(0, 10), 'income', absDiff, null, null, null, params.note || '余额同步差额', '["余额同步"]', '')
        } else {
          db.prepare(
            'INSERT INTO transactions (date, type, amount, from_account_id, to_account_id, category_id, description, tags, member_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).run(now.slice(0, 10), 'expense', absDiff, null, null, null, params.note || '余额同步差额', '["余额同步"]', '')
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
      'INSERT INTO transactions (date, type, amount, from_account_id, to_account_id, category_id, description, tags, member_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(tx.date, tx.type, tx.amount, tx.from_account_id, tx.to_account_id, tx.category_id, tx.description, tx.tags, tx.member_name || '')

    const amount = new Decimal(tx.amount)

    // 仅精确同步的账户才自动更新余额（并记录快照）
    if (tx.type === 'expense' && tx.from_account_id && isExactSync(db, tx.from_account_id)) {
      const account = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(tx.from_account_id) as { balance: string } | undefined
      if (account) {
        const newBalance = new Decimal(account.balance).minus(amount).toFixed(2)
        db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(newBalance, tx.from_account_id)
        recordBalanceChange(db, tx.from_account_id, account.balance, newBalance, 'expense', tx.description || '交易支出')
      }
    } else if (tx.type === 'income' && tx.to_account_id && isExactSync(db, tx.to_account_id)) {
      const account = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(tx.to_account_id) as { balance: string } | undefined
      if (account) {
        const newBalance = new Decimal(account.balance).plus(amount).toFixed(2)
        db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(newBalance, tx.to_account_id)
        recordBalanceChange(db, tx.to_account_id, account.balance, newBalance, 'income', tx.description || '交易收入')
      }
    } else if (tx.type === 'transfer') {
      if (tx.from_account_id && isExactSync(db, tx.from_account_id)) {
        const from = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(tx.from_account_id) as { balance: string } | undefined
        if (from) {
          const newFromBalance = new Decimal(from.balance).minus(amount).toFixed(2)
          db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(newFromBalance, tx.from_account_id)
          recordBalanceChange(db, tx.from_account_id, from.balance, newFromBalance, 'expense', tx.description || '转账转出')
        }
      }
      if (tx.to_account_id && isExactSync(db, tx.to_account_id)) {
        const to = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(tx.to_account_id) as { balance: string } | undefined
        if (to) {
          const newToBalance = new Decimal(to.balance).plus(amount).toFixed(2)
          db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(newToBalance, tx.to_account_id)
          recordBalanceChange(db, tx.to_account_id, to.balance, newToBalance, 'income', tx.description || '转账转入')
        }
      }
    }

    return { ...tx, id: Number(result.lastInsertRowid) }
  })

  const newTx = insertAndBalance()
  // 事务提交后记录净资产快照
  recordNetWorthSnapshot(db)
  return newTx
}

export function updateTransaction(id: number, updates: Partial<Transaction>): Transaction {
  const db = getDatabase()

  const updateAndRebalance = db.transaction(() => {
    // 获取原始交易
    const oldTx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Transaction | undefined
    if (!oldTx) throw new Error('Transaction not found')

    const oldAmount = new Decimal(oldTx.amount)

    // 撤销原交易的余额影响（仅精确同步账户，并记录还原快照）
    if (oldTx.type === 'expense' && oldTx.from_account_id && isExactSync(db, oldTx.from_account_id)) {
      const account = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(oldTx.from_account_id) as { balance: string } | undefined
      if (account) {
        const restored = new Decimal(account.balance).plus(oldAmount).toFixed(2)
        db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(restored, oldTx.from_account_id)
        recordBalanceChange(db, oldTx.from_account_id, account.balance, restored, 'ignore', '撤销交易')
      }
    } else if (oldTx.type === 'income' && oldTx.to_account_id && isExactSync(db, oldTx.to_account_id)) {
      const account = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(oldTx.to_account_id) as { balance: string } | undefined
      if (account) {
        const restored = new Decimal(account.balance).minus(oldAmount).toFixed(2)
        db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(restored, oldTx.to_account_id)
        recordBalanceChange(db, oldTx.to_account_id, account.balance, restored, 'ignore', '撤销交易')
      }
    } else if (oldTx.type === 'transfer') {
      if (oldTx.from_account_id && isExactSync(db, oldTx.from_account_id)) {
        const from = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(oldTx.from_account_id) as { balance: string } | undefined
        if (from) {
          const restored = new Decimal(from.balance).plus(oldAmount).toFixed(2)
          db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(restored, oldTx.from_account_id)
          recordBalanceChange(db, oldTx.from_account_id, from.balance, restored, 'ignore', '撤销转账')
        }
      }
      if (oldTx.to_account_id && isExactSync(db, oldTx.to_account_id)) {
        const to = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(oldTx.to_account_id) as { balance: string } | undefined
        if (to) {
          const restored = new Decimal(to.balance).minus(oldAmount).toFixed(2)
          db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(restored, oldTx.to_account_id)
          recordBalanceChange(db, oldTx.to_account_id, to.balance, restored, 'ignore', '撤销转账')
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
    if (updates.member_name !== undefined) { fields.push('member_name = ?'); values.push(updates.member_name) }

    if (fields.length > 0) {
      values.push(id)
      db.prepare(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    }

    // 获取更新后的交易
    const newTx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Transaction
    const newAmount = new Decimal(newTx.amount)

    // 应用新交易的余额影响（仅精确同步账户，并记录快照）
    if (newTx.type === 'expense' && newTx.from_account_id && isExactSync(db, newTx.from_account_id)) {
      const account = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(newTx.from_account_id) as { balance: string } | undefined
      if (account) {
        const updated = new Decimal(account.balance).minus(newAmount).toFixed(2)
        db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(updated, newTx.from_account_id)
        recordBalanceChange(db, newTx.from_account_id, account.balance, updated, 'expense', newTx.description || '交易支出')
      }
    } else if (newTx.type === 'income' && newTx.to_account_id && isExactSync(db, newTx.to_account_id)) {
      const account = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(newTx.to_account_id) as { balance: string } | undefined
      if (account) {
        const updated = new Decimal(account.balance).plus(newAmount).toFixed(2)
        db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(updated, newTx.to_account_id)
        recordBalanceChange(db, newTx.to_account_id, account.balance, updated, 'income', newTx.description || '交易收入')
      }
    } else if (newTx.type === 'transfer') {
      if (newTx.from_account_id && isExactSync(db, newTx.from_account_id)) {
        const from = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(newTx.from_account_id) as { balance: string } | undefined
        if (from) {
          const updated = new Decimal(from.balance).minus(newAmount).toFixed(2)
          db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(updated, newTx.from_account_id)
          recordBalanceChange(db, newTx.from_account_id, from.balance, updated, 'expense', newTx.description || '转账转出')
        }
      }
      if (newTx.to_account_id && isExactSync(db, newTx.to_account_id)) {
        const to = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(newTx.to_account_id) as { balance: string } | undefined
        if (to) {
          const updated = new Decimal(to.balance).plus(newAmount).toFixed(2)
          db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(updated, newTx.to_account_id)
          recordBalanceChange(db, newTx.to_account_id, to.balance, updated, 'income', newTx.description || '转账转入')
        }
      }
    }

    return newTx
  })

  const updatedTx = updateAndRebalance()
  recordNetWorthSnapshot(db)
  return updatedTx
}

export function deleteTransaction(id: number): void {
  const db = getDatabase()

  const deleteAndReverse = db.transaction(() => {
    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as Transaction | undefined
    if (!tx) return

    const amount = new Decimal(tx.amount)

    // 撤销余额影响（仅精确同步账户，并记录还原快照）
    if (tx.type === 'expense' && tx.from_account_id && isExactSync(db, tx.from_account_id)) {
      const account = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(tx.from_account_id) as { balance: string } | undefined
      if (account) {
        const restored = new Decimal(account.balance).plus(amount).toFixed(2)
        db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(restored, tx.from_account_id)
        recordBalanceChange(db, tx.from_account_id, account.balance, restored, 'ignore', '删除交易')
      }
    } else if (tx.type === 'income' && tx.to_account_id && isExactSync(db, tx.to_account_id)) {
      const account = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(tx.to_account_id) as { balance: string } | undefined
      if (account) {
        const restored = new Decimal(account.balance).minus(amount).toFixed(2)
        db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(restored, tx.to_account_id)
        recordBalanceChange(db, tx.to_account_id, account.balance, restored, 'ignore', '删除交易')
      }
    } else if (tx.type === 'transfer') {
      if (tx.from_account_id && isExactSync(db, tx.from_account_id)) {
        const from = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(tx.from_account_id) as { balance: string } | undefined
        if (from) {
          const restored = new Decimal(from.balance).plus(amount).toFixed(2)
          db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(restored, tx.from_account_id)
          recordBalanceChange(db, tx.from_account_id, from.balance, restored, 'ignore', '删除转账')
        }
      }
      if (tx.to_account_id && isExactSync(db, tx.to_account_id)) {
        const to = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(tx.to_account_id) as { balance: string } | undefined
        if (to) {
          const restored = new Decimal(to.balance).minus(amount).toFixed(2)
          db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(restored, tx.to_account_id)
          recordBalanceChange(db, tx.to_account_id, to.balance, restored, 'ignore', '删除转账')
        }
      }
    }

    db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
  })

  deleteAndReverse()
  recordNetWorthSnapshot(db)
}

/** 重置交易记账数据（清空交易记录、余额快照、净资产快照和投资快照，并重置分类为新的12种） */
export function resetTransactionData(): { transactionsDeleted: number; snapshotsDeleted: number; netWorthDeleted: number; investmentDeleted: number } {
  const db = getDatabase()

  const resetInTransaction = db.transaction(() => {
    // 统计要删除的记录数
    const txCount = (db.prepare('SELECT COUNT(*) as cnt FROM transactions').get() as { cnt: number }).cnt
    const snapshotCount = (db.prepare('SELECT COUNT(*) as cnt FROM balance_snapshots').get() as { cnt: number }).cnt
    const netWorthCount = (db.prepare('SELECT COUNT(*) as cnt FROM net_worth_snapshots').get() as { cnt: number }).cnt
    const investmentCount = (db.prepare('SELECT COUNT(*) as cnt FROM investment_snapshots').get() as { cnt: number }).cnt

    // 清空交易记录
    db.prepare('DELETE FROM transactions').run()
    // 清空余额快照
    db.prepare('DELETE FROM balance_snapshots').run()
    // 清空实物资产快照
    db.prepare('DELETE FROM physical_asset_snapshots').run()
    // 清空净资产快照（衍生数据，交易清空后应同步清空）
    db.prepare('DELETE FROM net_worth_snapshots').run()
    // 清空投资市值快照（衍生数据，交易清空后应同步清空）
    db.prepare('DELETE FROM investment_snapshots').run()

    // 重置分类为新的12种分类
    db.prepare('DELETE FROM categories').run()

    const newCategories = [
      { id: 1, name: '居住与房贷', icon: 'home', nature: 'fixed', cfType: 'financing' },
      { id: 2, name: '水电燃气与通讯', icon: 'zap', nature: 'fixed', cfType: 'operating' },
      { id: 3, name: '餐饮与食品', icon: 'restaurant', nature: 'variable', cfType: 'operating' },
      { id: 4, name: '交通与车辆养护', icon: 'car', nature: 'variable', cfType: 'operating' },
      { id: 5, name: '教育与自我提升', icon: 'book', nature: 'variable', cfType: 'operating' },
      { id: 6, name: '医疗与健康', icon: 'medical', nature: 'variable', cfType: 'operating' },
      { id: 7, name: '服饰与个人形象', icon: 'shirt', nature: 'variable', cfType: 'operating' },
      { id: 8, name: '家居日用与耐用品', icon: 'cart', nature: 'variable', cfType: 'operating' },
      { id: 9, name: '休闲娱乐与社交', icon: 'gamepad', nature: 'variable', cfType: 'operating' },
      { id: 10, name: '宠物支出', icon: 'heart', nature: 'variable', cfType: 'operating' },
      { id: 11, name: '金融与保险支出', icon: 'shield', nature: 'fixed', cfType: 'financing' },
      { id: 12, name: '其他与杂项', icon: 'gift', nature: 'variable', cfType: 'operating' },
      { id: 13, name: '工资', icon: 'cash', nature: '', cfType: 'operating' },
      { id: 14, name: '投资收益', icon: 'trending-up', nature: '', cfType: 'investing' },
      { id: 15, name: '兼职收入', icon: 'briefcase', nature: '', cfType: 'operating' },
      { id: 16, name: '利息收入', icon: 'percent', nature: '', cfType: 'investing' },
      { id: 17, name: '其他收入', icon: 'gift', nature: '', cfType: 'operating' },
      { id: 18, name: '公积金提取', icon: 'bank', nature: '', cfType: 'financing' },
      { id: 19, name: '奖金', icon: 'trophy', nature: '', cfType: 'operating' },
    ]

    const insertCat = db.prepare('INSERT INTO categories (id, name, type, icon, expense_nature, cashflow_type) VALUES (?, ?, ?, ?, ?, ?)')
    for (const cat of newCategories) {
      const type = cat.id <= 12 ? 'expense' : 'income'
      insertCat.run(cat.id, cat.name, type, cat.icon, cat.nature, cat.cfType)
    }

    // 重置自增ID序列
    try {
      db.prepare("UPDATE sqlite_sequence SET seq = 19 WHERE name = 'categories'").run()
      db.prepare("UPDATE sqlite_sequence SET seq = 0 WHERE name = 'transactions'").run()
      db.prepare("UPDATE sqlite_sequence SET seq = 0 WHERE name = 'balance_snapshots'").run()
      db.prepare("UPDATE sqlite_sequence SET seq = 0 WHERE name = 'physical_asset_snapshots'").run()
      db.prepare("UPDATE sqlite_sequence SET seq = 0 WHERE name = 'net_worth_snapshots'").run()
      db.prepare("UPDATE sqlite_sequence SET seq = 0 WHERE name = 'investment_snapshots'").run()
    } catch {
      // sqlite_sequence 表可能不存在，忽略
    }

    return { transactionsDeleted: txCount, snapshotsDeleted: snapshotCount, netWorthDeleted: netWorthCount, investmentDeleted: investmentCount }
  })

  return resetInTransaction()
}

/** 批量导入参数 */
export interface BatchImportParams {
  items: {
    category_id: number
    amount: string
    description: string
  }[]
  date: string
  from_account_id: number
}

/** 批量添加交易记录（用于图像识别导入） */
export function batchAddTransactions(params: BatchImportParams): Transaction[] {
  const db = getDatabase()
  const results: Transaction[] = []

  const batchInsert = db.transaction(() => {
    for (const item of params.items) {
      const tx: Omit<Transaction, 'id'> = {
        date: params.date,
        type: 'expense',
        amount: item.amount,
        from_account_id: params.from_account_id,
        to_account_id: null,
        category_id: item.category_id,
        description: item.description,
        tags: '["截图导入"]',
        member_name: item.member_name || '',
      }

      const result = db.prepare(
        'INSERT INTO transactions (date, type, amount, from_account_id, to_account_id, category_id, description, tags, member_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(tx.date, tx.type, tx.amount, tx.from_account_id, tx.to_account_id, tx.category_id, tx.description, tx.tags, tx.member_name)

      // 更新账户余额（如果是精确同步模式）
      if (tx.from_account_id && isExactSync(db, tx.from_account_id)) {
        const amount = new Decimal(tx.amount)
        const account = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(tx.from_account_id) as { balance: string } | undefined
        if (account) {
          const newBalance = new Decimal(account.balance).minus(amount).toFixed(2)
          db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(newBalance, tx.from_account_id)
        }
      }

      results.push({ ...tx, id: Number(result.lastInsertRowid) })
    }
  })

  batchInsert()
  return results
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
  const newId = Number(result.lastInsertRowid)
  // 记录初始估值快照
  recordPhysicalAssetChange(db, newId, '0', asset.current_value, '物品创建')
  // 自动更新净资产快照
  recordNetWorthSnapshot(db)
  return { ...asset, id: newId }
}

export function updatePhysicalAsset(id: number, updates: Partial<PhysicalAsset>): void {
  const db = getDatabase()

  // 如果估值即将变更，提前获取旧值用于快照
  const oldAsset = updates.current_value !== undefined
    ? db.prepare('SELECT current_value FROM physical_assets WHERE id = ?').get(id) as { current_value: string } | undefined
    : null

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

  // 估值变更时记录快照
  if (oldAsset && updates.current_value !== undefined) {
    recordPhysicalAssetChange(db, id, oldAsset.current_value, updates.current_value, '手动更新估值')
    recordNetWorthSnapshot(db)
  }
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

// ===== 财务报告生成 =====

/** 获取月份日期范围 */
function getMonthRange(year: number, month: number): { start: string; end: string; label: string; dateRange: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const label = `${year}年${month}月`
  const dateRange = `${month}月1日 — ${month}月${lastDay}日`
  return { start, end, label, dateRange }
}

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

/** 获取年度日期范围 */
function getYearRange(year: number): { start: string; end: string; label: string; dateRange: string } {
  const start = `${year}-01-01`
  const end = `${year}-12-31`
  const label = `${year}年`
  const dateRange = `1月1日 — 12月31日`
  return { start, end, label, dateRange }
}

/** 获取上一个月份的年份和月份 */
function getPrevMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

/** 获取上一个季度 */
function getPrevQuarter(year: number, quarter: number): { year: number; quarter: number } {
  if (quarter === 1) return { year: year - 1, quarter: 4 }
  return { year, quarter: quarter - 1 }
}

/** 获取上一年 */
function getPrevYear(year: number): { year: number } {
  return { year: year - 1 }
}

/** 统一报告生成函数 */
export function generateReport(period: 'monthly' | 'quarterly' | 'yearly', year: number, periodValue: number): ReportData {
  const db = getDatabase()

  // 根据周期类型获取日期范围
  let range: { start: string; end: string; label: string; dateRange: string }
  let prevRange: { start: string; end: string }
  let comparisonLabel: string
  let monthsInPeriod: number

  switch (period) {
    case 'monthly': {
      const r = getMonthRange(year, periodValue)
      range = r
      const prevM = getPrevMonth(year, periodValue)
      const pr = getMonthRange(prevM.year, prevM.month)
      prevRange = { start: pr.start, end: pr.end }
      comparisonLabel = 'vs 上月'
      monthsInPeriod = 1
      break
    }
    case 'quarterly': {
      const r = getQuarterRange(year, periodValue)
      range = r
      const prevQ = getPrevQuarter(year, periodValue)
      const pr = getQuarterRange(prevQ.year, prevQ.quarter)
      prevRange = { start: pr.start, end: pr.end }
      comparisonLabel = 'vs 上季'
      monthsInPeriod = 3
      break
    }
    case 'yearly': {
      const r = getYearRange(year)
      range = r
      const prevY = getPrevYear(year)
      const pr = getYearRange(prevY.year)
      prevRange = { start: pr.start, end: pr.end }
      comparisonLabel = 'vs 上年'
      monthsInPeriod = 12
      break
    }
  }

  // 查询基础数据
  const accounts = db.prepare('SELECT * FROM accounts WHERE is_active = 1').all() as any[]
  const categories = db.prepare('SELECT * FROM categories').all() as Category[]
  const physicalAssets = db.prepare("SELECT * FROM physical_assets WHERE status = '使用中'").all() as any[]

  // 当期交易
  const periodTransactions = db.prepare(
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

  // ===== 资产分类计算（与 Dashboard / 账户管理 完全一致） =====
  const assetAccounts = accounts.filter((a: any) => a.type === 'asset')
  const liabilityAccounts = accounts.filter((a: any) => a.type === 'liability')

  // 流动资产：cash + bank + receivable（非投资的金融资产）
  const liquidAccounts = assetAccounts.filter(
    (a: any) => a.sub_type === 'cash' || a.sub_type === 'bank' || a.sub_type === 'receivable',
  )
  const liquidTotal = liquidAccounts.reduce((s: number, a: any) => s + Number(a.balance), 0)

  // 投资性资产：investment
  const investmentAccounts = assetAccounts.filter((a: any) => a.sub_type === 'investment')
  const investmentTotal = investmentAccounts.reduce((s: number, a: any) => s + Number(a.balance), 0)

  // 实物资产：全部使用中的实物资产（与 Dashboard / 账户管理一致）
  const physicalTotal = physicalAssets.reduce((s: number, a: any) => s + Number(a.current_value), 0)

  // 总资产 = 全部金融账户 + 全部实物资产
  const totalAssets = liquidTotal + investmentTotal + physicalTotal

  // 负债：所有活跃负债账户（与 Dashboard 一致）
  const shortTermLiabilities = liabilityAccounts.filter((a: any) => a.sub_type === 'consumer_loan')
  const shortTermTotal = shortTermLiabilities.reduce((s: number, a: any) => s + Number(a.balance), 0)
  const longTermLiabilities = liabilityAccounts.filter((a: any) => a.sub_type === 'mortgage' || a.sub_type === 'private_loan')
  const longTermTotal = longTermLiabilities.reduce((s: number, a: any) => s + Number(a.balance), 0)
  const totalLiabilities = shortTermTotal + longTermTotal

  // 构建资产负债表项
  const mapAccountToItem = (acc: any, total: number): BalanceSheetItem => ({
    name: acc.name,
    amount: Number(acc.balance),
    percentage: total > 0 ? Math.round(Number(acc.balance) / total * 1000) / 10 : 0,
    note: acc.notes || '',
  })

  // 实物资产明细（全部使用中的实物资产）
  const physicalItems: BalanceSheetItem[] = physicalAssets.map((a: any) => ({
    name: `${a.icon_emoji || '📦'} ${a.name}`,
    amount: Number(a.current_value),
    percentage: totalAssets > 0 ? Math.round(Number(a.current_value) / totalAssets * 1000) / 10 : 0,
    note: a.category || '',
  }))
  if (physicalItems.length === 0) {
    physicalItems.push({ name: '实物资产', amount: 0, percentage: 0, note: '暂无' })
  }

  // ===== 收支计算 =====
  const catMap = new Map<number, Category>()
  categories.forEach(c => catMap.set(c.id, c))

  const incomeTx = periodTransactions.filter(t => t.type === 'income')
  const expenseTx = periodTransactions.filter(t => t.type === 'expense')

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
    const matched = periodTransactions.filter(t => {
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

  // ===== 同期对比（上月/上季/上年数据）=====
  // 取最近一期快照（≤ 比较日期），而非最早一期
  const prevSnapshot = [...snapshots].reverse().find(s => s.date <= prevRange.end)
  const currentSnapshot = [...snapshots].reverse().find(s => s.date <= range.end)
  const prevNetWorth = prevSnapshot ? Number(prevSnapshot.net_worth) : 0
  const currentNetWorth = currentSnapshot ? Number(currentSnapshot.net_worth) : (totalAssets - totalLiabilities)
  const prevTotalAssets = prevSnapshot ? Number(prevSnapshot.total_assets) : 0
  const prevTotalLiabilities = prevSnapshot ? Number(prevSnapshot.total_liabilities) : 0

  const pctChange = (current: number, prev: number): number => {
    if (prev === 0) return 0
    return Math.round((current - prev) / Math.abs(prev) * 1000) / 10
  }

  // 储蓄计算：有有效前期快照时用净资产变动（更全面），否则回退到收支差额
  const hasValidPrevSnapshot = prevSnapshot && prevNetWorth > 0
  const netWorthChange = hasValidPrevSnapshot ? (currentNetWorth - prevNetWorth) : 0
  const netSavingsFromTx = totalIncome - totalExpense
  // 仅当存在有效前期净资产快照时，才用净资产变动作为储蓄参考
  const netSavings = hasValidPrevSnapshot && netWorthChange !== 0 ? netWorthChange : netSavingsFromTx
  // 储蓄率：以收入为分母，结果截断到合理范围（避免净资产快照缺失导致的异常值）
  const savingsRate = totalIncome > 0
    ? Math.min(100, Math.round(netSavings / totalIncome * 1000) / 10)
    : 0

  // ===== KPI 计算 =====
  const monthlyExpense = totalExpense / monthsInPeriod
  const monthlyIncome = totalIncome / monthsInPeriod
  const liquidForKPI = liquidTotal + investmentTotal * 0.3

  // 房贷月供（居住与房贷分类）
  const mortgageTx = expenseTx.filter(t => {
    const cat = catMap.get(t.category_id ?? -1)
    return cat?.name === '居住与房贷'
  })
  const mortgageMonthly = mortgageTx.length > 0
    ? mortgageTx.reduce((s, t) => s + Number(t.amount), 0) / monthsInPeriod
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
      formula: `(本${period === 'monthly' ? '月' : period === 'quarterly' ? '季' : '年'}净资产 - 上${period === 'monthly' ? '月' : period === 'quarterly' ? '季' : '年'}净资产) / 上${period === 'monthly' ? '月' : period === 'quarterly' ? '季' : '年'}净资产`,
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
    { name: '📦 实物资产', value: physicalTotal, percentage: totalAssets > 0 ? Math.round(physicalTotal / totalAssets * 1000) / 10 : 0 },
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

  // ===== 资产负债趋势（快照对比） =====
  // 查询所有余额快照
  const allSnapshots = db.prepare('SELECT * FROM balance_snapshots ORDER BY date ASC').all() as any[]

  // 账户图标映射
  const accountIconMap: Record<string, string> = {
    cash: '💵', bank: '🏦', investment: '📈', receivable: '📋',
    mortgage: '🏠', consumer_loan: '💳', private_loan: '🤝',
  }

  // 获取账户在某个时间点之前的最新快照余额
  function getSnapshotBalance(accountId: number, beforeDate: string): number | null {
    // 从后往前找第一个 date <= beforeDate 的快照
    for (let i = allSnapshots.length - 1; i >= 0; i--) {
      const s = allSnapshots[i]
      if (s.account_id === accountId && s.date <= beforeDate) {
        return Number(s.new_balance)
      }
    }
    return null
  }

  function buildTrendItem(
    name: string, icon: string, prevVal: number, currVal: number,
  ): TrendItem {
    const changePct = prevVal !== 0
      ? Math.round((currVal - prevVal) / Math.abs(prevVal) * 1000) / 10
      : (currVal !== 0 ? 100 : 0)
    return { name, icon, prevValue: prevVal, currValue: currVal, changePct }
  }

  // 资产账户趋势
  const assetTrend: TrendItem[] = assetAccounts.map((a: any) => {
    const prevBal = getSnapshotBalance(a.id, prevRange.end)
    const currBal = getSnapshotBalance(a.id, range.end)
    const prevVal = prevBal !== null ? prevBal : Number(a.balance)
    const currVal = currBal !== null ? currBal : Number(a.balance)
    return buildTrendItem(a.name, accountIconMap[a.sub_type] || '💰', prevVal, currVal)
  })

  // 实物资产快照趋势（从 physical_asset_snapshots 表读取历史估值）
  // 获取所有实物资产快照用于趋势计算
  const allPASnapshots = db.prepare('SELECT * FROM physical_asset_snapshots ORDER BY date ASC').all() as any[]

  function getPhysicalAssetSnapshotTotal(beforeDate: string): number {
    // 对每个使用中的实物资产，取 date <= beforeDate 的最新快照值
    let total = 0
    activePhysicalAssets.forEach((pa: any) => {
      let latestVal: number | null = null
      for (let i = allPASnapshots.length - 1; i >= 0; i--) {
        const s = allPASnapshots[i]
        if (s.physical_asset_id === pa.id && s.date <= beforeDate) {
          latestVal = Number(s.new_value)
          break
        }
      }
      total += latestVal !== null ? latestVal : Number(pa.current_value)
    })
    return total
  }

  const activePhysicalAssets = physicalAssets.filter((a: any) => a.status === '使用中')
  const physicalPrevVal = getPhysicalAssetSnapshotTotal(prevRange.end)
  const physicalCurrVal = getPhysicalAssetSnapshotTotal(range.end)
  if (physicalCurrVal > 0 || physicalPrevVal > 0) {
    assetTrend.push(buildTrendItem('实物资产', '📦', physicalPrevVal, physicalCurrVal))
  }

  // 负债账户趋势
  const liabilityTrend: TrendItem[] = liabilityAccounts.map((a: any) => {
    const prevBal = getSnapshotBalance(a.id, prevRange.end)
    const currBal = getSnapshotBalance(a.id, range.end)
    const prevVal = prevBal !== null ? prevBal : Number(a.balance)
    const currVal = currBal !== null ? currBal : Number(a.balance)
    return buildTrendItem(a.name, accountIconMap[a.sub_type] || '💸', prevVal, currVal)
  })

  // 总负债趋势
  const totalLiabPrev = liabilityTrend.reduce((s, t) => s + t.prevValue, 0)
  const totalLiabCurr = liabilityTrend.reduce((s, t) => s + t.currValue, 0)
  liabilityTrend.push(buildTrendItem('总负债', '📉', totalLiabPrev, totalLiabCurr))

  // 净资产趋势
  const netWorthTrendItem = buildTrendItem('净资产', '✨', prevNetWorth, currentNetWorth)

  // ===== 组装报表 =====
  return {
    meta: {
      familyName: familyInfo.familyName,
      members: familyInfo.members,
      city: familyInfo.city,
      preparer: familyInfo.preparer,
      reviewer: familyInfo.reviewer,
      period,
      year,
      periodValue,
      periodLabel: range.label,
      dateRange: range.dateRange,
      comparisonLabel,
      generatedAt: new Date().toISOString(),
      dataNote: '资产负债数据基于账户余额（准确），收支数据基于已记录交易（可能有遗漏）',
    },
    summary: {
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
      periodNetSavings: netSavings,
      savingsRate,
      totalAssetsChange: pctChange(totalAssets, prevTotalAssets),
      totalLiabilitiesChange: pctChange(totalLiabilities, prevTotalLiabilities),
      netWorthChange: pctChange(currentNetWorth, prevNetWorth),
    },
    balanceSheet: {
      assets: {
        liquid: liquidAccounts.map((a: any) => mapAccountToItem(a, totalAssets)),
        investment: investmentAccounts.map((a: any) => mapAccountToItem(a, totalAssets)),
        fixed: physicalItems,
        liquidTotal,
        investmentTotal,
        fixedTotal: physicalTotal,
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
      netSavings: Math.round(netSavings / monthsInPeriod),
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
    assetTrend,
    liabilityTrend,
    netWorthTrendItem,
  }
}
