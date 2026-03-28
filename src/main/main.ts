import { app, BrowserWindow, ipcMain, dialog, shell, globalShortcut } from 'electron';
import path from 'path';
import { EncodingService } from './services/EncodingService';
import { RuleService, RuleDefinition, RuleProcessOptions } from './services/RuleService';
import { AuthService } from './services/AuthService';
import { AdvService } from './services/AdvService';
import { UpdateService } from './services/UpdateService';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1080, // 从 1200 缩小
    height: 720, // 从 800 缩小
    minWidth: 960,
    minHeight: 640,
    show: false, // 等待 ready-to-show 再显示
    frame: false, // 去除原生边框
    icon: path.join(__dirname, '../../src/renderer/assets/logo.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      devTools: true
    },
    title: '文本文件处理工具'
  });

  // 窗口控制 IPC 监听
  ipcMain.on('window-minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('window-close', () => {
    mainWindow.close();
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
        mainWindow.webContents.toggleDevTools();
        event.preventDefault();
      }
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173'); 
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // 自动检查更新 (延迟执行，确保窗口已加载)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    setTimeout(async () => {
      try {
        console.log('Main: Starting automatic update check...');
        const result = await UpdateService.checkUpdate();
        if (result.has_update) {
          const { response } = await dialog.showMessageBox(mainWindow, {
            type: 'info',
            buttons: ['立即更新', '稍后'],
            defaultId: 0,
            cancelId: 1,
            title: '发现新版本',
            message: `检测到新版本 ${result.version}，是否立即更新？`,
            detail: result.update_log || '建议您更新到最新版本以获得更好的体验。',
            noLink: true
          });

          if (response === 0) {
            if (result.download_url) {
              UpdateService.startUpdater(result.download_url, result.package_hash);
            } else {
              dialog.showErrorBox('更新失败', '无法获取更新下载地址');
            }
          }
        } else {
            console.log('Main: No updates found.');
        }
      } catch (error) {
        console.error('Main: Auto update check failed:', error);
      }
    }, 5000); // 延迟 5 秒
  });
}

app.whenReady().then(() => {
  // 设置应用名称和 ID (Windows 任务栏图标分组)
  app.setName('文本文件处理工具');
  if (process.platform === 'win32') {
    
    app.setAppUserModelId('com.kunqiong.ai.office.v3');
  }
  
  createWindow();

  // 注册 IPC 监听
  ipcMain.handle('process-encoding', async (_, args) => {
    // 兼容旧版本和新版本的参数格式
    let files = [];
    let targetEncoding = '';
    let outputDir = '';
    let maintainDirStructure = false;

    if (args && args.files) {
      // 新版对象格式
      files = args.files;
      targetEncoding = args.targetEncoding;
      outputDir = args.outputDir;
      maintainDirStructure = args.maintainDirStructure;
    }

    if (!files || !Array.isArray(files)) {
      console.error('Invalid files parameter:', files);
      return [];
    }

    return await EncodingService.convertBatch(files, targetEncoding, outputDir, maintainDirStructure);
  });

  ipcMain.handle('detect-encoding', async (_, { filePaths }) => {
    return await EncodingService.detectBatch(filePaths);
  });

  // 检查拆分冲突
  ipcMain.handle('check-split-conflict', async (_, { filePath, options }) => {
    const { SplitterService } = await import('./services/SplitterService');
    try {
      return await SplitterService.checkSplitConflict(filePath, options);
    } catch (error: any) {
      console.error('Check split conflict error:', error);
      return { hasConflict: false };
    }
  });

  // 更新相关 IPC
  ipcMain.handle('check-update', async () => {
    return await UpdateService.checkUpdate();
  });

  ipcMain.handle('start-update', async (_, { downloadUrl, hash }) => {
    UpdateService.startUpdater(downloadUrl, hash);
  });

  // 退出时注销所有快捷键
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });

  ipcMain.handle(
    'process-rules',
    async (
      _,
      {
        filePaths,
        rules,
        options
      }: { filePaths: string[]; rules: RuleDefinition[]; options: RuleProcessOptions }
    ) => {
      return await RuleService.processFiles(filePaths, rules, options);
    }
  );

  // 解析 Excel 规则
  ipcMain.handle('parse-excel-rules', async (_, filePath) => {
    try {
      console.log('Main: Parsing excel file:', filePath);
      const parsed = RuleService.parseExcelRulesFromFile(filePath);
      console.log(`Main: Returning ${parsed.length} valid rules`);
      return parsed;
    } catch (error: any) {
      console.error('Error parsing excel:', error);
      // 不要直接 throw error，因为某些 Error 对象无法在 IPC 中克隆
      throw new Error(error.message || '解析 Excel 失败');
    }
  });

  // 批量处理 Excel 规则 (针对不同文件应用不同规则)
  ipcMain.handle('process-excel-batch', async (_, { dataList, options }) => {
    const { RuleService } = await import('./services/RuleService');
    const path = await import('path');
    const fs = await import('fs');
    const results = [];

    const resolveTargetFilePath = (rawPath: string): string => {
      const cleanPath = rawPath.trim().replace(/^["']|["']$/g, '');
      if (fs.existsSync(cleanPath)) {
        return cleanPath;
      }

      const ext = path.extname(cleanPath).toLowerCase();
      if (ext === '.xlsx' || ext === '.xls') {
        const dir = path.dirname(cleanPath);
        const base = path.basename(cleanPath, ext);
        let baseWithoutSuffix = base.replace(/_(清单|娓呭崟)(?:_\d+)?$/i, '');
        if (baseWithoutSuffix === base) {
          baseWithoutSuffix = base.replace(/_[^_]+$/, '');
        }
        const candidate = path.join(dir, baseWithoutSuffix);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }

      return cleanPath;
    };
    
    // 按路径分组处理，减少文件读写次数
    const pathGroups: Record<string, any[]> = {};
    dataList.forEach((item: any) => {
      const targetPath = resolveTargetFilePath(item.path);
      if (!pathGroups[targetPath]) pathGroups[targetPath] = [];
      pathGroups[targetPath].push(...item.rules);
    });

    const filePaths = Object.keys(pathGroups);
    
    // 如果需要保持目录结构，尝试计算公共基准路径
    let commonBase = '';
    if (options.maintainDirStructure && filePaths.length > 1) {
      const splitPaths = filePaths.map(p => p.split(path.sep));
      const firstPath = splitPaths[0];
      let commonLength = 0;
      for (let i = 0; i < firstPath.length; i++) {
        if (splitPaths.every(p => p[i] === firstPath[i])) {
          commonLength++;
        } else {
          break;
        }
      }
      commonBase = firstPath.slice(0, commonLength).join(path.sep);
    }

    for (const filePath of filePaths) {
      const rules: RuleDefinition[] = pathGroups[filePath].map((r: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        source: 'manager',
        type: (r.isRegex ? 'regex' : 'exact'),
        find: r.find,
        replace: r.replace,
        caseSensitive: !r.ignoreCase,
        wholeWord: r.wholeWord,
        multiline: r.isMultiline
      }));

      try {
        let currentOutputDir = options.outputDir;
        if (options.maintainDirStructure && commonBase && options.outputType === 'new_folder') {
          // 修正：确保 relativePath 是相对于 commonBase 的，并且保留文件所在的子目录结构
          const fileDir = path.dirname(filePath);
          const relativePath = path.relative(commonBase, fileDir);
          currentOutputDir = path.join(options.outputDir, relativePath);
        }

        const res = await RuleService.processFiles([filePath], rules, {
          ...options,
          outputType: options.outputType,
          outputDir: currentOutputDir,
          otherConfig: {
            keepWhitespace: options.keepWhitespace
          }
        });
        results.push(...res.results);
        
        // 如果开启了单任务模式，且处理较快，可以加一点微小的延迟以提高稳定性（可选）
        if (options.singleTaskMode) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } catch (err: any) {
        results.push({
          success: false,
          filePath: filePath,
          outputPath: filePath,
          changed: 0,
          error: err.message
        });
      }
    }

    return { results };
  });

  // 扫描文件夹用于导入
  ipcMain.handle('scan-folders-for-import', async (_, dirPath, mode) => {
    const fs = await import('fs');
    const path = await import('path');
    const results: any[] = [];

    const getFilesRecursively = (dir: string): any[] => {
      const files: any[] = [];
      try {
        const list = fs.readdirSync(dir);
        for (const file of list) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            files.push(...getFilesRecursively(fullPath));
          } else {
            files.push({
              name: file,
              path: fullPath,
              size: stat.size
            });
          }
        }
      } catch (e) {
        console.error('Scan files recursively error:', e);
      }
      return files;
    };

    const getSubDirs = (dir: string, recursive: boolean): string[] => {
      const dirs: string[] = [];
      try {
        const list = fs.readdirSync(dir);
        for (const file of list) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            dirs.push(fullPath);
            if (recursive) {
              dirs.push(...getSubDirs(fullPath, true));
            }
          }
        }
      } catch (e) {
        console.error('Scan subdirs error:', e);
      }
      return dirs;
    };

    if (mode === 'recursive_files') {
      return getFilesRecursively(dirPath);
    }

    switch (mode) {
      case 'only_selected':
        // Scan files in the selected directory
        try {
          const files = fs.readdirSync(dirPath);
          for (const file of files) {
            const fullPath = path.join(dirPath, file);
            const stat = fs.statSync(fullPath);
            if (stat.isFile()) {
              results.push({
                name: file,
                path: fullPath,
                size: stat.size
              });
            }
          }
        } catch (e) {
          console.error('Scan files error:', e);
        }
        break;
      case 'only_outer_folders':
        results.push(...getSubDirs(dirPath, false));
        break;
      case 'only_all_folders':
        results.push(...getSubDirs(dirPath, true));
        break;
      case 'selected_and_outer':
        results.push(dirPath, ...getSubDirs(dirPath, false));
        break;
      case 'selected_and_all':
        results.push(dirPath, ...getSubDirs(dirPath, true));
        break;
    }
    return results;
  });

  // 提取路径清单逻辑
  ipcMain.handle('extract-directory-list', async (_, paths, options) => {
    const fs = await import('fs');
    const path = await import('path');
    const XLSX = await import('xlsx');

    const scanDir = (dir: string): string[] => {
      const results: string[] = [];
      try {
        const list = fs.readdirSync(dir);
        for (const file of list) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          const isDir = stat.isDirectory();
          
          if (options.listContent === 'files' && !isDir) {
            results.push(fullPath);
          } else if (options.listContent === 'folders' && isDir) {
            results.push(fullPath);
          } else if (options.listContent === 'both') {
            results.push(fullPath);
          }
        }
      } catch (e) {
        console.error(`Scan dir error ${dir}:`, e);
      }
      return results;
    };

    let allItems: string[] = [];
    for (const p of paths) {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        allItems.push(...scanDir(p));
      } else {
        allItems.push(p);
      }
    }

    // 确定输出路径
    let finalOutputPath = options.outputPath;
    if (options.saveTo === 'original') {
       // 如果是覆盖原文件模式，但输入是多个路径，通常会选第一个路径所在的目录
       const baseDir = fs.statSync(paths[0]).isDirectory() ? paths[0] : path.dirname(paths[0]);
       finalOutputPath = path.join(baseDir, `清单_${Date.now()}.${options.listFormat}`);
    } else if (!path.extname(finalOutputPath)) {
       // 如果输出路径是目录，则自动生成文件名
       const folderName = path.basename(paths[0]);
       const fileName = `${folderName}_清单.${options.listFormat}`;
       finalOutputPath = path.join(finalOutputPath, fileName);
    }

    if (options.listFormat === 'xlsx') {
      const headers = ['路径', '查找内容', '替换内容', '是否为正则表达式', '是否为多行正则模式', '是否忽略大小写', '是否整字匹配'];
      const data = allItems.map(p => [p, '', '', '否', '否', '是', '否']);
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '清单');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      try {
        fs.writeFileSync(finalOutputPath, buffer);
      } catch (err: any) {
        if (err.code === 'EBUSY') {
          throw new Error(`文件 "${path.basename(finalOutputPath)}" 正在被使用，请关闭后重试。`);
        }
        throw err;
      }
    } else {
      const content = allItems.join('\n');
      try {
        fs.writeFileSync(finalOutputPath, content, 'utf-8');
      } catch (err: any) {
        if (err.code === 'EBUSY') {
          throw new Error(`文件 "${path.basename(finalOutputPath)}" 正在被使用，请关闭后重试。`);
        }
        throw err;
      }
    }

    return finalOutputPath; // 返回生成的路径
  });

  ipcMain.handle('get-file-info', async (_, { filePath }) => {
    const fs = await import('fs');
    const path = await import('path');
    const cleanPath = filePath.trim().replace(/^["']|["']$/g, '');
    try {
      if (!fs.existsSync(cleanPath)) {
        throw new Error('File not found');
      }
      const stat = fs.statSync(cleanPath);
      const isDirectory = stat.isDirectory();
      const ext = isDirectory ? '' : path.extname(cleanPath);
      return {
        filePath: cleanPath,
        ext,
        sizeBytes: stat.size,
        size: isDirectory ? '--' : `${(stat.size / 1024).toFixed(2)} KB`,
        isDirectory,
        createdAt: stat.birthtime.toISOString(),
        modifiedAt: stat.mtime.toISOString(),
        modifiedTimestamp: stat.mtime.getTime()
      };
    } catch (error) {
      console.error(`Error getting file info for ${cleanPath}:`, error);
      throw error;
    }
  });

  // 检查路径是否存在
  ipcMain.handle('check-path-exists', async (_, filePath) => {
    const fs = await import('fs');
    const cleanPath = filePath.trim().replace(/^["']|["']$/g, '');
    return fs.existsSync(cleanPath);
  });

  // 选择目录
  ipcMain.handle('select-directory', async (event) => {
    try {
      console.log('Main: Handling select-directory request');
       const webContents = event.sender;
       const win = BrowserWindow.fromWebContents(webContents);
       const result = win
         ? await dialog.showOpenDialog(win, {
             title: '选择保存目录',
             properties: ['openDirectory', 'createDirectory']
           })
         : await dialog.showOpenDialog({
             title: '选择保存目录',
             properties: ['openDirectory', 'createDirectory']
           });
      console.log('Main: Dialog result:', result);
      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      return result.filePaths[0];
    } catch (error) {
      console.error('Main: Error in select-directory handler:', error);
      throw error;
    }
  });

  // 打开目录
  ipcMain.handle('open-directory', async (_, dirPath) => {
    if (dirPath) {
      await shell.openPath(dirPath);
    }
  });

  // 选择文件
  ipcMain.handle('select-files', async (event, options = {}) => {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    const { properties, ...restOptions } = options;
    const result = win
      ? await dialog.showOpenDialog(win, {
          properties: properties || ['openFile', 'multiSelections'],
          ...restOptions
        })
      : await dialog.showOpenDialog({
          properties: properties || ['openFile', 'multiSelections'],
          ...restOptions
        });
    return result.filePaths;
  });

  // 获取目录下所有文件
  ipcMain.handle('get-directory-files', async (_, dirPath) => {
    const fs = await import('fs');
    const path = await import('path');
    
    try {
      const getAllFiles = (dir: string, baseDir: string): any[] => {
        const results: any[] = [];
        let list: string[] = [];
        try {
          list = fs.readdirSync(dir);
        } catch (e) {
          console.warn(`Skipping directory due to read error: ${dir}`, e);
          return [];
        }

        list.forEach(file => {
          // 忽略一些常见的系统或隐藏文件夹，避免扫描时间过长或权限问题
          if (['$RECYCLE.BIN', 'System Volume Information', '.git', 'node_modules'].includes(file)) {
            return;
          }

          const filePath = path.join(dir, file);
          try {
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory()) {
              results.push(...getAllFiles(filePath, baseDir));
            } else if (stat && stat.isFile()) {
              const relDir = path.relative(baseDir, dir);
              results.push({
                path: filePath,
                name: file,
                relDir: relDir === '.' ? '' : relDir,
                size: stat.size
              });
            }
          } catch (e) {
            console.warn(`Skipping file due to stat error: ${filePath}`, e);
          }
        });
        return results;
      };
      return getAllFiles(dirPath, dirPath);
    } catch (error) {
      console.error('Get directory files error:', error);
      throw error;
    }
  });

  // 确保目录存在
  ipcMain.handle('ensure-dir', async (_, dirPath) => {
    const fs = await import('fs');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  });

  // 获取文件详细信息列表
  ipcMain.handle('get-file-details', async (_, filePaths: string[]) => {
    const fs = await import('fs');
    try {
      return filePaths.map(fp => {
        const stats = fs.statSync(fp);
        const ext = path.extname(fp).toLowerCase();
        return {
          name: path.basename(fp),
          path: fp,
          size: stats.size,
          extension: ext,
          isText: ['.txt', '.log', '.csv', '.md', '.json', '.js', '.ts', '.css', '.html', '.xml'].includes(ext)
        };
      });
    } catch (error) {
      console.error('Get file details error:', error);
      return [];
    }
  });

  // 读取文件内容
  ipcMain.handle('read-file', async (_, filePath) => {
    const fs = await import('fs');
    const chardet = await import('chardet');
    const iconv = await import('iconv-lite');
    
    try {
      const buffer = fs.readFileSync(filePath);
      // 增加对 BOM 的手动检查，这比 chardet 更可靠
      let encoding = '';
      if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        encoding = 'utf-8';
      } else if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
        encoding = 'utf-16le';
      } else if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
        encoding = 'utf-16be';
      } else {
        // 如果没有 BOM，使用 chardet 并在中文环境下优先尝试 GBK
        const detected = chardet.detect(buffer);
        encoding = detected || 'utf-8';
        
        // 特殊逻辑：如果检测到是 ISO-8859-1 或类似的，且包含中文环境特征，尝试用 GBK
        if (encoding.toLowerCase() === 'iso-8859-1' || encoding.toLowerCase() === 'windows-1252') {
          encoding = 'gbk';
        }
      }

      console.log(`Reading file: ${filePath}, Detected encoding: ${encoding}`);
      return iconv.decode(buffer, encoding);
    } catch (error) {
      console.error('Read file error:', error);
      throw error;
    }
  });

  // 写入文件内容
  ipcMain.handle('write-file', async (_, { filePath, content }) => {
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  });

  // 写入二进制文件
  ipcMain.handle('write-binary-file', async (_, { filePath, content }) => {
    const fs = await import('fs');
    const path = await import('path');
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, Buffer.from(content));
    return true;
  });

  // 删除文件
  ipcMain.handle('delete-file', async (_, filePath) => {
    const fs = await import('fs');
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  });

  // 生成 Excel 模板
  ipcMain.handle('generate-excel-template', async (_, filePath) => {
    const XLSX = await import('xlsx');
    const fs = await import('fs');
    try {
      const headers = ['路径', '查找内容', '替换内容', '是否为正则表达式', '是否为多行正则模式', '是否忽略大小写', '是否整字匹配'];
      const data = [
        ['C:\\example.txt', 'oldText', 'newText', '否', '否', '是', '否'],
        ['C:\\test.txt', '\\d+', 'number', '是', '否', '否', '否']
      ];
      
      const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '修改规则');
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      fs.writeFileSync(filePath, buffer);
      return true;
    } catch (error) {
      console.error('Error generating excel template:', error);
      throw error;
    }
  });

  // 获取剪切板文本
  ipcMain.handle('get-clipboard-text', async () => {
    const { clipboard } = await import('electron');
    return clipboard.readText();
  });

  // 显示保存对话框
  ipcMain.handle('show-save-dialog', async (event, options = {}) => {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    const result = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options);
    return result.filePath;
  });

  // 根据模板生成文件
  ipcMain.handle('generate-from-template', async (_, options) => {
    const { TemplateService } = await import('./services/TemplateService');
    const cleanOptions = { ...options };
    if (cleanOptions.templatePath) cleanOptions.templatePath = cleanOptions.templatePath.trim().replace(/^["']|["']$/g, '');
    if (cleanOptions.excelPath) cleanOptions.excelPath = cleanOptions.excelPath.trim().replace(/^["']|["']$/g, '');
    if (cleanOptions.outputDir) cleanOptions.outputDir = cleanOptions.outputDir.trim().replace(/^["']|["']$/g, '');
    
    try {
      return await TemplateService.generateFiles(cleanOptions);
    } catch (error: any) {
      console.error('Template generation error:', error);
      throw new Error(error.message || '生成失败');
    }
  });

  // 检查模板冲突
  ipcMain.handle('check-template-conflicts', async (_, options) => {
    const { TemplateService } = await import('./services/TemplateService');
    const cleanOptions = { ...options };
    if (cleanOptions.templatePath) cleanOptions.templatePath = cleanOptions.templatePath.trim().replace(/^["']|["']$/g, '');
    if (cleanOptions.excelPath) cleanOptions.excelPath = cleanOptions.excelPath.trim().replace(/^["']|["']$/g, '');
    if (cleanOptions.outputDir) cleanOptions.outputDir = cleanOptions.outputDir.trim().replace(/^["']|["']$/g, '');
    
    try {
      return await TemplateService.checkConflicts(cleanOptions);
    } catch (error: any) {
      console.error('Check conflicts error:', error);
      return { hasConflict: false, conflictingFiles: [] };
    }
  });

  // 获取 Excel 表头
  ipcMain.handle('get-excel-headers', async (_, filePath, headerRow) => {
    const { TemplateService } = await import('./services/TemplateService');
    const cleanPath = typeof filePath === 'string' ? filePath.trim().replace(/^["']|["']$/g, '') : filePath;
    try {
      return await TemplateService.getExcelHeaders(cleanPath, headerRow);
    } catch (error: any) {
      console.error('Get headers error:', error);
      throw new Error(error.message || '获取表头失败');
    }
  });

  // 删除空白行 (保持编码)
  ipcMain.handle('remove-empty-lines', async (_, { filePath, targetPath }) => {
    const fs = await import('fs');
    const iconv = await import('iconv-lite');
    const chardet = await import('chardet');
    const path = await import('path');
    
    try {
      // 1. 读取 Buffer
      const buffer = fs.readFileSync(filePath);
      
      // 2. 检测编码
      const detected = chardet.detect(buffer);
      const encoding = detected || 'utf-8';
      
      // 3. 解码
      const content = iconv.decode(buffer, encoding);
      const lines = content.split(/\r?\n/);
      const originalLines = lines.length;
      
      // 4. 处理
      const newLines = lines.filter(line => line.trim() !== '');
      const removedLines = originalLines - newLines.length;
      const newContent = newLines.join('\r\n'); // 使用 CRLF 以兼容 Windows 文本编辑器
      
      // 5. 编码回 Buffer (保持原编码)
      const outputBuffer = iconv.encode(newContent, encoding);
      
      // 6. 写入
      const finalPath = targetPath || filePath;
      // 确保目录存在
      const dir = path.dirname(finalPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(finalPath, outputBuffer);
      
      return {
        success: true,
        originalLines,
        removedLines,
        encoding
      };
    } catch (error: any) {
      console.error('Remove empty lines error:', error);
      throw new Error(error.message || '处理失败');
    }
  });

  // 删除重复行 (保持编码)
  ipcMain.handle('remove-duplicate-lines', async (_, { filePath, targetPath }) => {
    const fs = await import('fs');
    const iconv = await import('iconv-lite');
    const chardet = await import('chardet');
    const path = await import('path');
    
    try {
      // 1. 读取 Buffer
      const buffer = fs.readFileSync(filePath);
      
      // 2. 检测编码
      const detected = chardet.detect(buffer);
      const encoding = detected || 'utf-8';
      
      // 3. 解码
      const content = iconv.decode(buffer, encoding);
      const lines = content.split(/\r?\n/);
      const originalLines = lines.length;
      
      // 4. 处理 (保留首次出现的行)
      const seen = new Set();
      const newLines: string[] = [];
      
      for (const line of lines) {
        // 可以选择是否忽略空白字符差异，这里假设严格匹配整行
        // 如果要忽略行尾空白，可以用 line.trimRight() 作为 key
        // 既然是删除重复行，通常意味着完全相同的行
        if (!seen.has(line)) {
          seen.add(line);
          newLines.push(line);
        }
      }

      const removedLines = originalLines - newLines.length;
      const newContent = newLines.join('\r\n'); // 使用 CRLF
      
      // 5. 编码回 Buffer (保持原编码)
      const outputBuffer = iconv.encode(newContent, encoding);
      
      // 6. 写入
      const finalPath = targetPath || filePath;
      // 确保目录存在
      const dir = path.dirname(finalPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(finalPath, outputBuffer);
      
      return {
        success: true,
        originalLines,
        removedLines,
        encoding
      };
    } catch (error: any) {
      console.error('Remove duplicate lines error:', error);
      throw new Error(error.message || '处理失败');
    }
  });

  // 删除或替换文本文件的行 (保持编码)
  ipcMain.handle('modify-lines', async (_, { filePath, targetPath, options }) => {
    const fs = await import('fs');
    const iconv = await import('iconv-lite');
    const chardet = await import('chardet');
    const path = await import('path');
    
    try {
      const { mode, type, range, replacementText } = options;
      
      // 1. 读取 Buffer
      const buffer = fs.readFileSync(filePath);
      
      // 2. 检测编码
      const detected = chardet.detect(buffer);
      const encoding = detected || 'utf-8';
      
      // 3. 解码
      const content = iconv.decode(buffer, encoding);
      // 使用正则分割以支持多种换行符，但保持换行符类型以便后面恢复
      const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
      const lines = content.split(/\r?\n/);
      const originalLines = lines.length;
      
      // 4. 确定要处理的行索引 (0-based)
      const targetIndices = new Set<number>();
      
      if (type === 'first') {
        targetIndices.add(0);
      } else if (type === 'last') {
        targetIndices.add(originalLines - 1);
      } else if (type === 'range') {
        // 解析 range: "1-5", "2,4,6", "10-"
        const parts = range.split(',').map((p: string) => p.trim());
        for (const part of parts) {
          if (part.includes('-')) {
            const [startStr, endStr] = part.split('-');
            const start = parseInt(startStr) || 1;
            const end = (endStr === '' || endStr === undefined) ? originalLines : (parseInt(endStr) || originalLines);
            for (let i = start; i <= end; i++) {
              if (i >= 1 && i <= originalLines) {
                targetIndices.add(i - 1);
              }
            }
          } else {
            const idx = parseInt(part);
            if (!isNaN(idx) && idx >= 1 && idx <= originalLines) {
              targetIndices.add(idx - 1);
            }
          }
        }
      }

      // 5. 执行操作
      let newLines: string[] = [];
      if (mode === 'delete') {
        newLines = lines.filter((_, idx) => !targetIndices.has(idx));
      } else if (mode === 'replace') {
        if (targetIndices.size === 0) {
          newLines = lines.slice();
        } else {
          const replacementLines = replacementText.split(/\r?\n/);
          const sortedIndices = Array.from(targetIndices).sort((a, b) => a - b);
          const groups: { start: number; end: number }[] = [];
          let groupStart = sortedIndices[0];
          let prev = sortedIndices[0];

          for (let i = 1; i < sortedIndices.length; i++) {
            const idx = sortedIndices[i];
            if (idx === prev + 1) {
              prev = idx;
            } else {
              groups.push({ start: groupStart, end: prev });
              groupStart = idx;
              prev = idx;
            }
          }
          groups.push({ start: groupStart, end: prev });

          let tempLines = lines.slice();
          for (let i = groups.length - 1; i >= 0; i--) {
            const group = groups[i];
            const before = tempLines.slice(0, group.start);
            const after = tempLines.slice(group.end + 1);
            tempLines = before.concat(replacementLines, after);
          }

          newLines = tempLines;
        }
      }
      
      const modifiedLines = targetIndices.size;
      const newContent = newLines.join(lineEnding);
      
      // 6. 编码回 Buffer (保持原编码)
      const outputBuffer = iconv.encode(newContent, encoding);
      
      // 7. 写入
      const finalPath = targetPath || filePath;
      // 确保目录存在
      const dir = path.dirname(finalPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(finalPath, outputBuffer);
      
      return {
        success: true,
        originalLines,
        modifiedLines,
        encoding
      };
    } catch (error: any) {
      console.error('Modify lines error:', error);
      throw new Error(error.message || '处理失败');
    }
  });
  // 在文本文件的指定位置插入行 (保持编码)
  ipcMain.handle('insert-lines', async (_, { filePath, targetPath, options }) => {
    const fs = await import('fs');
    const iconv = await import('iconv-lite');
    const chardet = await import('chardet');
    const path = await import('path');
    
    try {
      const { positionType, targetLine, intervalLines, insertText } = options;
      
      // 1. 读取 Buffer
      const buffer = fs.readFileSync(filePath);
      
      // 2. 检测编码
      const detected = chardet.detect(buffer);
      const encoding = detected || 'utf-8';
      
      // 3. 解码
      const content = iconv.decode(buffer, encoding);
      const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
      const lines = content.split(/\r?\n/);
      const originalLines = lines.length;
      
      // 处理文件末尾的空行（通常由末尾换行符产生）
      // 如果 split 结果的最后一项是空字符串，说明文件以换行符结尾
      const hasTrailingNewline = lines.length > 0 && lines[lines.length - 1] === '';
      const workingLines = hasTrailingNewline ? lines.slice(0, -1) : lines;
      
      // 处理插入文本：移除末尾的换行符，避免产生意外的空行
      const cleanInsertText = insertText ? insertText.replace(/\r?\n$/, '') : '';
      const insertLinesArr = cleanInsertText ? cleanInsertText.split(/\r?\n/) : [];

      let newLines: string[] = [];
      let insertedCount = 0;

      if (insertLinesArr.length > 0) {
        if (positionType === 'start') {
          newLines = [...insertLinesArr, ...workingLines];
          insertedCount = insertLinesArr.length;
        } else if (positionType === 'end') {
          newLines = [...workingLines, ...insertLinesArr];
          insertedCount = insertLinesArr.length;
        } else if (positionType === 'specific') {
          // 在指定行之前插入
          const tLine = parseInt(String(targetLine || 1));
          const idx = Math.max(0, Math.min(workingLines.length, tLine - 1));
          const before = workingLines.slice(0, idx);
          const after = workingLines.slice(idx);
          newLines = [...before, ...insertLinesArr, ...after];
          insertedCount = insertLinesArr.length;
        } else if (positionType === 'interval') {
          // 每隔 N 行插入
          const interval = parseInt(String(intervalLines || 100));
          for (let i = 0; i < workingLines.length; i++) {
            newLines.push(workingLines[i]);
            if ((i + 1) % interval === 0) {
               newLines.push(...insertLinesArr);
               insertedCount += insertLinesArr.length;
            }
          }
        } else {
          newLines = workingLines;
        }
      } else {
        newLines = workingLines;
      }
      
      let newContent = newLines.join(lineEnding);
      // 如果原文件有末尾换行符，保持一致
      if (hasTrailingNewline) {
        newContent += lineEnding;
      }
      
      // 4. 编码回 Buffer (保持原编码)
      const outputBuffer = iconv.encode(newContent, encoding);
      
      // 5. 写入
      const finalPath = targetPath || filePath;
      const dir = path.dirname(finalPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(finalPath, outputBuffer);
      
      return {
        success: true,
        originalLines,
        insertedLines: insertedCount,
        encoding
      };
    } catch (error: any) {
      console.error('Insert lines error:', error);
      throw new Error(error.message || '处理失败');
    }
  });

  // 转换为 DOCX
  ipcMain.handle('convert-to-docx', async (_, content) => {
    try {
      const { Document, Packer, Paragraph, TextRun } = await import('docx');
      const lines = content.split(/\r?\n/);
      const doc = new Document({
        sections: [{
          properties: {},
          children: lines.map((line: string) => new Paragraph({
            children: [new TextRun(line)],
          })),
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      return new Uint8Array(buffer);
    } catch (error: any) {
      console.error('Convert to docx error:', error);
      throw new Error(error.message || '转换为 Word 失败');
    }
  });

  // 将图片封装为 PDF（用于避免中文编码问题）
  ipcMain.handle('convert-image-to-pdf', async (_, imageBytes: Uint8Array) => {
    try {
      const { PDFDocument } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage();

      const pngImage = await pdfDoc.embedPng(Buffer.from(imageBytes));
      const pngDims = pngImage.scale(1);

      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();

      const scale = Math.min(pageWidth / pngDims.width, pageHeight / pngDims.height);
      const imgWidth = pngDims.width * scale;
      const imgHeight = pngDims.height * scale;

      // 修改为顶格显示：x 居中，y 设为页面顶部
      const x = (pageWidth - imgWidth) / 2;
      const y = pageHeight - imgHeight; // PDF 坐标系从底部开始，所以顶部是 pageHeight - imgHeight

      page.drawImage(pngImage, {
        x,
        y,
        width: imgWidth,
        height: imgHeight
      });

      const pdfBytes = await pdfDoc.save();
      return new Uint8Array(pdfBytes);
    } catch (error: any) {
      console.error('Convert image to pdf error:', error);
      throw new Error(error.message || '图片转换为 PDF 失败');
    }
  });

  // 转换为 XLSX
  ipcMain.handle('convert-to-xlsx', async (_, content) => {
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet1');
      const lines = content.split(/\r?\n/);
      
      lines.forEach((line: string, index: number) => {
        worksheet.getRow(index + 1).getCell(1).value = line;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return new Uint8Array(buffer);
    } catch (error: any) {
      console.error('Convert to xlsx error:', error);
      throw new Error(error.message || '转换为 Excel 失败');
    }
  });

  // HTML 转换为其它格式
  ipcMain.handle('convert-html-to-format', async (_, { filePath, format, outputDir }) => {
    const fs = await import('fs');
    const path = await import('path');
    const iconv = await import('iconv-lite');
    const chardet = await import('chardet');
    
    try {
      const cleanPath = filePath.trim().replace(/^["']|["']$/g, '');
      const cleanOutputDir = outputDir.trim().replace(/^["']|["']$/g, '');
      const fileName = path.basename(cleanPath, path.extname(cleanPath));
      const outputPath = path.join(cleanOutputDir, `${fileName}.${format}`);
      const outputDirname = path.dirname(outputPath);
      if (!fs.existsSync(outputDirname)) {
        fs.mkdirSync(outputDirname, { recursive: true });
      }
      
      // 读取 Buffer 并检测编码
      const buffer = fs.readFileSync(cleanPath);
      
      // 1. 尝试从 HTML 内容中直接查找 charset 声明
      const initialView = buffer.slice(0, 1024).toString('ascii');
      const charsetMatch = initialView.match(/<meta[^>]*charset=["']?([^"'>\s]+)["']?/i);
      let encoding = 'utf-8';
      
      if (charsetMatch && charsetMatch[1]) {
        encoding = charsetMatch[1].toLowerCase();
        // 映射常见的中文编码别名
        if (encoding === 'gb2312' || encoding === 'gbk') {
          encoding = 'gbk';
        }
      } else {
        // 2. 如果没找到，使用 chardet 检测
        const detected = chardet.detect(buffer);
        encoding = detected || 'utf-8';
      }
      
      // 使用检测到的编码解码
      const htmlContent = iconv.decode(buffer, encoding);

      if (format === 'txt') {
          // 简单的 HTML 转 Text
          let text = htmlContent;
          // 移除 style 和 script
          text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
          text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
          // 移除标签
          text = text.replace(/<[^>]+>/g, '\n');
          // 处理常见实体
          text = text.replace(/&nbsp;/g, ' ')
                     .replace(/&lt;/g, '<')
                     .replace(/&gt;/g, '>')
                     .replace(/&amp;/g, '&')
                     .replace(/&quot;/g, '"');
          // 移除多余空行
          text = text.replace(/\n\s*\n/g, '\n').trim();
          
          // 强制以 UTF-8 编码写入 TXT
          const outputBuffer = iconv.encode(text, 'utf-8');
          fs.writeFileSync(outputPath, outputBuffer);
          return true;
      } else if (format === 'pdf') {
          // 使用隐藏窗口打印 PDF
          const win = new BrowserWindow({ 
              show: false,
              webPreferences: {
                  offscreen: true
              }
          });
          
          try {
            await win.loadFile(cleanPath);
            const pdfData = await win.webContents.printToPDF({
              printBackground: true,
              pageSize: 'A4'
            });
            fs.writeFileSync(outputPath, pdfData);
          } finally {
            win.close();
          }
          return true;
      } else if (format === 'docx') {
          const htmlToDocx = await import('html-to-docx');
          const convert = htmlToDocx.default || htmlToDocx;
          
          try {
            const fileBuffer = await convert(htmlContent, null, {
                table: { row: { cantSplit: true } },
                footer: true,
                pageNumber: true,
            });
            fs.writeFileSync(outputPath, fileBuffer);
            return true;
          } catch (error: any) {
            const message = String(error?.message || error || '');
            if (message.includes('unsupported file type')) {
              const sanitizedHtml = htmlContent.replace(/<img[^>]*>/gi, '');
              const fileBuffer = await convert(sanitizedHtml, null, {
                  table: { row: { cantSplit: true } },
                  footer: true,
                  pageNumber: true,
              });
              fs.writeFileSync(outputPath, fileBuffer);
              return true;
            }
            throw error;
          }
      }
    } catch (error: any) {
      console.error('Convert html error:', error);
      throw new Error(error.message || '转换失败');
    }
  });

  // 文本文件拆分
  ipcMain.handle('split-file', async (_, { filePath, options }) => {
    const { SplitterService } = await import('./services/SplitterService');
    try {
      return await SplitterService.splitFile(filePath, options);
    } catch (error: any) {
      console.error('Split file error:', error);
      return { success: false, error: error.message };
    }
  });

  // 文本文件合并
  ipcMain.handle('merge-text-files', async (_, { filePaths, options }) => {
    const { TextMergeService } = await import('./services/TextMergeService');
    try {
      return await TextMergeService.mergeFiles(filePaths, options);
    } catch (error: any) {
      console.error('Merge text files error:', error);
      return { success: false, results: [], error: error.message };
    }
  });

  // --- 登录相关 IPC 监听 ---
  ipcMain.handle('auth:get-login-url', async () => {
    return await AuthService.getWebLoginUrl();
  });

  ipcMain.handle('auth:generate-nonce', async () => {
    const signedNonce = AuthService.generateSignedNonce();
    const encodedNonce = AuthService.encodeSignedNonce(signedNonce);
    return { signedNonce, encodedNonce };
  });

  ipcMain.handle('auth:poll-token', async (_, encodedNonce) => {
    try {
      const token = await AuthService.pollToken(encodedNonce);
      if (token) console.log('Main: Poll success, token received');
      return token;
    } catch (error) {
      console.error('Main: Poll token error:', error);
      return null;
    }
  });

  ipcMain.handle('auth:check-login', async (_, token) => {
    return await AuthService.checkLogin(token);
  });

  ipcMain.handle('auth:get-user-info', async (_, token) => {
    return await AuthService.getUserInfo(token);
  });

  ipcMain.handle('auth:logout', async (_, token) => {
    return await AuthService.logout(token);
  });

  ipcMain.handle('auth:open-external', async (_, url) => {
    return await shell.openExternal(url);
  });

  ipcMain.handle('auth:get-machine-code', async () => {
    return await AuthService.getMachineCode();
  });

  ipcMain.handle('auth:check-need-auth', async (_, machineCode) => {
    return await AuthService.checkNeedAuthCode(machineCode);
  });

  ipcMain.handle('auth:valid-auth', async (_, machineCode, authCode) => {
    return await AuthService.validAuthCode(machineCode, authCode);
  });

  ipcMain.handle('auth:get-custom-url', async () => {
    return await AuthService.getCustomUrl();
  });

  ipcMain.handle('auth:get-feedback-url', async () => {
    return await AuthService.getFeedbackUrl();
  });

  // --- 广告相关 IPC 监听 ---
  ipcMain.handle('adv:get-adv', async (_, position) => {
    return await AdvService.getAdvertisement(position);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
