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
  migrateDatabase(db)
  seedIfEmpty(db)

  return db
}

function createTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('asset', 'liability')),
      sub_type TEXT NOT NULL CHECK(sub_type IN ('cash', 'bank', 'investment', 'receivable', 'mortgage', 'consumer_loan', 'private_loan')),
      balance TEXT NOT NULL DEFAULT '0.00',
      currency TEXT NOT NULL DEFAULT 'CNY',
      is_active INTEGER NOT NULL DEFAULT 1,
      notes TEXT DEFAULT '',
      original_amount TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      icon TEXT NOT NULL DEFAULT '',
      expense_nature TEXT DEFAULT '' CHECK(expense_nature IN ('', 'fixed', 'variable')),
      cashflow_type TEXT DEFAULT 'operating' CHECK(cashflow_type IN ('operating', 'investing', 'financing'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS net_worth_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      total_assets TEXT NOT NULL,
      total_liabilities TEXT NOT NULL,
      net_worth TEXT NOT NULL
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
      member_name TEXT DEFAULT '',
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
      category TEXT NOT NULL CHECK(category IN ('家电', '数码', '汽车', '奢侈品', '房产')),
      icon_emoji TEXT DEFAULT '',
      purchase_price TEXT NOT NULL,
      purchase_date TEXT NOT NULL,
      current_value TEXT NOT NULL,
      image_url TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT '使用中' CHECK(status IN ('使用中', '已出售', '已报废'))
    );

    CREATE TABLE IF NOT EXISTS balance_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      old_balance TEXT NOT NULL,
      new_balance TEXT NOT NULL,
      diff TEXT NOT NULL,
      diff_handling TEXT NOT NULL DEFAULT 'ignore' CHECK(diff_handling IN ('expense', 'income', 'ignore')),
      note TEXT DEFAULT '',
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS physical_asset_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      physical_asset_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      old_value TEXT NOT NULL,
      new_value TEXT NOT NULL,
      note TEXT DEFAULT '',
      FOREIGN KEY (physical_asset_id) REFERENCES physical_assets(id)
    );
  `)
}

function migrateDatabase(db: Database.Database) {
  // 为已有数据库添加新列（兼容旧版本）
  const addColumnIfNotExists = (table: string, column: string, definition: string) => {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    } catch {
      // 列已存在，忽略错误
    }
  }
  addColumnIfNotExists('accounts', 'notes', "TEXT DEFAULT ''")
  addColumnIfNotExists('accounts', 'original_amount', "TEXT DEFAULT ''")
  addColumnIfNotExists('accounts', 'sync_mode', "TEXT DEFAULT 'approximate'")
  addColumnIfNotExists('accounts', 'last_synced_at', "TEXT DEFAULT NULL")
  addColumnIfNotExists('categories', 'expense_nature', "TEXT DEFAULT ''")
  addColumnIfNotExists('categories', 'cashflow_type', "TEXT DEFAULT 'operating'")
  addColumnIfNotExists('transactions', 'member_name', "TEXT DEFAULT ''")

  // 迁移：physical_assets 表的 CHECK 约束添加 '房产' 分类
  // SQLite 不支持修改 CHECK 约束，需要重建表
  try {
    const hasOldConstraint = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='physical_assets'"
    ).get() as { sql: string } | undefined

    if (hasOldConstraint && !hasOldConstraint.sql.includes("'房产'")) {
      db.exec(`
        CREATE TABLE physical_assets_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          category TEXT NOT NULL CHECK(category IN ('家电', '数码', '汽车', '奢侈品', '房产')),
          icon_emoji TEXT DEFAULT '',
          purchase_price TEXT NOT NULL,
          purchase_date TEXT NOT NULL,
          current_value TEXT NOT NULL,
          image_url TEXT DEFAULT '',
          notes TEXT DEFAULT '',
          status TEXT NOT NULL DEFAULT '使用中' CHECK(status IN ('使用中', '已出售', '已报废'))
        );
        INSERT INTO physical_assets_new SELECT * FROM physical_assets;
        DROP TABLE physical_assets;
        ALTER TABLE physical_assets_new RENAME TO physical_assets;
      `)
    }
  } catch {
    // 迁移已执行或表不存在，忽略
  }

}

function seedIfEmpty(db: Database.Database) {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM accounts').get() as { cnt: number }
  if (count.cnt > 0) return

  const seedAccounts = db.prepare(`
    INSERT INTO accounts (id, name, type, sub_type, balance, currency, is_active, notes, original_amount, sync_mode, last_synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const seedCategories = db.prepare(`
    INSERT INTO categories (id, name, type, icon, expense_nature, cashflow_type) VALUES (?, ?, ?, ?, ?, ?)
  `)
  const seedTransactions = db.prepare(`
    INSERT INTO transactions (id, date, type, amount, from_account_id, to_account_id, category_id, description, tags, member_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const seedSnapshots = db.prepare(`
    INSERT INTO investment_snapshots (id, account_id, date, market_value, cost_basis, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const seedPhysicalAssets = db.prepare(`
    INSERT INTO physical_assets (id, name, category, icon_emoji, purchase_price, purchase_date, current_value, image_url, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const seedSettings = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
  `)
  const seedNetWorth = db.prepare(`
    INSERT INTO net_worth_snapshots (id, date, total_assets, total_liabilities, net_worth) VALUES (?, ?, ?, ?, ?)
  `)

  const insertAll = db.transaction(() => {
    // ========== Accounts ==========
    // 资产账户 - exact=精确同步(银行/投资), approximate=近似记账(现金/电子钱包)
    seedAccounts.run(1, '现金钱包', 'asset', 'cash', '5000.00', 'CNY', 1, '日常现金备用', '', 'approximate', null)
    seedAccounts.run(2, '招商银行储蓄卡', 'asset', 'bank', '156800.50', 'CNY', 1, '主工资卡，每月工资入账', '', 'exact', '2026-06-01')
    seedAccounts.run(3, '工商银行工资卡', 'asset', 'bank', '42300.00', 'CNY', 1, '副卡，理财专用', '', 'exact', '2026-06-01')
    seedAccounts.run(4, '支付宝余额', 'asset', 'cash', '8520.75', 'CNY', 1, '日常消费主力', '', 'approximate', null)
    seedAccounts.run(5, '微信零钱', 'asset', 'cash', '1230.00', 'CNY', 1, '社交红包和小额支付', '', 'approximate', null)
    seedAccounts.run(6, '华泰证券股票账户', 'asset', 'investment', '285000.00', 'CNY', 1, 'A股投资，长期持有为主', '', 'exact', '2026-06-01')
    seedAccounts.run(7, '易方达基金账户', 'asset', 'investment', '120000.00', 'CNY', 1, '定投指数基金', '', 'exact', '2026-06-01')
    seedAccounts.run(8, '建设银行定期存款', 'asset', 'investment', '200000.00', 'CNY', 1, '3年期定期，2027年到期', '', 'exact', '2026-06-01')
    // 负债账户 - 负债都是精确同步
    seedAccounts.run(9, '房贷账户', 'liability', 'mortgage', '1200000.00', 'CNY', 1, '2023年购房贷款，30年期，月供6500', '1500000.00', 'exact', '2026-06-01')
    seedAccounts.run(10, '车贷账户', 'liability', 'consumer_loan', '85000.00', 'CNY', 1, '比亚迪汉EV车贷，3年期', '120000.00', 'exact', '2026-06-01')
    seedAccounts.run(11, '招商银行信用卡', 'liability', 'consumer_loan', '12500.00', 'CNY', 1, '每月10日还款，额度5万', '12500.00', 'exact', '2026-06-01')
    seedAccounts.run(12, '花呗', 'liability', 'consumer_loan', '3200.00', 'CNY', 1, '每月20日自动还款', '3200.00', 'exact', '2026-06-01')
    // 债权资产
    seedAccounts.run(13, '朋友借款-张三', 'asset', 'receivable', '5000.00', 'CNY', 1, '2025年借出，预计年底归还', '', 'approximate', null)

    // ========== Categories ==========
    // 支出分类（新的12种分类）
    seedCategories.run(1, '居住与房贷', 'expense', 'home', 'fixed', 'financing')
    seedCategories.run(2, '水电燃气与通讯', 'expense', 'zap', 'fixed', 'operating')
    seedCategories.run(3, '餐饮与食品', 'expense', 'restaurant', 'variable', 'operating')
    seedCategories.run(4, '交通与车辆养护', 'expense', 'car', 'variable', 'operating')
    seedCategories.run(5, '教育与自我提升', 'expense', 'book', 'variable', 'operating')
    seedCategories.run(6, '医疗与健康', 'expense', 'medical', 'variable', 'operating')
    seedCategories.run(7, '服饰与个人形象', 'expense', 'shirt', 'variable', 'operating')
    seedCategories.run(8, '家居日用与耐用品', 'expense', 'cart', 'variable', 'operating')
    seedCategories.run(9, '休闲娱乐与社交', 'expense', 'gamepad', 'variable', 'operating')
    seedCategories.run(10, '宠物支出', 'expense', 'heart', 'variable', 'operating')
    seedCategories.run(11, '金融与保险支出', 'expense', 'shield', 'fixed', 'financing')
    seedCategories.run(12, '其他与杂项', 'expense', 'gift', 'variable', 'operating')
    // 收入分类
    seedCategories.run(13, '工资', 'income', 'cash', '', 'operating')
    seedCategories.run(14, '投资收益', 'income', 'trending-up', '', 'investing')
    seedCategories.run(15, '兼职收入', 'income', 'briefcase', '', 'operating')
    seedCategories.run(16, '利息收入', 'income', 'percent', '', 'investing')
    seedCategories.run(17, '其他收入', 'income', 'gift', '', 'operating')
    seedCategories.run(18, '公积金提取', 'income', 'bank', '', 'financing')
    seedCategories.run(19, '奖金', 'income', 'trophy', '', 'operating')

    // ========== Settings ==========
    seedSettings.run('family_info', JSON.stringify({
      familyName: '张先生家庭',
      members: [
        { name: '张先生', role: '户主', age: 35, avatar: '' },
        { name: '李女士', role: '配偶', age: 33, avatar: '' },
        { name: '张小明', role: '子女', age: 6, avatar: '' }
      ],
      city: '上海',
      preparer: '李女士 (家庭CFO)',
      reviewer: '张先生'
    }))

    // ========== Net Worth Snapshots ==========
    seedNetWorth.run(1, '2025-09-30', '760000.00', '1330000.00', '-570000.00')
    seedNetWorth.run(2, '2025-12-31', '790000.00', '1310000.00', '-520000.00')
    seedNetWorth.run(3, '2026-03-31', '820551.25', '1298200.00', '-477648.75')

    // ========== Transactions ==========
    // ---- 2026年1月 ----
    // 分类ID映射: 1=居住与房贷, 2=水电燃气与通讯, 3=餐饮与食品, 4=交通与车辆养护,
    // 5=教育与自我提升, 6=医疗与健康, 7=服饰与个人形象, 8=家居日用与耐用品,
    // 9=休闲娱乐与社交, 10=宠物支出, 11=金融与保险支出, 12=其他与杂项
    seedTransactions.run(1, '2026-01-03', 'income', '28500.00', null, 3, 13, '12月工资', '["工资","固定收入"]', '')
    seedTransactions.run(2, '2026-01-05', 'expense', '6500.00', 2, null, 1, '1月房贷月供', '["居住","房贷"]', '')
    seedTransactions.run(3, '2026-01-05', 'transfer', '5000.00', 3, 4, null, '转入支付宝日常使用', '["转账","内部"]', '')
    seedTransactions.run(4, '2026-01-06', 'expense', '3200.00', 2, null, 4, '车贷月供', '["交通","车贷"]', '')
    seedTransactions.run(5, '2026-01-08', 'expense', '420.00', 2, null, 2, '物业费+水电煤', '["水电燃气","物业"]', '')
    seedTransactions.run(6, '2026-01-08', 'expense', '150.00', 4, null, 2, '手机+宽带费', '["通讯","固定"]', '')
    seedTransactions.run(7, '2026-01-10', 'expense', '850.00', 4, null, 3, '超市采购年货食材', '["餐饮","日常"]', '李女士')
    seedTransactions.run(8, '2026-01-12', 'expense', '380.00', 2, null, 4, '加油', '["交通","汽车"]', '张先生')
    seedTransactions.run(9, '2026-01-12', 'expense', '280.00', 4, null, 9, '电影+奶茶', '["娱乐","社交"]', '李女士')
    seedTransactions.run(10, '2026-01-14', 'expense', '2000.00', 2, null, 5, '孩子寒假兴趣班', '["教育","兴趣班"]', '张小明')
    seedTransactions.run(11, '2026-01-15', 'expense', '3000.00', 2, null, 11, '基金定投', '["金融","定投"]', '张先生')
    seedTransactions.run(12, '2026-01-18', 'expense', '1500.00', 4, null, 8, '年货购物', '["家居日用","年货"]', '李女士')
    seedTransactions.run(13, '2026-01-20', 'transfer', '4500.00', 2, 11, null, '还信用卡', '["转账","还款"]', '')
    seedTransactions.run(14, '2026-01-20', 'transfer', '2800.00', 2, 12, null, '还花呗', '["转账","还款"]', '')
    seedTransactions.run(15, '2026-01-22', 'expense', '450.00', 4, null, 3, '朋友聚餐', '["餐饮","社交"]', '张先生')
    seedTransactions.run(16, '2026-01-25', 'expense', '1200.00', 2, null, 7, '冬装采购', '["服饰","服装"]', '张先生')
    seedTransactions.run(17, '2026-01-28', 'income', '1050.00', null, 6, 14, '股票分红', '["投资","分红"]', '')

    // ---- 2026年2月 ----
    seedTransactions.run(18, '2026-02-03', 'income', '28500.00', null, 3, 13, '1月工资', '["工资","固定收入"]', '')
    seedTransactions.run(19, '2026-02-05', 'expense', '6500.00', 2, null, 1, '2月房贷月供', '["居住","房贷"]', '')
    seedTransactions.run(20, '2026-02-05', 'transfer', '5000.00', 3, 4, null, '转入支付宝日常使用', '["转账","内部"]', '')
    seedTransactions.run(21, '2026-02-06', 'expense', '3200.00', 2, null, 4, '车贷月供', '["交通","车贷"]', '')
    seedTransactions.run(22, '2026-02-08', 'expense', '380.00', 2, null, 2, '物业费+水电煤', '["水电燃气","物业"]', '')
    seedTransactions.run(23, '2026-02-08', 'expense', '150.00', 4, null, 2, '手机+宽带费', '["通讯","固定"]', '')
    seedTransactions.run(24, '2026-02-10', 'expense', '720.00', 4, null, 3, '超市采购食材', '["餐饮","日常"]', '李女士')
    seedTransactions.run(25, '2026-02-12', 'expense', '460.00', 2, null, 4, '加油+过路费', '["交通","汽车"]', '张先生')
    seedTransactions.run(26, '2026-02-14', 'expense', '580.00', 4, null, 9, '情人节晚餐+礼物', '["娱乐","节日"]', '张先生')
    seedTransactions.run(27, '2026-02-15', 'expense', '3000.00', 2, null, 11, '基金定投', '["金融","定投"]', '张先生')
    seedTransactions.run(28, '2026-02-18', 'expense', '1500.00', 2, null, 5, '孩子开学学费', '["教育","学费"]', '张小明')
    seedTransactions.run(29, '2026-02-20', 'transfer', '5200.00', 2, 11, null, '还信用卡', '["转账","还款"]', '')
    seedTransactions.run(30, '2026-02-20', 'transfer', '1800.00', 2, 12, null, '还花呗', '["转账","还款"]', '')
    seedTransactions.run(31, '2026-02-22', 'expense', '650.00', 4, null, 3, '周末家庭聚餐', '["餐饮","社交"]', '李女士')
    seedTransactions.run(32, '2026-02-25', 'expense', '200.00', 4, null, 9, '视频会员续费', '["娱乐","订阅"]', '张先生')
    seedTransactions.run(33, '2026-02-26', 'income', '2000.00', null, 4, 15, '周末培训讲课费', '["兼职","培训"]', '')
    seedTransactions.run(34, '2026-02-28', 'expense', '350.00', 2, null, 6, '感冒看诊+药费', '["医疗","健康"]', '张小明')

    // ---- 2026年3月 ----
    seedTransactions.run(35, '2026-03-03', 'income', '28500.00', null, 3, 13, '2月工资', '["工资","固定收入"]', '')
    seedTransactions.run(36, '2026-03-05', 'expense', '6500.00', 2, null, 1, '3月房贷月供', '["居住","房贷"]', '')
    seedTransactions.run(37, '2026-03-05', 'transfer', '5000.00', 3, 4, null, '转入支付宝日常使用', '["转账","内部"]', '')
    seedTransactions.run(38, '2026-03-06', 'expense', '3200.00', 2, null, 4, '车贷月供', '["交通","车贷"]', '')
    seedTransactions.run(39, '2026-03-08', 'expense', '450.00', 2, null, 2, '物业费+水电煤', '["水电燃气","物业"]', '')
    seedTransactions.run(40, '2026-03-08', 'expense', '150.00', 4, null, 2, '手机+宽带费', '["通讯","固定"]', '')
    seedTransactions.run(41, '2026-03-10', 'expense', '900.00', 4, null, 3, '超市采购+外卖', '["餐饮","日常"]', '李女士')
    seedTransactions.run(42, '2026-03-10', 'expense', '4500.00', 2, null, 11, '季度保险费（重疾险+车险）', '["金融","保险"]', '')
    seedTransactions.run(43, '2026-03-12', 'expense', '350.00', 2, null, 4, '加油', '["交通","汽车"]', '张先生')
    seedTransactions.run(44, '2026-03-15', 'expense', '3000.00', 2, null, 11, '基金定投', '["金融","定投"]', '张先生')
    seedTransactions.run(45, '2026-03-16', 'expense', '800.00', 4, null, 8, '日用品采购', '["家居日用","日用"]', '李女士')
    seedTransactions.run(46, '2026-03-18', 'expense', '2000.00', 2, null, 5, '孩子兴趣班续费', '["教育","兴趣班"]', '张小明')
    seedTransactions.run(47, '2026-03-20', 'transfer', '4800.00', 2, 11, null, '还信用卡', '["转账","还款"]', '')
    seedTransactions.run(48, '2026-03-20', 'transfer', '2200.00', 2, 12, null, '还花呗', '["转账","还款"]', '')
    seedTransactions.run(49, '2026-03-22', 'expense', '500.00', 4, null, 3, '周末外出就餐', '["餐饮","社交"]', '李女士')
    seedTransactions.run(50, '2026-03-25', 'expense', '300.00', 4, null, 9, '电影票', '["娱乐","休闲"]', '李女士')
    seedTransactions.run(51, '2026-03-28', 'income', '1800.00', null, 6, 14, '股票分红', '["投资","分红"]', '')
    seedTransactions.run(52, '2026-03-29', 'income', '500.00', null, 2, 16, '定期存款利息', '["利息","存款"]', '')
    seedTransactions.run(53, '2026-03-30', 'expense', '400.00', 2, null, 6, '年度体检', '["医疗","体检"]', '张先生')

    // ---- 2026年4月 ----
    seedTransactions.run(54, '2026-04-10', 'income', '1250.00', null, 6, 14, '股票分红', '["投资","分红"]', '')
    seedTransactions.run(55, '2026-04-15', 'expense', '156.00', 4, null, 3, '超市采购食材', '["餐饮","日常"]', '李女士')
    seedTransactions.run(56, '2026-04-20', 'transfer', '3500.00', 2, 11, null, '还信用卡', '["转账","还款"]', '')
    seedTransactions.run(57, '2026-04-22', 'expense', '6500.00', 2, null, 1, '房贷月供', '["居住","房贷"]', '')
    seedTransactions.run(58, '2026-04-24', 'income', '3500.00', null, 4, 15, '周末培训讲课费', '["兼职","培训"]', '')
    seedTransactions.run(59, '2026-04-25', 'expense', '380.00', 2, null, 6, '体检', '["医疗","健康"]', '张先生')
    seedTransactions.run(60, '2026-04-26', 'expense', '89.90', 4, null, 9, 'Netflix月费', '["娱乐","订阅"]', '张先生')
    seedTransactions.run(61, '2026-04-27', 'expense', '200.00', 2, null, 4, '加油', '["交通","汽车"]', '张先生')
    seedTransactions.run(62, '2026-04-28', 'expense', '2500.00', 2, null, 1, '房租+水电', '["居住","固定支出"]', '')
    seedTransactions.run(63, '2026-04-28', 'transfer', '5000.00', 3, 4, null, '转入支付宝日常使用', '["转账","内部"]', '')
    seedTransactions.run(64, '2026-04-30', 'expense', '150.00', 5, null, 3, '朋友聚餐AA', '["餐饮","社交"]', '张先生')

    // ---- 2026年5月 ----
    seedTransactions.run(65, '2026-05-01', 'income', '28500.00', null, 3, 13, '4月工资', '["工资","固定收入"]', '')
    seedTransactions.run(66, '2026-05-01', 'expense', '320.00', 2, null, 7, '优衣库T恤', '["服饰","服装"]', '张先生')
    seedTransactions.run(67, '2026-05-02', 'expense', '48.50', 4, null, 3, '午餐外卖 - 黄焖鸡米饭', '["餐饮","外卖"]', '张先生')

    // ========== Investment Snapshots ==========
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

    // ========== Physical Assets ==========
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
