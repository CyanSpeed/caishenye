import { contextBridge, ipcRenderer } from 'electron'

const api = {
  ping: () => ipcRenderer.invoke('ping'),
}

contextBridge.exposeInMainWorld('electronAPI', api)

export type ElectronAPI = typeof api
