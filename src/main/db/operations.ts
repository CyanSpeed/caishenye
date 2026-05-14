import Decimal from 'decimal.js'
import { getDatabase } from './init'
import type { Account, Transaction, InvestmentSnapshot, Category, PhysicalAsset } from '@shared/types'

// ===== Accounts =====

export function getAllAccounts(): Account[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM accounts ORDER BY id').all() as any[]
  return rows.map(r => ({ ...r, is_active: !!r.is_active }))
}

export function addAccount(account: Omit<Account, 'id'>): Account {
  const db = getDatabase()
  const result = db.prepare(
    'INSERT INTO accounts (name, type, sub_type, balance, currency, is_active) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(account.name, account.type, account.sub_type, account.balance, account.currency, account.is_active ? 1 : 0)
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
  if (fields.length === 0) return
  values.push(id)
  db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}

export function deleteAccount(id: number): void {
  const db = getDatabase()
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
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

export function addTransaction(tx: Omit<Transaction, 'id'>): Transaction {
  const db = getDatabase()

  const insertAndBalance = db.transaction(() => {
    const result = db.prepare(
      'INSERT INTO transactions (date, type, amount, from_account_id, to_account_id, category_id, description, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(tx.date, tx.type, tx.amount, tx.from_account_id, tx.to_account_id, tx.category_id, tx.description, tx.tags)

    const amount = new Decimal(tx.amount)

    // Update account balances
    if (tx.type === 'expense' && tx.from_account_id) {
      const account = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(tx.from_account_id) as { balance: string } | undefined
      if (account) {
        const newBalance = new Decimal(account.balance).minus(amount).toFixed(2)
        db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(newBalance, tx.from_account_id)
      }
    } else if (tx.type === 'income' && tx.to_account_id) {
      const account = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(tx.to_account_id) as { balance: string } | undefined
      if (account) {
        const newBalance = new Decimal(account.balance).plus(amount).toFixed(2)
        db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(newBalance, tx.to_account_id)
      }
    } else if (tx.type === 'transfer') {
      if (tx.from_account_id) {
        const from = db.prepare('SELECT balance FROM accounts WHERE id = ?').get(tx.from_account_id) as { balance: string } | undefined
        if (from) {
          db.prepare('UPDATE accounts SET balance = ? WHERE id = ?').run(new Decimal(from.balance).minus(amount).toFixed(2), tx.from_account_id)
        }
      }
      if (tx.to_account_id) {
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
