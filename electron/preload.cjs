const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('sheetApi', {
  load: () => ipcRenderer.invoke('store:load'),
  save: (json) => ipcRenderer.invoke('store:save', json),
  fetchSpell: (target) => ipcRenderer.invoke('spell:fetch', target),
  openExternal: (url) => ipcRenderer.invoke('open:external', url),
  dataPath: () => ipcRenderer.invoke('store:path'),
})
