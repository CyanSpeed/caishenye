"use strict";
const electron = require("electron");
const IPC_CHANNELS = {
  PING: "ping",
  // Accounts
  GET_ACCOUNTS: "get-accounts",
  ADD_ACCOUNT: "add-account",
  UPDATE_ACCOUNT: "update-account",
  DELETE_ACCOUNT: "delete-account",
  // Transactions
  GET_TRANSACTIONS: "get-transactions",
  ADD_TRANSACTION: "add-transaction",
  // Categories
  GET_CATEGORIES: "get-categories",
  // Investment Snapshots
  GET_INVESTMENT_SNAPSHOTS: "get-investment-snapshots",
  ADD_INVESTMENT_SNAPSHOT: "add-investment-snapshot",
  UPDATE_INVESTMENT_SNAPSHOT: "update-investment-snapshot",
  // Physical Assets
  GET_PHYSICAL_ASSETS: "get-physical-assets",
  ADD_PHYSICAL_ASSET: "add-physical-asset",
  UPDATE_PHYSICAL_ASSET: "update-physical-asset",
  DELETE_PHYSICAL_ASSET: "delete-physical-asset"
};
const api = {
  // Ping
  ping: () => electron.ipcRenderer.invoke(IPC_CHANNELS.PING),
  // Accounts
  getAccounts: () => electron.ipcRenderer.invoke(IPC_CHANNELS.GET_ACCOUNTS),
  addAccount: (account) => electron.ipcRenderer.invoke(IPC_CHANNELS.ADD_ACCOUNT, account),
  updateAccount: (id, updates) => electron.ipcRenderer.invoke(IPC_CHANNELS.UPDATE_ACCOUNT, id, updates),
  deleteAccount: (id) => electron.ipcRenderer.invoke(IPC_CHANNELS.DELETE_ACCOUNT, id),
  // Categories
  getCategories: () => electron.ipcRenderer.invoke(IPC_CHANNELS.GET_CATEGORIES),
  // Transactions
  getTransactions: () => electron.ipcRenderer.invoke(IPC_CHANNELS.GET_TRANSACTIONS),
  addTransaction: (tx) => electron.ipcRenderer.invoke(IPC_CHANNELS.ADD_TRANSACTION, tx),
  // Investment Snapshots
  getInvestmentSnapshots: () => electron.ipcRenderer.invoke(IPC_CHANNELS.GET_INVESTMENT_SNAPSHOTS),
  addInvestmentSnapshot: (snapshot) => electron.ipcRenderer.invoke(IPC_CHANNELS.ADD_INVESTMENT_SNAPSHOT, snapshot),
  updateInvestmentSnapshot: (id, updates) => electron.ipcRenderer.invoke(IPC_CHANNELS.UPDATE_INVESTMENT_SNAPSHOT, id, updates),
  // Physical Assets
  getPhysicalAssets: () => electron.ipcRenderer.invoke(IPC_CHANNELS.GET_PHYSICAL_ASSETS),
  addPhysicalAsset: (asset) => electron.ipcRenderer.invoke(IPC_CHANNELS.ADD_PHYSICAL_ASSET, asset),
  updatePhysicalAsset: (id, updates) => electron.ipcRenderer.invoke(IPC_CHANNELS.UPDATE_PHYSICAL_ASSET, id, updates),
  deletePhysicalAsset: (id) => electron.ipcRenderer.invoke(IPC_CHANNELS.DELETE_PHYSICAL_ASSET, id)
};
electron.contextBridge.exposeInMainWorld("electronAPI", api);
