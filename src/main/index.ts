import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { initDatabase, closeDatabase } from './db/init'
import * as ops from './db/operations'
import { IPC_CHANNELS } from '@shared/types'
import { exportHTMLToPDF } from './report/export'

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
