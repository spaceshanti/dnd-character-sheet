const { contextBridge, ipcRenderer, webFrame } = require('electron')

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
  setZoom: (factor) => webFrame.setZoomFactor(factor),
  extraList: () => ipcRenderer.invoke('extra:list'),
  extraSave: (name, text) => ipcRenderer.invoke('extra:save', name, text),
  bookTextGet: (id) => ipcRenderer.invoke('booktext:get', id),
  bookTextSave: (id, text) => ipcRenderer.invoke('booktext:save', id, text),
  fetchUrl: (url, binary) => ipcRenderer.invoke('net:fetch', url, !!binary),
  bookWrite: (id, rel, data) => ipcRenderer.invoke('book:write', id, rel, data),
  bookRemove: (id) => ipcRenderer.invoke('book:remove', id),
  appVersion: () => ipcRenderer.invoke('app:version'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  updateState: () => ipcRenderer.invoke('update:state'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (cb) => {
    const h = (_e, s) => cb(s)
    ipcRenderer.on('update:status', h)
    return () => ipcRenderer.removeListener('update:status', h)
  },
})
