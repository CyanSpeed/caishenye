import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/types'

const api = {
  // Ping
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.PING),

  // Accounts
  getAccounts: () => ipcRenderer.invoke(IPC_CHANNELS.GET_ACCOUNTS),
  addAccount: (account: any) => ipcRenderer.invoke(IPC_CHANNELS.ADD_ACCOUNT, account),
  updateAccount: (id: number, updates: any) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_ACCOUNT, id, updates),
  deleteAccount: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_ACCOUNT, id),

  // Categories
  getCategories: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CATEGORIES),

  // Transactions
  getTransactions: () => ipcRenderer.invoke(IPC_CHANNELS.GET_TRANSACTIONS),
  addTransaction: (tx: any) => ipcRenderer.invoke(IPC_CHANNELS.ADD_TRANSACTION, tx),

  // Investment Snapshots
  getInvestmentSnapshots: () => ipcRenderer.invoke(IPC_CHANNELS.GET_INVESTMENT_SNAPSHOTS),
  addInvestmentSnapshot: (snapshot: any) => ipcRenderer.invoke(IPC_CHANNELS.ADD_INVESTMENT_SNAPSHOT, snapshot),
  updateInvestmentSnapshot: (id: number, updates: any) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_INVESTMENT_SNAPSHOT, id, updates),

  // Physical Assets
  getPhysicalAssets: () => ipcRenderer.invoke(IPC_CHANNELS.GET_PHYSICAL_ASSETS),
  addPhysicalAsset: (asset: any) => ipcRenderer.invoke(IPC_CHANNELS.ADD_PHYSICAL_ASSET, asset),
  updatePhysicalAsset: (id: number, updates: any) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_PHYSICAL_ASSET, id, updates),
  deletePhysicalAsset: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_PHYSICAL_ASSET, id),
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
