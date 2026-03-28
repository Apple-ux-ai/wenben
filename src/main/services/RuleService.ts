import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import iconv from 'iconv-lite';
import chardet from 'chardet';
import AdmZip from 'adm-zip';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { PDFDocument, rgb } from 'pdf-lib';

export interface RuleDefinition {
  id: string;
  source: 'quick' | 'manager';
  type: 'exact' | 'regex' | 'batch_exact' | 'batch_regex';
  find: string;
  replace: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  multiline?: boolean;
}

export interface RuleProcessOptions {
  outputType: 'overwrite' | 'new_folder';
  outputDir?: string;
  backupBeforeModify?: boolean;
  skipHiddenFiles?: boolean;
  continueOnError?: boolean;
  targetEncoding?: string;
  wordConfig?: {
    highlight: boolean;
    highlightColor: string;
  };
  excelConfig?: {
    range: string[];
    formulaType: string;
    formulaProcess: string;
    dataTypes: string[];
    numberTarget: string;
    dateTarget: string;
    failedConversion: string;
    highlight: boolean;
    highlightColor: string;
  };
  pptConfig?: {
    range: string[];
    highlight: boolean;
    highlightColor: string;
  };
  pdfConfig?: {
    highlight: boolean;
    highlightColor: string;
  };
  otherConfig?: {
    keepWhitespace: boolean;
  };
}

export interface FileProcessResult {
  filePath: string;
  outputPath: string;
  changed: number;
  success: boolean;
  error?: string;
}

export class RuleService {
  static async processFiles(
    filePaths: string[],
    rules: RuleDefinition[],
    options: RuleProcessOptions
  ): Promise<{ results: FileProcessResult[] }> {
    const normalizedRules = rules.filter(r => r.find.trim() !== '');
    const results: FileProcessResult[] = [];

    for (const filePath of filePaths) {
      const res: FileProcessResult = {
        filePath,
        outputPath: filePath,
        changed: 0,
        success: false
      };

      try {
        console.log(`[RuleService] Processing file: ${filePath}`);
        if (options.skipHiddenFiles && path.basename(filePath).startsWith('.')) {
          res.success = true;
          results.push(res);
          continue;
        }

        let stat;
        try {
          stat = fs.statSync(filePath);
        } catch (e: any) {
          throw new Error(`无法访问文件: ${e.message}`);
        }

        if (!stat.isFile()) {
          throw new Error('不是有效文件');
        }

        const ext = path.extname(filePath).toLowerCase();
        let targetPath = filePath;
        if (options.outputType === 'new_folder' && options.outputDir) {
          const baseName = path.basename(filePath);
          targetPath = path.join(options.outputDir, baseName);
          const dir = path.dirname(targetPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
        }

        if (options.backupBeforeModify) {
          const backupPath = targetPath + '.bak';
          if (!fs.existsSync(backupPath)) {
            try {
              console.log(`[RuleService] Creating backup: ${backupPath}`);
              fs.copyFileSync(filePath, backupPath);
            } catch (e: any) {
              throw new Error(`创建备份失败: ${e.message}。请检查磁盘空间或权限。`);
            }
          }
        }

        let processRes: { changed: number; outputBuffer: Buffer };

        if (['.docx'].includes(ext)) {
          processRes = await this.processWordFile(filePath, normalizedRules, options);
        } else if (['.doc'].includes(ext)) {
          // 明确捕获 .doc 格式并提示不支持
          throw new Error('暂不支持修改旧版 Word (.doc) 格式，请将其另存为 .docx 格式后再试。');
        } else if (['.xlsx', '.xls', '.csv'].includes(ext)) {
          processRes = await this.processExcelFile(filePath, normalizedRules, options);
        } else if (['.pptx'].includes(ext)) {
          processRes = await this.processPptFile(filePath, normalizedRules, options);
        } else if (['.ppt'].includes(ext)) {
          // 明确捕获 .ppt 格式并提示不支持
          throw new Error('暂不支持修改旧版 PPT (.ppt) 格式，请将其另存为 .pptx 格式后再试。');
        } else if (ext === '.pdf') {
          processRes = await this.processPdfFile(filePath, normalizedRules, options);
        } else {
          processRes = await this.processNormalFile(filePath, normalizedRules, options);
        }

        const { changed, outputBuffer } = processRes;
        res.changed = changed;

        // 如果是 PDF 且修改处为 0，生成详细的日志报告文件
        if (ext === '.pdf' && changed === 0) {
          try {
            const reportPath = targetPath + '.process_report.txt';
            const reportContent = `
处理报告 (PDF 文本修改)
-----------------------
时间: ${new Date().toLocaleString()}
源文件: ${filePath}
状态: 修改成功 (但未找到匹配内容)
修改处: 0

详细说明:
1. 系统已成功加载并解析 PDF 文件。
2. 应用了 ${normalizedRules.length} 条查找替换规则。
3. 查找规则列表:
${normalizedRules.map((r, i) => `   [${i + 1}] 类型: ${r.type}, 查找: "${r.find}", 替换: "${r.replace}"`).join('\n')}

结果分析:
在 PDF 文件的元数据（如标题、作者等）以及可访问的文本层中，未发现与上述规则匹配的内容。
由于 PDF 文件格式的复杂性，部分加密、扫描件或特殊编码的文本可能无法被直接查找替换。
建议检查规则是否过于严格，或尝试使用更通用的正则表达式。
`.trim();
            fs.writeFileSync(reportPath, reportContent, 'utf-8');
          } catch (logError) {
            console.error('Failed to write PDF report:', logError);
          }
        }

        // 如果是覆盖原文件，采用更安全的写入方式：写入临时文件然后重命名
        if (options.outputType === 'overwrite' || targetPath === filePath) {
          const tempPath = targetPath + '.tmp' + Math.random().toString(36).substring(7);
          try {
            console.log(`[RuleService] Writing temp file: ${tempPath}`);
            fs.writeFileSync(tempPath, outputBuffer);
            console.log(`[RuleService] Renaming temp file to: ${targetPath}`);
            fs.renameSync(tempPath, targetPath);
          } catch (e: any) {
            console.error(`[RuleService] Error during overwrite:`, e);
            if (fs.existsSync(tempPath)) {
              try { fs.unlinkSync(tempPath); } catch {}
            }
            throw new Error(`保存文件失败: ${e.message}。文件可能被其它程序占用。`);
          }
        } else {
          try {
            console.log(`[RuleService] Writing new file: ${targetPath}`);
            fs.writeFileSync(targetPath, outputBuffer);
          } catch (e: any) {
            throw new Error(`保存文件失败: ${e.message}。请检查目录权限。`);
          }
        }

        res.outputPath = targetPath;
        res.success = true;
        results.push(res);
      } catch (error: any) {
        console.error(`[RuleService] Error processing ${filePath}:`, error);
        let errorMsg = error?.message || String(error);
        if (
          errorMsg.includes('EBUSY') || 
          errorMsg.includes('resource busy') || 
          errorMsg.includes('EPERM') ||
          errorMsg.includes('Cannot access file')
        ) {
          errorMsg = `文件被其它程序占用 (如 Excel/Word)，请先关闭后再试。(${errorMsg})`;
        }
        res.error = errorMsg;
        results.push(res);
        if (res.error) this.logError(filePath, res.error);
        if (!options.continueOnError) {
          break;
        }
      }
    }

    return { results };
  }

  static parseExcelRulesFromFile(filePath: string) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel 文件中没有工作表');
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const normalizeHyperlinkTarget = (rawTarget: string): string => {
      let t = rawTarget.trim();
      t = t.replace(/^["']|["']$/g, '');
      if (!t) return '';
      if (t.startsWith('#')) return '';
      if (t.startsWith('file://')) {
        t = t.replace(/^file:\/+/, '');
        try {
          t = decodeURIComponent(t);
        } catch {}
        if (/^[a-zA-Z]:\//.test(t)) {
          t = t.replace(/\//g, '\\');
        }
      }
      return t;
    };

    const getCellText = (cell: any): string => {
      if (!cell) return '';

      if (typeof cell.f === 'string') {
        const formula = cell.f.trim();
        const m = formula.match(/^\=?HYPERLINK\(\s*"([^"]+)"\s*(?:[;,]\s*"[^"]*"\s*)?\)$/i);
        if (m && m[1]) {
          const target = normalizeHyperlinkTarget(m[1]);
          if (target) return target;
        }
      }

      if (cell.l && typeof cell.l.Target === 'string') {
        const target = normalizeHyperlinkTarget(cell.l.Target);
        if (target) return target;
      }

      const v = cell.v ?? cell.w;
      if (v === undefined || v === null) return '';
      return String(v).trim();
    };

    const trimQuotes = (s: string) => s.trim().replace(/^["']|["']$/g, '');

    const getBooleanFlag = (raw: any, defaultValue: boolean) => {
      if (raw === undefined || raw === null || raw === '') return defaultValue;
      const s = String(raw).trim();
      if (s === '') return defaultValue;
      if (/[Yy是对真1]/.test(s)) return true;
      if (/[Nn否错假0]/.test(s)) return false;
      return defaultValue;
    };

    if (!worksheet || !worksheet['!ref']) {
      throw new Error('Excel 工作表为空');
    }

    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const headerRow = range.s.r;

    const headerToCol: Record<string, number> = {};
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: headerRow, c });
      const name = getCellText(worksheet[addr]);
      if (name) headerToCol[name] = c;
    }

    const getCol = (aliases: string[]): number | null => {
      for (const a of aliases) {
        if (headerToCol[a] !== undefined) return headerToCol[a];
      }
      return null;
    };

    const pathCol = getCol(['路径', 'Path', 'path']);
    const findCol = getCol(['查找内容', '查找', 'Find', 'find']);
    const replaceCol = getCol(['替换内容', '替换', 'Replace', 'replace']);
    const isRegexCol = getCol(['是否为正则表达式', '正则', 'isRegex']);
    const isMultilineCol = getCol(['是否为多行正则模式', '多行', 'isMultiline']);
    const ignoreCaseCol = getCol(['是否忽略大小写', '忽略大小写', 'ignoreCase']);
    const wholeWordCol = getCol(['是否整字匹配', '整字匹配', 'wholeWord']);

    const looksLikePath = (s: string) => {
      const t = trimQuotes(s);
      if (!t) return false;
      if (/^[a-zA-Z]:[\\/]/.test(t)) return true;
      if (t.startsWith('\\\\')) return true;
      if (t.startsWith('/') || t.startsWith('\\')) return true;
      if (t.startsWith('file://')) return true;
      return false;
    };

    const result: any[] = [];
    for (let r = headerRow + 1; r <= range.e.r; r++) {
      const getByCol = (col: number | null) => {
        if (col === null) return '';
        const addr = XLSX.utils.encode_cell({ r, c: col });
        return getCellText(worksheet[addr]);
      };

      let rawPath = getByCol(pathCol);
      if (!rawPath) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const v = getCellText(worksheet[addr]);
          if (looksLikePath(v)) {
            rawPath = v;
            break;
          }
        }
      }

      let normalizedPath = trimQuotes(rawPath).replace(/\u200B/g, '');
      if (!normalizedPath) continue;

      if (normalizedPath.startsWith('file://')) {
        normalizedPath = normalizeHyperlinkTarget(normalizedPath);
      } else if (/^[a-zA-Z]:\//.test(normalizedPath)) {
        normalizedPath = normalizedPath.replace(/\//g, '\\');
      }

      const ext = path.extname(normalizedPath).toLowerCase();
      if (ext === '.url') {
        try {
          const content = fs.readFileSync(normalizedPath, 'utf-8');
          const m = content.match(/^URL=(.+)$/m);
          if (m && m[1]) {
            const urlTarget = normalizeHyperlinkTarget(m[1]);
            if (urlTarget) normalizedPath = urlTarget;
          }
        } catch {}
      }

      const find = getByCol(findCol);
      const replace = getByCol(replaceCol);

      result.push({
        key: String(result.length + 1),
        path: normalizedPath,
        find: find ? String(find) : '',
        replace: replace ? String(replace) : '',
        isRegex: getBooleanFlag(getByCol(isRegexCol), false),
        isMultiline: getBooleanFlag(getByCol(isMultilineCol), false),
        ignoreCase: getBooleanFlag(getByCol(ignoreCaseCol), true),
        wholeWord: getBooleanFlag(getByCol(wholeWordCol), true)
      });
    }

    const filteredResult = result.filter(item => item.path);
    return JSON.parse(JSON.stringify(filteredResult));
  }

  private static async processNormalFile(
    filePath: string,
    rules: RuleDefinition[],
    options: RuleProcessOptions
  ): Promise<{ changed: number; outputBuffer: Buffer }> {
    const buffer = fs.readFileSync(filePath);
    let hasBom = false;
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      hasBom = true;
    }

    let detectedEncoding = chardet.detect(buffer) || 'utf-8';
    let originalContent = '';
    let successfullyDecoded = false;

    const tryDecodings = [detectedEncoding, 'utf-8', 'gbk', 'utf-16le'];
    if (['windows-1252', 'iso-8859-1', 'iso-8859-2'].includes(detectedEncoding.toLowerCase())) {
      tryDecodings.unshift('gbk');
    }

    for (const enc of [...new Set(tryDecodings)]) {
      try {
        const decoded = iconv.decode(buffer, enc);
        if (!decoded.includes('\uFFFD') || buffer.length < 10) {
          originalContent = decoded;
          detectedEncoding = enc;
          successfullyDecoded = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!successfullyDecoded) {
      originalContent = iconv.decode(buffer, 'utf-8');
      detectedEncoding = 'utf-8';
    }

    let newContent = originalContent;
    let totalChanged = 0;

    for (const rule of rules) {
      const { count, updated } = this.applyRule(newContent, rule, options.otherConfig);
      newContent = updated;
      totalChanged += count;
    }

    const finalOutputEncoding = (options.targetEncoding && options.targetEncoding !== 'auto')
      ? options.targetEncoding
      : detectedEncoding;

    let outputBuffer = iconv.encode(newContent, finalOutputEncoding);
    if (hasBom && finalOutputEncoding.toLowerCase() === 'utf-8') {
      outputBuffer = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), outputBuffer]);
    }

    return { changed: totalChanged, outputBuffer };
  }

  private static async processWordFile(
    filePath: string,
    rules: RuleDefinition[],
    options: RuleProcessOptions
  ): Promise<{ changed: number; outputBuffer: Buffer }> {
    const zip = new AdmZip(filePath);
    let totalChanged = 0;
    const xmlFiles = ['word/document.xml', 'word/header1.xml', 'word/header2.xml', 'word/header3.xml', 'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml'];

    for (const xmlFile of xmlFiles) {
      const entry = zip.getEntry(xmlFile);
      if (!entry) continue;

      let content = entry.getData().toString('utf8');
      
      // 一次性处理所有规则，以提高效率并确保高亮逻辑正确
      const { count, updated } = this.applyRulesToWordXml(content, rules, options);
      
      if (count > 0) {
        zip.updateFile(xmlFile, Buffer.from(updated, 'utf8'));
        totalChanged += count;
      }
    }

    return { changed: totalChanged, outputBuffer: zip.toBuffer() };
  }

  private static applyRulesToWordXml(
    content: string, 
    rules: RuleDefinition[], 
    options: RuleProcessOptions
  ): { count: number; updated: string } {
    let totalCount = 0;
    const highlight = options.wordConfig?.highlight;
    const highlightColor = (options.wordConfig?.highlightColor || 'ffff00').replace('#', '');

    // 匹配整个 <w:r> 运行块 (Run)
    const updated = content.replace(/<w:r(\b[^>]*)>([\s\S]*?)<\/w:r>/g, (runMatch, rAttrs, runInner) => {
      // 检查是否有文本内容
      if (!runInner.includes('<w:t')) return runMatch;

      // 提取所有文本。注意：这里我们假设一个 Run 内的文本是连续的。
      // 如果 Run 内有多个 w:t，我们会将它们合并处理并重新拆分为多个 Run。
      let fullText = '';
      const tRegex = /<w:t(\b[^>]*)>([\s\S]*?)<\/w:t>/g;
      let tMatch;
      while ((tMatch = tRegex.exec(runInner)) !== null) {
        fullText += tMatch[2];
      }

      if (!fullText) return runMatch;

      // 应用规则并获取分段
      const { segments, totalCount: runCount } = this.applyRulesToSegments(fullText, rules, options.otherConfig);
      if (runCount === 0) return runMatch;

      totalCount += runCount;

      // 提取原有的 rPr (Run Properties)
      let rPr = '';
      const rPrMatch = runInner.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
      if (rPrMatch) rPr = rPrMatch[1];

      // 构造新的 Runs
      const resultRuns = segments.map(seg => {
        if (!seg.text && seg.changed) return ''; 
        if (!seg.text && !seg.changed) return '';

        let currentRPr = rPr;
        if (highlight && seg.changed) {
          const shdTag = `<w:shd w:val="clear" w:color="auto" w:fill="${highlightColor}"/>`;
          if (currentRPr.includes('<w:shd')) {
            currentRPr = currentRPr.replace(/<w:shd[^>]*\/>/, shdTag);
          } else {
            // 确保插入到 rPr 内部
            currentRPr = shdTag + currentRPr;
          }
        }

        const rPrTag = currentRPr ? `<w:rPr>${currentRPr}</w:rPr>` : '';
        // 使用 xml:space="preserve" 确保空格不被丢失
        return `<w:r${rAttrs}>${rPrTag}<w:t xml:space="preserve">${seg.text}</w:t></w:r>`;
      });

      return resultRuns.join('');
    });

    return { count: totalCount, updated };
  }

  private static async processExcelFile(
    filePath: string,
    rules: RuleDefinition[],
    options: RuleProcessOptions
  ): Promise<{ changed: number; outputBuffer: Buffer }> {
    const ext = path.extname(filePath).toLowerCase();
    
    // 对于 .xls 文件，exceljs 不直接支持，我们仍然使用 xlsx，但样式可能无法生效
    if (ext === '.xls') {
      return this.processExcelFileWithXLSX(filePath, rules, options);
    }

    const workbook = new ExcelJS.Workbook();
    try {
      if (ext === '.csv') {
        // 改进的 CSV 读取逻辑：先检测并解码，防止乱码
        const buffer = fs.readFileSync(filePath);
        let detected = chardet.detect(buffer) || 'utf-8';
        
        // 针对中文环境的特殊处理：如果检测到是常用的单字节编码，优先尝试 GBK
        if (['windows-1252', 'iso-8859-1'].includes(detected.toString().toLowerCase())) {
          detected = 'gbk';
        }
        
        const content = iconv.decode(buffer, detected as string);
        
        // 使用 stream 模式加载内容，ExcelJS 对字符串加载的支持更稳定
        const { Readable } = require('stream');
        const stream = Readable.from([content]);
        await workbook.csv.read(stream);
      } else {
        await workbook.xlsx.readFile(filePath);
      }
    } catch (e: any) {
      throw new Error(`Excel解析失败: ${e.message}。请确保文件格式正确且未被加密。`);
    }
    
    let totalChanged = 0;
    const excelConfig = options.excelConfig || {
      range: ['cell', 'sheetName'],
      formulaType: 'no_limit',
      formulaProcess: 'calculated',
      dataTypes: ['text', 'number', 'logic', 'datetime'],
      highlight: false,
      highlightColor: '#ffff00'
    };

    const highlight = excelConfig.highlight;
    const highlightColor = (excelConfig.highlightColor || '#ffff00').replace('#', '');

    // 处理每个工作表
    for (const worksheet of workbook.worksheets) {
      // 1. 处理工作表名称
      if (excelConfig.range.includes('sheetName')) {
        let oldName = worksheet.name;
        let newName = oldName;
        let sheetNameChanged = 0;
        
        for (const rule of rules) {
          const { count, updated } = this.applyRule(newName, rule, options.otherConfig);
          if (count > 0) {
            sheetNameChanged += count;
            newName = updated;
          }
        }
        
        if (sheetNameChanged > 0) {
          totalChanged += sheetNameChanged;
          // Excel 工作表名称限制
          newName = newName.substring(0, 31).replace(/[\\\/\[\]\*\?:]/g, '_');
          try {
            worksheet.name = newName;
          } catch (e) {
            // 如果改名失败（可能重复），忽略
            console.warn(`Failed to rename sheet from ${oldName} to ${newName}: ${e}`);
          }
        }
      }

      // 2. 处理单元格内容
      if (excelConfig.range.includes('cell')) {
        worksheet.eachRow((row) => {
          row.eachCell({ includeEmpty: false }, (cell) => {
            // 根据公式过滤
            const hasFormula = cell.type === ExcelJS.ValueType.Formula;
            if (excelConfig.formulaType === 'only_formula' && !hasFormula) return;
            if (excelConfig.formulaType === 'no_formula' && hasFormula) return;

            // 获取要处理的值
            let valToProcess = '';
            if (hasFormula && excelConfig.formulaProcess === 'expression') {
              valToProcess = (cell.value as ExcelJS.CellFormulaValue).formula || '';
            } else {
              valToProcess = cell.text || '';
            }

            if (!valToProcess) return;

            // 应用规则
            let newVal = valToProcess;
            let changedInCell = 0;
            for (const rule of rules) {
              const { count, updated } = this.applyRule(newVal, rule, options.otherConfig);
              newVal = updated;
              changedInCell += count;
            }

            if (changedInCell > 0) {
              totalChanged += changedInCell;
              
              if (hasFormula && excelConfig.formulaProcess === 'expression') {
                (cell.value as ExcelJS.CellFormulaValue).formula = newVal;
              } else {
                // 尝试保持原始数据类型
                if (cell.type === ExcelJS.ValueType.Number) {
                  const numVal = Number(newVal);
                  if (!isNaN(numVal)) {
                    cell.value = numVal;
                  } else {
                    cell.value = newVal;
                  }
                } else if (cell.type === ExcelJS.ValueType.Date) {
                  // 日期类型如果修改后不是日期，转为字符串
                  const dateVal = new Date(newVal);
                  if (!isNaN(dateVal.getTime())) {
                    cell.value = dateVal;
                  } else {
                    cell.value = newVal;
                  }
                } else if (cell.type === ExcelJS.ValueType.Boolean) {
                  if (newVal.toLowerCase() === 'true') cell.value = true;
                  else if (newVal.toLowerCase() === 'false') cell.value = false;
                  else cell.value = newVal;
                } else {
                  cell.value = newVal;
                }
              }

              // 设置高亮样式
              if (highlight) {
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FF' + highlightColor } // ExcelJS 使用 ARGB
                };
              }
            }
          });
        });
      }
    }

    try {
      let buffer: Buffer;
      if (ext === '.csv') {
        // 彻底解决 CSV 乱码：
        // 1. 获取第一个工作表
        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) {
          throw new Error('无法读取工作表内容');
        }

        // 2. 手动构建 CSV 内容字符串，避免 ExcelJS 内部编码干扰
        const rows: string[] = [];
        worksheet.eachRow({ includeEmpty: true }, (row) => {
          const values: string[] = [];
          row.eachCell({ includeEmpty: true }, (cell) => {
            let val = cell.text || '';
            // CSV 格式处理：如果有逗号、引号或换行，需要用双引号包裹并转义内部引号
            if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
              val = `"${val.replace(/"/g, '""')}"`;
            }
            values.push(val);
          });
          rows.push(values.join(','));
        });
        const csvString = rows.join('\r\n');

        // 3. 编码转换
        const finalEncoding = (options.targetEncoding && options.targetEncoding !== 'auto') 
          ? options.targetEncoding 
          : 'gbk';
          
        if (finalEncoding.toLowerCase() === 'utf-8') {
          // 如果是 UTF-8，添加 BOM 以确保 Excel 识别
          buffer = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), iconv.encode(csvString, 'utf-8')]);
        } else {
          buffer = iconv.encode(csvString, finalEncoding);
        }
      } else {
        const out = await workbook.xlsx.writeBuffer();
        buffer = Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
      }
      return { changed: totalChanged, outputBuffer: buffer };
    } catch (e: any) {
      console.error('Excel write error:', e);
      throw new Error(`无法生成 Excel 输出: ${e.message}`);
    }
  }

  // 备用的 XLSX 处理方法（用于 .xls 或作为 fallback）
  private static async processExcelFileWithXLSX(
    filePath: string,
    rules: RuleDefinition[],
    options: RuleProcessOptions
  ): Promise<{ changed: number; outputBuffer: Buffer }> {
    let workbook;
    try {
      const fileBuffer = fs.readFileSync(filePath);
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch (e: any) {
      throw new Error(`Excel解析失败: ${e.message}。请确保文件格式正确且未被加密。`);
    }
    
    let totalChanged = 0;
    const excelConfig = options.excelConfig || {
      range: ['cell', 'sheetName'],
      formulaType: 'no_limit',
      formulaProcess: 'calculated',
      dataTypes: ['text', 'number', 'logic', 'datetime'],
      highlight: false,
      highlightColor: '#ffff00'
    };

    const sheetNames = [...workbook.SheetNames];
    const newSheets: Record<string, any> = {};
    const processedSheetNames: string[] = [];

    for (const sheetName of sheetNames) {
      let currentSheetName = sheetName;
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      
      if (excelConfig.range.includes('sheetName')) {
        let tempName = currentSheetName;
        let sheetNameChanged = 0;
        for (const rule of rules) {
          const { count, updated } = this.applyRule(tempName, rule, options.otherConfig);
          if (count > 0) {
            sheetNameChanged += count;
            tempName = updated;
          }
        }
        if (sheetNameChanged > 0) {
          totalChanged += sheetNameChanged;
          tempName = tempName.substring(0, 31).replace(/[\\\/\[\]\*\?:]/g, '_');
          if (tempName && tempName.trim() !== '' && !processedSheetNames.includes(tempName)) {
            currentSheetName = tempName;
          }
        }
      }

      if (processedSheetNames.includes(currentSheetName)) {
        let suffix = 1;
        let uniqueName = currentSheetName.substring(0, 28) + '_' + suffix;
        while (processedSheetNames.includes(uniqueName)) {
          suffix++;
          uniqueName = currentSheetName.substring(0, 28) + '_' + suffix;
        }
        currentSheetName = uniqueName;
      }

      processedSheetNames.push(currentSheetName);
      newSheets[currentSheetName] = sheet;

      if (excelConfig.range.includes('cell')) {
        const ref = sheet['!ref'];
        if (ref) {
          const range = XLSX.utils.decode_range(ref);
          for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
              const cellAddress = XLSX.utils.encode_col(C) + (R + 1);
              const cell = sheet[cellAddress];
              if (!cell || cell.v === undefined) continue;

              const cellType = cell.t;
              const typeMap: Record<string, string> = { s: 'text', n: 'number', b: 'logic', d: 'datetime' };
              const mappedType = typeMap[cellType] || 'other';
              if (excelConfig.dataTypes && !excelConfig.dataTypes.includes(mappedType)) continue;

              const hasFormula = !!cell.f;
              if (excelConfig.formulaType === 'only_formula' && !hasFormula) continue;
              if (excelConfig.formulaType === 'no_formula' && hasFormula) continue;

              let valToProcess = '';
              if (hasFormula && excelConfig.formulaProcess === 'expression') {
                valToProcess = cell.f;
              } else {
                valToProcess = cell.w || (cell.v !== undefined ? String(cell.v) : '');
              }

              let newVal = valToProcess;
              let changedInCell = 0;
              for (const rule of rules) {
                const { count, updated } = this.applyRule(newVal, rule, options.otherConfig);
                newVal = updated;
                changedInCell += count;
              }

              if (changedInCell > 0) {
                totalChanged += changedInCell;
                if (hasFormula && excelConfig.formulaProcess === 'expression') {
                  cell.f = newVal;
                } else {
                  const numVal = Number(newVal);
                  if (cellType === 'n' && !isNaN(numVal) && newVal.trim() !== '') {
                    cell.v = numVal;
                  } else {
                    cell.v = newVal;
                    cell.t = 's';
                  }
                  delete cell.w;
                }
              }
            }
          }
        }
      }
    }

    workbook.SheetNames = processedSheetNames;
    workbook.Sheets = newSheets;

    try {
      const ext = path.extname(filePath).toLowerCase();
      let bookType: XLSX.BookType = 'xlsx';
      if (ext === '.xls') bookType = 'biff8';
      else if (ext === '.csv') bookType = 'csv';
      
      const outputBuffer = XLSX.write(workbook, { type: 'buffer', bookType });
      return { changed: totalChanged, outputBuffer };
    } catch (e: any) {
      throw new Error(`无法生成 Excel 输出: ${e.message}`);
    }
  }

  private static async processPptFile(
    filePath: string,
    rules: RuleDefinition[],
    options: RuleProcessOptions
  ): Promise<{ changed: number; outputBuffer: Buffer }> {
    const zip = new AdmZip(filePath);
    let totalChanged = 0;
    const pptConfig = options.pptConfig || { range: ['text'], highlight: false, highlightColor: 'ffff00' };

    // PPT 的文本通常在 ppt/slides/slide*.xml 中
    const entries = zip.getEntries();
    for (const entry of entries) {
      const entryName = entry.entryName;
      let shouldProcess = false;
      if (pptConfig.range.includes('text') && entryName.startsWith('ppt/slides/slide')) shouldProcess = true;
      if (pptConfig.range.includes('master') && entryName.startsWith('ppt/slideMasters/slideMaster')) shouldProcess = true;
      if (pptConfig.range.includes('layout') && entryName.startsWith('ppt/slideLayouts/slideLayout')) shouldProcess = true;

      if (shouldProcess) {
        let content = entry.getData().toString('utf8');
        
        // 一次性处理所有规则
        const { count, updated } = this.applyRulesToPptXml(content, rules, options);

        if (count > 0) {
          zip.updateFile(entryName, Buffer.from(updated, 'utf8'));
          totalChanged += count;
        }
      }
    }

    return { changed: totalChanged, outputBuffer: zip.toBuffer() };
  }

  private static applyRulesToPptXml(
    content: string, 
    rules: RuleDefinition[], 
    options: RuleProcessOptions
  ): { count: number; updated: string } {
    let totalCount = 0;
    const highlight = options.pptConfig?.highlight;
    const highlightColor = (options.pptConfig?.highlightColor || 'ffff00').replace('#', '');

    // PPT 使用 <a:r> 作为运行块，<a:t> 作为文本
    const updated = content.replace(/<a:r(\b[^>]*)>([\s\S]*?)<\/a:r>/g, (runMatch, rAttrs, runInner) => {
      // 检查是否有文本内容
      if (!runInner.includes('<a:t')) return runMatch;

      // 提取所有文本
      let fullText = '';
      const tRegex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
      let tMatch;
      while ((tMatch = tRegex.exec(runInner)) !== null) {
        fullText += tMatch[1];
      }

      if (!fullText) return runMatch;

      // 应用规则并获取分段
      const { segments, totalCount: runCount } = this.applyRulesToSegments(fullText, rules, options.otherConfig);
      if (runCount === 0) return runMatch;

      totalCount += runCount;

      // 提取原有的 rPr (Run Properties)
      let rPr = '';
      const rPrMatch = runInner.match(/<a:rPr>([\s\S]*?)<\/a:rPr>/);
      if (rPrMatch) rPr = rPrMatch[1];

      // 构造新的 Runs
      const resultRuns = segments.map(seg => {
        if (!seg.text && seg.changed) return ''; 
        if (!seg.text && !seg.changed) return '';

        let currentRPr = rPr;
        if (highlight && seg.changed) {
          // PPT 高亮：<a:rPr> 内添加 <a:highlight><a:srgbClr val="RRGGBB"/></a:highlight>
          const highlightTag = `<a:highlight><a:srgbClr val="${highlightColor}"/></a:highlight>`;
          
          if (currentRPr.includes('<a:highlight')) {
            currentRPr = currentRPr.replace(/<a:highlight[^>]*>[\s\S]*?<\/a:highlight>/, highlightTag);
          } else {
            // 插入到 <a:rPr> 内部
            currentRPr = highlightTag + currentRPr;
          }
        }

        const rPrTag = currentRPr ? `<a:rPr>${currentRPr}</a:rPr>` : '';
        return `<a:r${rAttrs}>${rPrTag}<a:t xml:space="preserve">${seg.text}</a:t></a:r>`;
      });

      return resultRuns.join('');
    });

    return { count: totalCount, updated };
  }

  private static applyRulesToSegments(
    text: string,
    rules: RuleDefinition[],
    otherConfig?: { keepWhitespace: boolean }
  ): { segments: { text: string; changed: boolean }[]; totalCount: number } {
    let segments = [{ text, changed: false }];
    let totalCount = 0;

    for (const rule of rules) {
      // 拆分批量规则为单个子规则
      const subRules: { find: string; replace: string; type: 'exact' | 'regex' }[] = [];
      if (rule.type === 'batch_exact' || rule.type === 'batch_regex') {
        const findLines = rule.find.split(/\r?\n/).filter(l => l !== '');
        const replaceLines = (rule.replace || '').split(/\r?\n/);
        findLines.forEach((f, i) => {
          subRules.push({
            find: f,
            replace: replaceLines[i] || '',
            type: rule.type === 'batch_exact' ? 'exact' : 'regex'
          });
        });
      } else {
        subRules.push({
          find: rule.find,
          replace: rule.replace,
          type: rule.type as 'exact' | 'regex'
        });
      }

      for (const subRule of subRules) {
        if (!subRule.find) continue;
        
        const nextSegments: { text: string; changed: boolean }[] = [];
        
        for (const segment of segments) {
          // 如果该段已经是被之前规则修改过的，我们只在原有基础上修改文本，不再进一步拆分
          if (segment.changed) {
            const { updated, count } = this.applySingleRule(segment.text, { ...rule, ...subRule } as any, otherConfig);
            if (count > 0) {
              nextSegments.push({ text: updated, changed: true });
              totalCount += count;
            } else {
              nextSegments.push(segment);
            }
            continue;
          }

          // 对未修改段应用规则并拆分
          const pattern = subRule.type === 'regex' ? subRule.find : this.escapeRegExp(subRule.find);
          let flags = rule.caseSensitive ? 'g' : 'gi';
          
          if (subRule.type === 'regex' && rule.multiline) {
            flags += 'ms';
          }
          
          const finalPattern = subRule.type === 'exact' && rule.wholeWord ? `\\b${pattern}\\b` : pattern;
          
          try {
            const regex = new RegExp(finalPattern, flags);
            let lastIndex = 0;
            let match;
            let found = false;

            while ((match = regex.exec(segment.text)) !== null) {
              found = true;
              totalCount++;
              
              if (match.index > lastIndex) {
                nextSegments.push({ text: segment.text.substring(lastIndex, match.index), changed: false });
              }
              
              // 处理替换字符串中的反向引用 (如 $1, $2)
              let replacement = subRule.replace || '';
              if (subRule.type === 'regex' && replacement.includes('$')) {
                const replacedText = match[0].replace(regex, replacement);
                nextSegments.push({ text: replacedText, changed: true });
              } else {
                nextSegments.push({ text: replacement, changed: true });
              }
              
              lastIndex = regex.lastIndex;
              if (regex.lastIndex === match.index) regex.lastIndex++;
            }

            if (found) {
              if (lastIndex < segment.text.length) {
                nextSegments.push({ text: segment.text.substring(lastIndex), changed: false });
              }
            } else {
              nextSegments.push(segment);
            }
          } catch (e) {
            nextSegments.push(segment);
          }
        }
        segments = nextSegments;
      }
    }

    return { segments, totalCount };
  }

  private static async processPdfFile(
    filePath: string,
    rules: RuleDefinition[],
    options: RuleProcessOptions
  ): Promise<{ changed: number; outputBuffer: Buffer }> {
    // PDF 修改非常复杂，pdf-lib 并不直接支持查找和替换页面内容。
    // 为了实现 PDF 正文文本的替换，我们需要更底层的方式。
    
    const existingPdfBytes = fs.readFileSync(filePath);
    // 禁用对象流和压缩以允许直接替换内容
    const pdfDoc = await PDFDocument.load(existingPdfBytes, { 
      updateMetadata: true,
      ignoreEncryption: true
    });
    let totalChanged = 0;

    // 1. 处理元数据 (Title, Author, Subject, Keywords)
    const title = pdfDoc.getTitle() || '';
    const author = pdfDoc.getAuthor() || '';
    const subject = pdfDoc.getSubject() || '';
    const keywords = pdfDoc.getKeywords() || [];

    let newTitle = title;
    let newAuthor = author;
    let newSubject = subject;
    let newKeywords = Array.isArray(keywords) ? keywords.join(', ') : (keywords || '');

    for (const rule of rules) {
      // Title
      const resT = this.applyRule(newTitle, rule, options.otherConfig);
      if (resT.count > 0) {
        totalChanged += resT.count;
        newTitle = resT.updated;
      }
      // Author
      const resA = this.applyRule(newAuthor, rule, options.otherConfig);
      if (resA.count > 0) {
        totalChanged += resA.count;
        newAuthor = resA.updated;
      }
      // Subject
      const resS = this.applyRule(newSubject, rule, options.otherConfig);
      if (resS.count > 0) {
        totalChanged += resS.count;
        newSubject = resS.updated;
      }
      // Keywords
      const resK = this.applyRule(newKeywords, rule, options.otherConfig);
      if (resK.count > 0) {
        totalChanged += resK.count;
        newKeywords = resK.updated;
      }
    }

    pdfDoc.setTitle(newTitle);
    pdfDoc.setAuthor(newAuthor);
    pdfDoc.setSubject(newSubject);
    const keywordsArray = newKeywords.split(/[,，;；]/).map(k => k.trim()).filter(k => k !== '');
    pdfDoc.setKeywords(keywordsArray);

    // 2. 处理页面文本内容
    // 在 PDF 内部，文本通常存储在 (Text) Tj 或 [ (T) 10 (ext) ] TJ 格式中
    // 这种方法只能处理未压缩或简单编码的文本
    const pages = pdfDoc.getPages();
    for (const page of pages) {
      // @ts-ignore
      const contentNodes = page.node.Contents();
      if (!contentNodes) continue;

      const contents = Array.isArray(contentNodes) ? contentNodes : [contentNodes];
      
      for (const content of contents) {
        // @ts-ignore
        const stream: any = pdfDoc.context.lookup(content as any);
        if (!stream || !('contents' in stream)) continue;

        // 尝试解码内容流
        let streamText = '';
        try {
          // @ts-ignore
          const decoded = stream.decode();
          streamText = Buffer.from(decoded).toString('latin1');
          
          let pageChanged = false;
          // 使用统一的规则处理函数
          // PDF 内容流中的文本通常有几种形式：
          // 1. (文本内容) Tj
          // 2. [(文本) 10 (内容)] TJ (其中 10 是间距)
          
          // 匹配 (文本) Tj
          const tjRegex = /\((.*?)(?<!\\)\)\s*Tj/g;
          streamText = streamText.replace(tjRegex, (match, text) => {
            const { count, updated } = this.applyRulesToText(text, rules, options.otherConfig);
            if (count > 0) {
              totalChanged += count;
              pageChanged = true;
              return `(${updated}) Tj`;
            }
            return match;
          });

          // 匹配 [(文本) 10 (内容)] TJ
          const tjBigRegex = /\[\s*((?:\(.*?)(?<!\\)\)\s*-?\d*\s*)+\]\s*TJ/g;
          streamText = streamText.replace(tjBigRegex, (match) => {
            let innerMatchCount = 0;
            const updatedInner = match.replace(/\((.*?)(?<!\\)\)/g, (m, text) => {
              const { count, updated } = this.applyRulesToText(text, rules, options.otherConfig);
              if (count > 0) {
                innerMatchCount += count;
                return `(${updated})`;
              }
              return m;
            });

            if (innerMatchCount > 0) {
              totalChanged += innerMatchCount;
              pageChanged = true;
              return updatedInner;
            }
            return match;
          });

          if (pageChanged) {
            // 将修改后的内容重新编码并存回
            const newBytes = Buffer.from(streamText, 'latin1');
            // @ts-ignore
            stream.contents = newBytes;
          }
        } catch (e) {
          // 解码失败说明可能是复杂的压缩格式或加密，跳过
          continue;
        }
      }
    }

    const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
    return { changed: totalChanged, outputBuffer: Buffer.from(pdfBytes) };
  }

  /**
   * 对文本应用多条规则
   */
  private static applyRulesToText(
    text: string, 
    rules: RuleDefinition[], 
    otherConfig?: { keepWhitespace: boolean }
  ): { count: number; updated: string } {
    let totalCount = 0;
    let currentText = text;

    for (const rule of rules) {
      const { count, updated } = this.applyRule(currentText, rule, otherConfig);
      if (count > 0) {
        totalCount += count;
        currentText = updated;
      }
    }

    return { count: totalCount, updated: currentText };
  }

  private static applyRule(
    content: string,
    rule: RuleDefinition,
    otherConfig?: { keepWhitespace: boolean }
  ): { count: number; updated: string } {
    if (!rule.find) {
      return { count: 0, updated: content };
    }

    if (rule.type === 'batch_exact' || rule.type === 'batch_regex') {
      const findLines = rule.find.split(/\r?\n/).filter(line => line.trim() !== '');
      const replaceLines = rule.replace ? rule.replace.split(/\r?\n/) : [];
      
      let currentContent = content;
      let totalCount = 0;

      for (let i = 0; i < findLines.length; i++) {
        const findPattern = findLines[i];
        const replacePattern = replaceLines[i] || ''; // If replace is shorter, use empty string
        
        const singleType = rule.type === 'batch_exact' ? 'exact' : 'regex';
        const { count, updated } = this.applySingleRule(currentContent, {
          ...rule,
          type: singleType as 'exact' | 'regex',
          find: findPattern,
          replace: replacePattern
        }, otherConfig);
        
        currentContent = updated;
        totalCount += count;
      }

      return { count: totalCount, updated: currentContent };
    }

    return this.applySingleRule(content, rule as any, otherConfig);
  }

  private static applySingleRule(
    content: string,
    rule: { type: 'exact' | 'regex', find: string, replace: string, caseSensitive?: boolean, wholeWord?: boolean, multiline?: boolean },
    otherConfig?: { keepWhitespace: boolean }
  ): { count: number; updated: string } {
    if (!rule.find) {
      return { count: 0, updated: content };
    }

    let pattern = rule.find;
    let flags = rule.caseSensitive ? 'g' : 'gi';
    
    // 如果是正则模式，且开启了多行模式，增加 m 和 s 标志
    if (rule.type === 'regex' && rule.multiline) {
      flags += 'ms';
    }

    if (rule.type === 'regex') {
      try {
        const reg = new RegExp(pattern, flags);
        let count = 0;
        const updated = content.replace(reg, (...args) => {
          count += 1;
          const match = args[0];
          const groups = args.slice(1, -2);
          
          // 处理替换字符串中的反向引用 (如 $1, $2)
          let replacement = rule.replace ?? '';
          if (replacement.includes('$')) {
            return match.replace(reg, replacement);
          }
          return replacement;
        });
        return { count, updated };
      } catch (e) {
        // If regex is invalid, treat as literal or return unchanged
        return { count: 0, updated: content };
      }
    }

    // Exact match
    if (rule.wholeWord) {
      pattern = `\\b${this.escapeRegExp(pattern)}\\b`;
    } else {
      pattern = this.escapeRegExp(pattern);
    }

    const reg = new RegExp(pattern, flags);
    let count = 0;
    const updated = content.replace(reg, () => {
      count += 1;
      return rule.replace ?? '';
    });
    return { count, updated };
  }

  private static escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private static logError(filePath: string, message: string) {
    try {
      const logDir = path.join(app.getPath('userData'), 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const logFile = path.join(logDir, 'rule-modifier.log');
      const line = `[${new Date().toISOString()}] ${filePath} - ${message}\n`;
      fs.appendFileSync(logFile, line, 'utf-8');
    } catch {
    }
  }
}
