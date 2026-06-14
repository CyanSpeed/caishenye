import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { RecognitionConfig, BatchImportParams } from '@shared/types'

const api = {
  // Ping
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.PING),

  // Accounts
  getAccounts: () => ipcRenderer.invoke(IPC_CHANNELS.GET_ACCOUNTS),
  addAccount: (account: any) => ipcRenderer.invoke(IPC_CHANNELS.ADD_ACCOUNT, account),
  updateAccount: (id: number, updates: any) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_ACCOUNT, id, updates),
  deleteAccount: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_ACCOUNT, id),
  syncBalance: (params: any) => ipcRenderer.invoke(IPC_CHANNELS.SYNC_BALANCE, params),
  getBalanceSnapshots: (accountId: number) => ipcRenderer.invoke(IPC_CHANNELS.GET_BALANCE_SNAPSHOTS, accountId),

  // Categories
  getCategories: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CATEGORIES),

  // Transactions
  getTransactions: () => ipcRenderer.invoke(IPC_CHANNELS.GET_TRANSACTIONS),
  addTransaction: (tx: any) => ipcRenderer.invoke(IPC_CHANNELS.ADD_TRANSACTION, tx),
  updateTransaction: (id: number, updates: any) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_TRANSACTION, id, updates),
  deleteTransaction: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_TRANSACTION, id),

  // Investment Snapshots
  getInvestmentSnapshots: () => ipcRenderer.invoke(IPC_CHANNELS.GET_INVESTMENT_SNAPSHOTS),
  addInvestmentSnapshot: (snapshot: any) => ipcRenderer.invoke(IPC_CHANNELS.ADD_INVESTMENT_SNAPSHOT, snapshot),
  updateInvestmentSnapshot: (id: number, updates: any) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_INVESTMENT_SNAPSHOT, id, updates),

  // Physical Assets
  getPhysicalAssets: () => ipcRenderer.invoke(IPC_CHANNELS.GET_PHYSICAL_ASSETS),
  addPhysicalAsset: (asset: any) => ipcRenderer.invoke(IPC_CHANNELS.ADD_PHYSICAL_ASSET, asset),
  updatePhysicalAsset: (id: number, updates: any) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_PHYSICAL_ASSET, id, updates),
  deletePhysicalAsset: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_PHYSICAL_ASSET, id),

  // Settings
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
  updateSetting: (key: string, value: string) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SETTING, key, value),

  // Net Worth Snapshots
  getNetWorthSnapshots: () => ipcRenderer.invoke(IPC_CHANNELS.GET_NET_WORTH_SNAPSHOTS),

  // Quarterly Report
  generateReport: (period: string, year: number, periodValue: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GENERATE_REPORT, period, year, periodValue),
  exportReportPDF: (html: string, defaultName?: string) => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_REPORT_PDF, html, defaultName),

  // Image Recognition
  recognizeExpenseImage: (imageBase64: string, config: RecognitionConfig) =>
    ipcRenderer.invoke(IPC_CHANNELS.RECOGNIZE_EXPENSE_IMAGE, imageBase64, config),
  batchAddTransactions: (params: BatchImportParams) =>
    ipcRenderer.invoke(IPC_CHANNELS.BATCH_ADD_TRANSACTIONS, params),

  // Reset
  resetTransactionData: () => ipcRenderer.invoke(IPC_CHANNELS.RESET_TRANSACTION_DATA),

  // Database Export
  exportDatabase: () => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_DATABASE),
  getDatabasePath: () => ipcRenderer.invoke(IPC_CHANNELS.GET_DATABASE_PATH),

  // File Dialog
  selectImageFile: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_IMAGE_FILE),
  selectDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_DIRECTORY),

  // Auto Backup
  getBackupConfig: () => ipcRenderer.invoke(IPC_CHANNELS.GET_BACKUP_CONFIG),
  updateBackupConfig: (config: { enabled: boolean; directory: string; frequency: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_BACKUP_CONFIG, config),
  runBackup: () => ipcRenderer.invoke(IPC_CHANNELS.RUN_BACKUP),

  // Window Controls (frameless title bar)
  minimizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
  maximizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
  closeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
  isMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED),
  onMaximizedChange: (callback: (maximized: boolean) => void) => {
    ipcRenderer.on('window-maximized', (_event, maximized) => callback(maximized))
  },
  removeMaximizedListener: () => {
    ipcRenderer.removeAllListeners('window-maximized')
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
