import { contextBridge, ipcRenderer } from 'electron';

// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electron', {
  processEncoding: (options: { 
    files: { path: string; sourceEncoding?: string; outputPath?: string }[], 
    targetEncoding: string, 
    outputDir?: string, 
    maintainDirStructure?: boolean 
  }) => ipcRenderer.invoke('process-encoding', options),
  detectEncoding: (filePaths: string[]) => 
      ipcRenderer.invoke('detect-encoding', { filePaths }),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  openDirectory: (dirPath: string) => ipcRenderer.invoke('open-directory', dirPath),
  ensureDir: (dirPath: string) => ipcRenderer.invoke('ensure-dir', dirPath),
  processRules: (
    filePaths: string[], 
    rules: any[], 
    options: any
  ) => ipcRenderer.invoke('process-rules', { filePaths, rules, options }),
  getFileInfo: (filePath: string) => ipcRenderer.invoke('get-file-info', { filePath }),
  selectFiles: (options?: any) => ipcRenderer.invoke('select-files', options),
  getDirectoryFiles: (dirPath: string) => ipcRenderer.invoke('get-directory-files', dirPath),
  getFileDetails: (filePaths: string[]) => ipcRenderer.invoke('get-file-details', filePaths),
  getClipboardText: () => ipcRenderer.invoke('get-clipboard-text'),
  checkPathExists: (filePath: string) => ipcRenderer.invoke('check-path-exists', filePath),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('write-file', { filePath, content }),
  writeBinaryFile: (filePath: string, content: Uint8Array) => ipcRenderer.invoke('write-binary-file', { filePath, content }),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  showSaveDialog: (options: any) => ipcRenderer.invoke('show-save-dialog', options),
  parseExcelRules: (filePath: string) => ipcRenderer.invoke('parse-excel-rules', filePath),
  generateExcelTemplate: (filePath: string) => ipcRenderer.invoke('generate-excel-template', filePath),
  processExcelBatch: (dataList: any[], options: any) => ipcRenderer.invoke('process-excel-batch', { dataList, options }),
  scanFoldersForImport: (dirPath: string, mode: string) => ipcRenderer.invoke('scan-folders-for-import', dirPath, mode),
  extractDirectoryList: (folderPaths: string[], options: any) => ipcRenderer.invoke('extract-directory-list', folderPaths, options),
  generateFromTemplate: (options: any) => ipcRenderer.invoke('generate-from-template', options),
  getExcelHeaders: (filePath: string, headerRow?: number) => ipcRenderer.invoke('get-excel-headers', filePath, headerRow),
  removeEmptyLines: (filePath: string, targetPath?: string) => ipcRenderer.invoke('remove-empty-lines', { filePath, targetPath }),
  removeDuplicateLines: (filePath: string, targetPath?: string) => ipcRenderer.invoke('remove-duplicate-lines', { filePath, targetPath }),
  modifyLines: (filePath: string, targetPath: string | undefined, options: any) => ipcRenderer.invoke('modify-lines', { filePath, targetPath, options }),
  insertLines: (filePath: string, targetPath: string | undefined, options: any) => ipcRenderer.invoke('insert-lines', { filePath, targetPath, options }),
  convertToDocx: (content: string) => ipcRenderer.invoke('convert-to-docx', content),
  convertToPdf: (content: string) => ipcRenderer.invoke('convert-to-pdf', content),
  convertToXlsx: (content: string) => ipcRenderer.invoke('convert-to-xlsx', content),
  convertImageToPdf: (image: Uint8Array) => ipcRenderer.invoke('convert-image-to-pdf', image),
  convertHtmlToFormat: (filePath: string, format: string, outputDir: string) => 
      ipcRenderer.invoke('convert-html-to-format', { filePath, format, outputDir }),
  splitFile: (filePath: string, options: any) => ipcRenderer.invoke('split-file', { filePath, options }),
  checkSplitConflict: (filePath: string, options: any) => ipcRenderer.invoke('check-split-conflict', { filePath, options }),
  mergeTextFiles: (filePaths: string[], options: any) => ipcRenderer.invoke('merge-text-files', { filePaths, options }),
  checkTemplateConflicts: (options: any) => ipcRenderer.invoke('check-template-conflicts', options),
  
  // 登录相关
  auth: {
    getLoginUrl: () => ipcRenderer.invoke('auth:get-login-url'),
    generateNonce: () => ipcRenderer.invoke('auth:generate-nonce'),
    pollToken: (encodedNonce: string) => ipcRenderer.invoke('auth:poll-token', encodedNonce),
    checkLogin: (token: string) => ipcRenderer.invoke('auth:check-login', token),
    getUserInfo: (token: string) => ipcRenderer.invoke('auth:get-user-info', token),
    logout: (token: string) => ipcRenderer.invoke('auth:logout', token),
    openExternal: (url: string) => ipcRenderer.invoke('auth:open-external', url),
    getMachineCode: () => ipcRenderer.invoke('auth:get-machine-code'),
    checkNeedAuth: (machineCode: string) => ipcRenderer.invoke('auth:check-need-auth', machineCode),
    validAuth: (machineCode: string, authCode: string) => ipcRenderer.invoke('auth:valid-auth', machineCode, authCode),
    getCustomUrl: () => ipcRenderer.invoke('auth:get-custom-url'),
    getFeedbackUrl: () => ipcRenderer.invoke('auth:get-feedback-url')
  },

  // 广告相关
  adv: {
    getAdv: (position: string) => ipcRenderer.invoke('adv:get-adv', position)
  },

  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close')
});
