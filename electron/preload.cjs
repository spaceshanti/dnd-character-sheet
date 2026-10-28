const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('sheetApi', {
  load: () => ipcRenderer.invoke('store:load'),
  save: (json) => ipcRenderer.invoke('store:save', json),
  fetchSpell: (target) => ipcRenderer.invoke('spell:fetch', target),
  fetchItem: (target) => ipcRenderer.invoke('item:fetch', target),
  openExternal: (url) => ipcRenderer.invoke('open:external', url),
  dataPath: () => ipcRenderer.invoke('store:path'),
  listTemplates: () => ipcRenderer.invoke('templates:list'),
  readTemplate: (name) => ipcRenderer.invoke('templates:read', name),
  addTemplate: (name, bytes) => ipcRenderer.invoke('templates:add', name, bytes),
  removeTemplate: (name) => ipcRenderer.invoke('templates:remove', name),
  saveFile: (name, bytes) => ipcRenderer.invoke('file:save', name, bytes),
  bookInfo: (id) => ipcRenderer.invoke('book:info', id),
  bookList: () => ipcRenderer.invoke('book:list'),
  symbolList: () => ipcRenderer.invoke('symbols:list'),
  symbolDownload: () => ipcRenderer.invoke('symbols:download'),
})
