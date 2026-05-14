import type { Account, Transaction, InvestmentSnapshot, Category, PhysicalAsset } from '@shared/types'

export const mockAccounts: Account[] = [
  { id: 1, name: '现金钱包', type: 'asset', sub_type: 'cash', balance: '5000.00', currency: 'CNY', is_active: true },
  { id: 2, name: '招商银行储蓄卡', type: 'asset', sub_type: 'bank', balance: '156800.50', currency: 'CNY', is_active: true },
  { id: 3, name: '工商银行工资卡', type: 'asset', sub_type: 'bank', balance: '42300.00', currency: 'CNY', is_active: true },
  { id: 4, name: '支付宝余额', type: 'asset', sub_type: 'cash', balance: '8520.75', currency: 'CNY', is_active: true },
  { id: 5, name: '微信零钱', type: 'asset', sub_type: 'cash', balance: '1230.00', currency: 'CNY', is_active: true },
  { id: 6, name: '华泰证券股票账户', type: 'asset', sub_type: 'investment', balance: '285000.00', currency: 'CNY', is_active: true },
  { id: 7, name: '易方达基金账户', type: 'asset', sub_type: 'investment', balance: '120000.00', currency: 'CNY', is_active: true },
  { id: 8, name: '建设银行定期存款', type: 'asset', sub_type: 'investment', balance: '200000.00', currency: 'CNY', is_active: true },
  { id: 9, name: '房贷账户', type: 'liability', sub_type: 'loan', balance: '1200000.00', currency: 'CNY', is_active: true },
  { id: 10, name: '车贷账户', type: 'liability', sub_type: 'loan', balance: '85000.00', currency: 'CNY', is_active: true },
  { id: 11, name: '招商银行信用卡', type: 'liability', sub_type: 'credit', balance: '12500.00', currency: 'CNY', is_active: true },
  { id: 12, name: '花呗', type: 'liability', sub_type: 'credit', balance: '3200.00', currency: 'CNY', is_active: true },
]

export const mockCategories: Category[] = [
  { id: 1, name: '餐饮', type: 'expense', icon: 'restaurant' },
  { id: 2, name: '交通', type: 'expense', icon: 'car' },
  { id: 3, name: '购物', type: 'expense', icon: 'cart' },
  { id: 4, name: '住房', type: 'expense', icon: 'home' },
  { id: 5, name: '娱乐', type: 'expense', icon: 'gamepad' },
  { id: 6, name: '医疗', type: 'expense', icon: 'medical' },
  { id: 7, name: '工资', type: 'income', icon: 'cash' },
  { id: 8, name: '投资收益', type: 'income', icon: 'trending-up' },
  { id: 9, name: '兼职收入', type: 'income', icon: 'briefcase' },
  { id: 10, name: '其他收入', type: 'income', icon: 'gift' },
]

export const mockTransactions: Transaction[] = [
  { id: 1, date: '2026-05-02', type: 'expense', amount: '48.50', from_account_id: 4, to_account_id: null, category_id: 1, description: '午餐外卖 - 黄焖鸡米饭', tags: '["餐饮","外卖"]' },
  { id: 2, date: '2026-05-01', type: 'expense', amount: '320.00', from_account_id: 2, to_account_id: null, category_id: 3, description: '优衣库T恤', tags: '["购物","服装"]' },
  { id: 3, date: '2026-05-01', type: 'income', amount: '28500.00', from_account_id: null, to_account_id: 3, category_id: 7, description: '4月工资', tags: '["工资","固定收入"]' },
  { id: 4, date: '2026-04-30', type: 'expense', amount: '150.00', from_account_id: 5, to_account_id: null, category_id: 1, description: '朋友聚餐AA', tags: '["餐饮","社交"]' },
  { id: 5, date: '2026-04-28', type: 'transfer', amount: '5000.00', from_account_id: 3, to_account_id: 4, category_id: null, description: '转入支付宝日常使用', tags: '["转账","内部"]' },
  { id: 6, date: '2026-04-28', type: 'expense', amount: '2500.00', from_account_id: 2, to_account_id: null, category_id: 4, description: '房租', tags: '["住房","固定支出"]' },
  { id: 7, date: '2026-04-27', type: 'expense', amount: '200.00', from_account_id: 2, to_account_id: null, category_id: 2, description: '加油', tags: '["交通","汽车"]' },
  { id: 8, date: '2026-04-26', type: 'expense', amount: '89.90', from_account_id: 4, to_account_id: null, category_id: 5, description: 'Netflix月费', tags: '["娱乐","订阅"]' },
  { id: 9, date: '2026-04-25', type: 'expense', amount: '380.00', from_account_id: 2, to_account_id: null, category_id: 6, description: '体检', tags: '["医疗","健康"]' },
  { id: 10, date: '2026-04-24', type: 'income', amount: '3500.00', from_account_id: null, to_account_id: 4, category_id: 9, description: '周末培训讲课费', tags: '["兼职","培训"]' },
  { id: 11, date: '2026-04-22', type: 'expense', amount: '6500.00', from_account_id: 2, to_account_id: null, category_id: 4, description: '房贷月供', tags: '["住房","贷款"]' },
  { id: 12, date: '2026-04-20', type: 'transfer', amount: '3500.00', from_account_id: 2, to_account_id: 11, category_id: null, description: '还信用卡', tags: '["转账","还款"]' },
  { id: 13, date: '2026-04-15', type: 'expense', amount: '156.00', from_account_id: 4, to_account_id: null, category_id: 1, description: '超市采购食材', tags: '["餐饮","日常"]' },
  { id: 14, date: '2026-04-10', type: 'income', amount: '1250.00', from_account_id: null, to_account_id: 6, category_id: 8, description: '股票分红', tags: '["投资","分红"]' },
]

export const mockSnapshots: InvestmentSnapshot[] = [
  { id: 1, account_id: 6, date: '2025-11-01', market_value: '250000.00', cost_basis: '240000.00', note: '月初快照' },
  { id: 2, account_id: 6, date: '2025-12-01', market_value: '258000.00', cost_basis: '240000.00', note: '月初快照' },
  { id: 3, account_id: 6, date: '2026-01-01', market_value: '262000.00', cost_basis: '240000.00', note: '年初快照' },
  { id: 4, account_id: 6, date: '2026-02-01', market_value: '275000.00', cost_basis: '245000.00', note: '追加投资1万' },
  { id: 5, account_id: 6, date: '2026-03-01', market_value: '280000.00', cost_basis: '245000.00', note: '月初快照' },
  { id: 6, account_id: 6, date: '2026-04-01', market_value: '285000.00', cost_basis: '245000.00', note: '月初快照' },
  { id: 7, account_id: 7, date: '2025-11-01', market_value: '105000.00', cost_basis: '100000.00', note: '基金定投' },
  { id: 8, account_id: 7, date: '2025-12-01', market_value: '110000.00', cost_basis: '100000.00', note: '基金定投' },
  { id: 9, account_id: 7, date: '2026-01-01', market_value: '108000.00', cost_basis: '100000.00', note: '市场回调' },
  { id: 10, account_id: 7, date: '2026-02-01', market_value: '115000.00', cost_basis: '100000.00', note: '基金定投' },
  { id: 11, account_id: 7, date: '2026-03-01', market_value: '118000.00', cost_basis: '100000.00', note: '基金定投' },
  { id: 12, account_id: 7, date: '2026-04-01', market_value: '120000.00', cost_basis: '100000.00', note: '基金定投' },
]

export const mockPhysicalAssets: PhysicalAsset[] = [
  {
    id: 1, name: 'TCL 85Q10L 电视', category: '家电', icon_emoji: '📺',
    purchase_price: '8999.00', purchase_date: '2025-12-15',
    current_value: '6500.00', image_url: '', notes: '85寸 Mini LED，保修3年',
    status: '使用中',
  },
  {
    id: 2, name: 'iPhone 16 Pro Max', category: '数码', icon_emoji: '📱',
    purchase_price: '9999.00', purchase_date: '2025-09-28',
    current_value: '7800.00', image_url: '', notes: '256GB 原色钛金属',
    status: '使用中',
  },
  {
    id: 3, name: 'MacBook Pro 14"', category: '数码', icon_emoji: '💻',
    purchase_price: '14999.00', purchase_date: '2025-06-10',
    current_value: '12000.00', image_url: '', notes: 'M4 Pro芯片，24GB内存',
    status: '使用中',
  },
  {
    id: 4, name: '戴森V15吸尘器', category: '家电', icon_emoji: '🧹',
    purchase_price: '4990.00', purchase_date: '2025-03-20',
    current_value: '3200.00', image_url: '', notes: '每日打扫必备',
    status: '使用中',
  },
  {
    id: 5, name: 'iPad Air M2', category: '数码', icon_emoji: '📟',
    purchase_price: '4799.00', purchase_date: '2025-11-01',
    current_value: '3800.00', image_url: '', notes: '11寸，主要用来看剧和笔记',
    status: '使用中',
  },
  {
    id: 6, name: '比亚迪汉EV', category: '汽车', icon_emoji: '🚗',
    purchase_price: '229800.00', purchase_date: '2025-01-15',
    current_value: '185000.00', image_url: '', notes: '纯电续航605km，每年保险约6000',
    status: '使用中',
  },
  {
    id: 7, name: 'LV Neverfull 手袋', category: '奢侈品', icon_emoji: '👜',
    purchase_price: '12800.00', purchase_date: '2024-11-20',
    current_value: '11500.00', image_url: '', notes: '经典老花款，二手市场较保值',
    status: '使用中',
  },
  {
    id: 8, name: '索尼 PS5', category: '数码', icon_emoji: '🎮',
    purchase_price: '3899.00', purchase_date: '2025-07-15',
    current_value: '2800.00', image_url: '', notes: '光驱版，周末娱乐',
    status: '使用中',
  },
  {
    id: 9, name: '小米空气净化器4 Pro', category: '家电', icon_emoji: '🌬️',
    purchase_price: '1999.00', purchase_date: '2025-10-05',
    current_value: '1400.00', image_url: '', notes: '滤芯半年换一次',
    status: '使用中',
  },
  {
    id: 10, name: '卡地亚蓝气球腕表', category: '奢侈品', icon_emoji: '⌚',
    purchase_price: '45000.00', purchase_date: '2024-05-18',
    current_value: '43000.00', image_url: '', notes: '42mm钢带款，日常佩戴',
    status: '使用中',
  },
  {
    id: 11, name: '戴尔27寸4K显示器', category: '数码', icon_emoji: '🖥️',
    purchase_price: '3299.00', purchase_date: '2024-08-22',
    current_value: '1800.00', image_url: '', notes: 'U2723QE，编程利器',
    status: '使用中',
  },
  {
    id: 12, name: '任天堂Switch OLED', category: '数码', icon_emoji: '🕹️',
    purchase_price: '2599.00', purchase_date: '2025-02-14',
    current_value: '1900.00', image_url: '', notes: '塞尔达专用机',
    status: '使用中',
  },
]
