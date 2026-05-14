import Database from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export function initDatabase(): Database.Database {
  const dbPath = join(app.getPath('userData'), 'finance.db')
  db = new Database(dbPath)

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  createTables(db)
  seedIfEmpty(db)

  return db
}

function createTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('asset', 'liability')),
      sub_type TEXT NOT NULL CHECK(sub_type IN ('cash', 'bank', 'investment', 'loan', 'credit')),
      balance TEXT NOT NULL DEFAULT '0.00',
      currency TEXT NOT NULL DEFAULT 'CNY',
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      icon TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('expense', 'income', 'transfer')),
      amount TEXT NOT NULL,
      from_account_id INTEGER,
      to_account_id INTEGER,
      category_id INTEGER,
      description TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      FOREIGN KEY (from_account_id) REFERENCES accounts(id),
      FOREIGN KEY (to_account_id) REFERENCES accounts(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS investment_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      market_value TEXT NOT NULL,
      cost_basis TEXT NOT NULL,
      note TEXT DEFAULT '',
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS physical_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('家电', '数码', '汽车', '奢侈品')),
      icon_emoji TEXT DEFAULT '',
      purchase_price TEXT NOT NULL,
      purchase_date TEXT NOT NULL,
      current_value TEXT NOT NULL,
      image_url TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT '使用中' CHECK(status IN ('使用中', '已出售', '已报废'))
    );
  `)
}

function seedIfEmpty(db: Database.Database) {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM accounts').get() as { cnt: number }
  if (count.cnt > 0) return

  const seedAccounts = db.prepare(`
    INSERT INTO accounts (id, name, type, sub_type, balance, currency, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const seedCategories = db.prepare(`
    INSERT INTO categories (id, name, type, icon) VALUES (?, ?, ?, ?)
  `)
  const seedTransactions = db.prepare(`
    INSERT INTO transactions (id, date, type, amount, from_account_id, to_account_id, category_id, description, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const seedSnapshots = db.prepare(`
    INSERT INTO investment_snapshots (id, account_id, date, market_value, cost_basis, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const seedPhysicalAssets = db.prepare(`
    INSERT INTO physical_assets (id, name, category, icon_emoji, purchase_price, purchase_date, current_value, image_url, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertAll = db.transaction(() => {
    // Accounts
    seedAccounts.run(1, '现金钱包', 'asset', 'cash', '5000.00', 'CNY', 1)
    seedAccounts.run(2, '招商银行储蓄卡', 'asset', 'bank', '156800.50', 'CNY', 1)
    seedAccounts.run(3, '工商银行工资卡', 'asset', 'bank', '42300.00', 'CNY', 1)
    seedAccounts.run(4, '支付宝余额', 'asset', 'cash', '8520.75', 'CNY', 1)
    seedAccounts.run(5, '微信零钱', 'asset', 'cash', '1230.00', 'CNY', 1)
    seedAccounts.run(6, '华泰证券股票账户', 'asset', 'investment', '285000.00', 'CNY', 1)
    seedAccounts.run(7, '易方达基金账户', 'asset', 'investment', '120000.00', 'CNY', 1)
    seedAccounts.run(8, '建设银行定期存款', 'asset', 'investment', '200000.00', 'CNY', 1)
    seedAccounts.run(9, '房贷账户', 'liability', 'loan', '1200000.00', 'CNY', 1)
    seedAccounts.run(10, '车贷账户', 'liability', 'loan', '85000.00', 'CNY', 1)
    seedAccounts.run(11, '招商银行信用卡', 'liability', 'credit', '12500.00', 'CNY', 1)
    seedAccounts.run(12, '花呗', 'liability', 'credit', '3200.00', 'CNY', 1)

    // Categories
    seedCategories.run(1, '餐饮', 'expense', 'restaurant')
    seedCategories.run(2, '交通', 'expense', 'car')
    seedCategories.run(3, '购物', 'expense', 'cart')
    seedCategories.run(4, '住房', 'expense', 'home')
    seedCategories.run(5, '娱乐', 'expense', 'gamepad')
    seedCategories.run(6, '医疗', 'expense', 'medical')
    seedCategories.run(7, '工资', 'income', 'cash')
    seedCategories.run(8, '投资收益', 'income', 'trending-up')
    seedCategories.run(9, '兼职收入', 'income', 'briefcase')
    seedCategories.run(10, '其他收入', 'income', 'gift')

    // Transactions
    seedTransactions.run(1, '2026-05-02', 'expense', '48.50', 4, null, 1, '午餐外卖 - 黄焖鸡米饭', '["餐饮","外卖"]')
    seedTransactions.run(2, '2026-05-01', 'expense', '320.00', 2, null, 3, '优衣库T恤', '["购物","服装"]')
    seedTransactions.run(3, '2026-05-01', 'income', '28500.00', null, 3, 7, '4月工资', '["工资","固定收入"]')
    seedTransactions.run(4, '2026-04-30', 'expense', '150.00', 5, null, 1, '朋友聚餐AA', '["餐饮","社交"]')
    seedTransactions.run(5, '2026-04-28', 'transfer', '5000.00', 3, 4, null, '转入支付宝日常使用', '["转账","内部"]')
    seedTransactions.run(6, '2026-04-28', 'expense', '2500.00', 2, null, 4, '房租', '["住房","固定支出"]')
    seedTransactions.run(7, '2026-04-27', 'expense', '200.00', 2, null, 2, '加油', '["交通","汽车"]')
    seedTransactions.run(8, '2026-04-26', 'expense', '89.90', 4, null, 5, 'Netflix月费', '["娱乐","订阅"]')
    seedTransactions.run(9, '2026-04-25', 'expense', '380.00', 2, null, 6, '体检', '["医疗","健康"]')
    seedTransactions.run(10, '2026-04-24', 'income', '3500.00', null, 4, 9, '周末培训讲课费', '["兼职","培训"]')
    seedTransactions.run(11, '2026-04-22', 'expense', '6500.00', 2, null, 4, '房贷月供', '["住房","贷款"]')
    seedTransactions.run(12, '2026-04-20', 'transfer', '3500.00', 2, 11, null, '还信用卡', '["转账","还款"]')
    seedTransactions.run(13, '2026-04-15', 'expense', '156.00', 4, null, 1, '超市采购食材', '["餐饮","日常"]')
    seedTransactions.run(14, '2026-04-10', 'income', '1250.00', null, 6, 8, '股票分红', '["投资","分红"]')

    // Investment Snapshots
    seedSnapshots.run(1, 6, '2025-11-01', '250000.00', '240000.00', '月初快照')
    seedSnapshots.run(2, 6, '2025-12-01', '258000.00', '240000.00', '月初快照')
    seedSnapshots.run(3, 6, '2026-01-01', '262000.00', '240000.00', '年初快照')
    seedSnapshots.run(4, 6, '2026-02-01', '275000.00', '245000.00', '追加投资1万')
    seedSnapshots.run(5, 6, '2026-03-01', '280000.00', '245000.00', '月初快照')
    seedSnapshots.run(6, 6, '2026-04-01', '285000.00', '245000.00', '月初快照')
    seedSnapshots.run(7, 7, '2025-11-01', '105000.00', '100000.00', '基金定投')
    seedSnapshots.run(8, 7, '2025-12-01', '110000.00', '100000.00', '基金定投')
    seedSnapshots.run(9, 7, '2026-01-01', '108000.00', '100000.00', '市场回调')
    seedSnapshots.run(10, 7, '2026-02-01', '115000.00', '100000.00', '基金定投')
    seedSnapshots.run(11, 7, '2026-03-01', '118000.00', '100000.00', '基金定投')
    seedSnapshots.run(12, 7, '2026-04-01', '120000.00', '100000.00', '基金定投')

    // Physical Assets
    seedPhysicalAssets.run(1, 'TCL 85Q10L 电视', '家电', '📺', '8999.00', '2025-12-15', '6500.00', '', '85寸 Mini LED，保修3年', '使用中')
    seedPhysicalAssets.run(2, 'iPhone 16 Pro Max', '数码', '📱', '9999.00', '2025-09-28', '7800.00', '', '256GB 原色钛金属', '使用中')
    seedPhysicalAssets.run(3, 'MacBook Pro 14"', '数码', '💻', '14999.00', '2025-06-10', '12000.00', '', 'M4 Pro芯片，24GB内存', '使用中')
    seedPhysicalAssets.run(4, '戴森V15吸尘器', '家电', '🧹', '4990.00', '2025-03-20', '3200.00', '', '每日打扫必备', '使用中')
    seedPhysicalAssets.run(5, 'iPad Air M2', '数码', '📟', '4799.00', '2025-11-01', '3800.00', '', '11寸，主要用来看剧和笔记', '使用中')
    seedPhysicalAssets.run(6, '比亚迪汉EV', '汽车', '🚗', '229800.00', '2025-01-15', '185000.00', '', '纯电续航605km，每年保险约6000', '使用中')
    seedPhysicalAssets.run(7, 'LV Neverfull 手袋', '奢侈品', '👜', '12800.00', '2024-11-20', '11500.00', '', '经典老花款，二手市场较保值', '使用中')
    seedPhysicalAssets.run(8, '索尼 PS5', '数码', '🎮', '3899.00', '2025-07-15', '2800.00', '', '光驱版，周末娱乐', '使用中')
    seedPhysicalAssets.run(9, '小米空气净化器4 Pro', '家电', '🌬️', '1999.00', '2025-10-05', '1400.00', '', '滤芯半年换一次', '使用中')
    seedPhysicalAssets.run(10, '卡地亚蓝气球腕表', '奢侈品', '⌚', '45000.00', '2024-05-18', '43000.00', '', '42mm钢带款，日常佩戴', '使用中')
    seedPhysicalAssets.run(11, '戴尔27寸4K显示器', '数码', '🖥️', '3299.00', '2024-08-22', '1800.00', '', 'U2723QE，编程利器', '使用中')
    seedPhysicalAssets.run(12, '任天堂Switch OLED', '数码', '🕹️', '2599.00', '2025-02-14', '1900.00', '', '塞尔达专用机', '使用中')
  })

  insertAll()
}

export function closeDatabase() {
  if (db) {
    db.close()
    db = null
  }
}
