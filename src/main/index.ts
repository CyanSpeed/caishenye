import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { execSync } from 'child_process'
import { initDatabase, closeDatabase } from './db/init'
import * as ops from './db/operations'
import { IPC_CHANNELS } from '@shared/types'
import type { RecognitionConfig, BatchImportParams } from '@shared/types'
import { exportHTMLToPDF } from './report/export'
import { recognizeExpenseImage } from './recognition'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { readFile } from 'fs/promises'

// 设置控制台编码为UTF-8（解决Windows中文乱码问题）
if (process.platform === 'win32') {
  try {
    execSync('chcp 65001', { stdio: 'ignore' })
  } catch {
    // 忽略错误
  }
}

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: '财神爷 - 个人财务管理',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'))
  }
}

function registerIpcHandlers() {
  // Ping
  ipcMain.handle(IPC_CHANNELS.PING, () => 'pong')

  // Accounts
  ipcMain.handle(IPC_CHANNELS.GET_ACCOUNTS, () => ops.getAllAccounts())
  ipcMain.handle(IPC_CHANNELS.ADD_ACCOUNT, (_event, account) => ops.addAccount(account))
  ipcMain.handle(IPC_CHANNELS.UPDATE_ACCOUNT, (_event, id, updates) => ops.updateAccount(id, updates))
  ipcMain.handle(IPC_CHANNELS.DELETE_ACCOUNT, (_event, id) => ops.deleteAccount(id))
  ipcMain.handle(IPC_CHANNELS.SYNC_BALANCE, (_event, params) => ops.syncBalance(params))
  ipcMain.handle(IPC_CHANNELS.GET_BALANCE_SNAPSHOTS, (_event, accountId) => ops.getBalanceSnapshots(accountId))

  // Categories
  ipcMain.handle(IPC_CHANNELS.GET_CATEGORIES, () => ops.getAllCategories())

  // Transactions
  ipcMain.handle(IPC_CHANNELS.GET_TRANSACTIONS, () => ops.getAllTransactions())
  ipcMain.handle(IPC_CHANNELS.ADD_TRANSACTION, (_event, tx) => ops.addTransaction(tx))
  ipcMain.handle(IPC_CHANNELS.UPDATE_TRANSACTION, (_event, id, updates) => ops.updateTransaction(id, updates))
  ipcMain.handle(IPC_CHANNELS.DELETE_TRANSACTION, (_event, id) => ops.deleteTransaction(id))

  // Investment Snapshots
  ipcMain.handle(IPC_CHANNELS.GET_INVESTMENT_SNAPSHOTS, () => ops.getAllInvestmentSnapshots())
  ipcMain.handle(IPC_CHANNELS.ADD_INVESTMENT_SNAPSHOT, (_event, snapshot) => ops.addInvestmentSnapshot(snapshot))
  ipcMain.handle(IPC_CHANNELS.UPDATE_INVESTMENT_SNAPSHOT, (_event, id, updates) => ops.updateInvestmentSnapshot(id, updates))

  // Physical Assets
  ipcMain.handle(IPC_CHANNELS.GET_PHYSICAL_ASSETS, () => ops.getAllPhysicalAssets())
  ipcMain.handle(IPC_CHANNELS.ADD_PHYSICAL_ASSET, (_event, asset) => ops.addPhysicalAsset(asset))
  ipcMain.handle(IPC_CHANNELS.UPDATE_PHYSICAL_ASSET, (_event, id, updates) => ops.updatePhysicalAsset(id, updates))
  ipcMain.handle(IPC_CHANNELS.DELETE_PHYSICAL_ASSET, (_event, id) => ops.deletePhysicalAsset(id))

  // Settings
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => ops.getAllSettings())
  ipcMain.handle(IPC_CHANNELS.UPDATE_SETTING, (_event, key, value) => ops.updateSetting(key, value))

  // Net Worth Snapshots
  ipcMain.handle(IPC_CHANNELS.GET_NET_WORTH_SNAPSHOTS, () => ops.getAllNetWorthSnapshots())

  // Quarterly Report
  ipcMain.handle(IPC_CHANNELS.GENERATE_REPORT, (_event, year, quarter) => ops.generateQuarterlyReport(year, quarter))

  // Export Report PDF - 接收渲染好的 HTML 字符串和可选的默认文件名
  ipcMain.handle(IPC_CHANNELS.EXPORT_REPORT_PDF, async (_event, html: string, defaultName?: string) => {
    const pdfBuffer = await exportHTMLToPDF(html)
    // 弹出保存对话框
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '保存财务报告 PDF',
      defaultPath: defaultName || '财务报告.pdf',
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
    })
    if (canceled || !filePath) return { canceled: true }
    const fs = await import('fs/promises')
    await fs.writeFile(filePath, pdfBuffer)
    return { canceled: false, filePath }
  })

  // Image Recognition - 识别图像中的支出分类
  ipcMain.handle(IPC_CHANNELS.RECOGNIZE_EXPENSE_IMAGE, async (_event, imageBase64: string, config: RecognitionConfig) => {
    return await recognizeExpenseImage(imageBase64, config)
  })

  // Batch Add Transactions - 批量导入交易记录
  ipcMain.handle(IPC_CHANNELS.BATCH_ADD_TRANSACTIONS, (_event, params: BatchImportParams) => {
    return ops.batchAddTransactions(params)
  })

  // Reset Transaction Data - 重置交易记账数据
  ipcMain.handle(IPC_CHANNELS.RESET_TRANSACTION_DATA, () => {
    return ops.resetTransactionData()
  })

  // Database Export - 导出数据库文件
  ipcMain.handle(IPC_CHANNELS.EXPORT_DATABASE, async () => {
    const dbPath = join(app.getPath('userData'), 'finance.db')
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出数据库备份',
      defaultPath: `finance_backup_${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'SQLite 数据库', extensions: ['db'] }],
    })
    if (canceled || !filePath) return { canceled: true }
    copyFileSync(dbPath, filePath)
    return { canceled: false, filePath }
  })

  // Get Database Path - 获取数据库路径（用于自动备份）
  ipcMain.handle(IPC_CHANNELS.GET_DATABASE_PATH, () => {
    return join(app.getPath('userData'), 'finance.db')
  })

  // Select Directory - 选择目录
  ipcMain.handle(IPC_CHANNELS.SELECT_DIRECTORY, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '选择备份目录',
      properties: ['openDirectory'],
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })

  // Select Image File - 选择图片文件并返回 base64
  ipcMain.handle(IPC_CHANNELS.SELECT_IMAGE_FILE, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '选择头像图片',
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      properties: ['openFile'],
    })
    if (canceled || filePaths.length === 0) return null
    const filePath = filePaths[0]
    const buffer = await readFile(filePath)
    const ext = filePath.split('.').pop()?.toLowerCase() || 'png'
    const mime = ext === 'jpg' ? 'jpeg' : ext
    return `data:image/${mime};base64,${buffer.toString('base64')}`
  })

  // Backup Config - 获取/更新备份配置
  ipcMain.handle(IPC_CHANNELS.GET_BACKUP_CONFIG, () => {
    return {
      enabled: ops.getSetting('backup_enabled') === 'true',
      directory: ops.getSetting('backup_directory') || '',
      frequency: ops.getSetting('backup_frequency') || 'weekly',
    }
  })

  ipcMain.handle(IPC_CHANNELS.UPDATE_BACKUP_CONFIG, (_event, config: { enabled: boolean; directory: string; frequency: string }) => {
    ops.updateSetting('backup_enabled', String(config.enabled))
    ops.updateSetting('backup_directory', config.directory)
    ops.updateSetting('backup_frequency', config.frequency)
    return { success: true }
  })

  // Run Backup - 执行自动备份
  ipcMain.handle(IPC_CHANNELS.RUN_BACKUP, async () => {
    const enabled = ops.getSetting('backup_enabled') === 'true'
    const directory = ops.getSetting('backup_directory') || ''
    if (!enabled || !directory) return { success: false, reason: '自动备份未启用或未设置目录' }
    const dbPath = join(app.getPath('userData'), 'finance.db')
    const backupDir = directory
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true })
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const destPath = join(backupDir, `finance_auto_backup_${timestamp}.db`)
    copyFileSync(dbPath, destPath)
    return { success: true, filePath: destPath }
  })
}

app.whenReady().then(() => {
  initDatabase()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
