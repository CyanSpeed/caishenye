"use strict";const e=require("electron"),n={ping:()=>e.ipcRenderer.invoke("ping")};e.contextBridge.exposeInMainWorld("electronAPI",n);
