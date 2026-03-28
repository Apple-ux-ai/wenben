import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

export interface GenerateOptions {
  templatePath: string;
  excelPath: string;
  mapping: Record<string, string>; // [placeholder]: columnHeader
  outputDir: string;
  fileNameFormat: string; // e.g. "[列1]_[列2]"
  outputExt: string;
  headerRow?: number;
  singleTaskMode?: boolean;
  sheetName?: string;
  conflictAction?: 'overwrite' | 'copy';
}

export class TemplateService {
  /**
   * 统一读取 Excel 的逻辑，确保稳健性
   */
  private static readExcelInternal(fileBuffer: Buffer) {
    // 使用最基础、兼容性最强的读取选项
    const workbook = XLSX.read(fileBuffer, {
      type: 'buffer',
      cellFormula: false,
      cellHTML: false,
      cellText: true,
      cellDates: false, // 保持为原始值，依赖 cellText 获取格式化后的文本
      cellNF: true
    });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel 文件中没有发现任何工作表');
    }
    return workbook;
  }

  /**
   * 获取工作表数据并处理范围
   */
  private static getSheetData(workbook: XLSX.WorkBook, preferredSheetName?: string): { data: any[][], sheetName: string } {
    let worksheet: XLSX.WorkSheet | null = null;
    let sheetName = '';

    if (preferredSheetName && workbook.Sheets[preferredSheetName]) {
      worksheet = workbook.Sheets[preferredSheetName];
      sheetName = preferredSheetName;
      console.log(`TemplateService: Using specified sheet "${sheetName}"`);
    } else {
      // 遍历所有工作表，找到第一个有实际数据的工作表
      for (const name of workbook.SheetNames) {
        const sheet = workbook.Sheets[name];
        if (sheet) {
          // 检查是否有任何单元格数据（非 ! 开头的键）
          const cellKeys = Object.keys(sheet).filter(key => !key.startsWith('!'));
          if (cellKeys.length > 0) {
            worksheet = sheet;
            sheetName = name;
            console.log(`TemplateService: Found data in sheet "${name}" (${cellKeys.length} cells)`);
            break;
          }
        }
      }
      
      // 兜底：如果都没数据，拿第一个
      if (!worksheet && workbook.SheetNames.length > 0) {
        sheetName = workbook.SheetNames[0];
        worksheet = workbook.Sheets[sheetName];
        console.log(`TemplateService: Fallback to first sheet "${sheetName}"`);
      }
    }

    if (!worksheet) {
      throw new Error('Excel 文件中未找到有效的工作表数据');
    }

    // 重新计算范围（!ref）
    const cellKeys = Object.keys(worksheet).filter(key => !key.startsWith('!'));
    if (cellKeys.length > 0) {
      let range = { s: { r: 20000000, c: 20000000 }, e: { r: 0, c: 0 } };
      cellKeys.forEach(key => {
        try {
          const cell = XLSX.utils.decode_cell(key);
          if (cell.r < range.s.r) range.s.r = cell.r;
          if (cell.c < range.s.c) range.s.c = cell.c;
          if (cell.r > range.e.r) range.e.r = cell.r;
          if (cell.c > range.e.c) range.e.c = cell.c;
        } catch (e) {}
      });
      worksheet['!ref'] = XLSX.utils.encode_range(range);
      console.log(`TemplateService: Calculated/Updated range for "${sheetName}": ${worksheet['!ref']}`);
    } else if (!worksheet['!ref']) {
      worksheet['!ref'] = 'A1:A1';
    }

    const data = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      raw: false,
      defval: '',
      blankrows: true
    }) as any[][];

    return { data, sheetName };
  }

  /**
   * 获取 Excel 表头
   */
  static async getExcelHeaders(filePath: string, headerRow: number = 1): Promise<{ headers: string[]; sheetName: string }> {
    try {
      console.log(`TemplateService: getExcelHeaders called for ${filePath}`);
      const cleanPath = path.normalize(filePath.replace(/^["']|["']$/g, '').trim());
      if (!fs.existsSync(cleanPath)) throw new Error(`文件不存在: ${cleanPath}`);

      const fileBuffer = fs.readFileSync(cleanPath);
      const workbook = this.readExcelInternal(fileBuffer);
      const { data, sheetName } = this.getSheetData(workbook);
      
      console.log(`TemplateService: sheet_to_json returned ${data.length} rows from ${sheetName}`);

      const targetRowIndex = (headerRow || 1) - 1;
      if (data && data.length > targetRowIndex) {
        const headers = data[targetRowIndex]
          .map(h => String(h || '').trim())
          .filter(h => h !== '');
        
        if (headers.length > 0) {
          console.log(`TemplateService: Successfully extracted ${headers.length} headers from row ${headerRow}`);
          return { headers, sheetName };
        }
      }

      // 容错处理：如果指定行没找到，自动搜索第一行非空行
      for (let i = 0; i < data.length; i++) {
        const foundHeaders = data[i].map(h => String(h || '').trim()).filter(h => h !== '');
        if (foundHeaders.length > 0) {
          console.log(`TemplateService: Found headers in row ${i + 1} instead`);
          return { headers: foundHeaders, sheetName };
        }
      }

      return { headers: [], sheetName };
    } catch (error: any) {
      console.error('TemplateService Error (getExcelHeaders):', error);
      throw new Error(`读取 Excel 失败: ${error.message}`);
    }
  }

  /**
   * 检查文件冲突
   */
  static async checkConflicts(options: GenerateOptions): Promise<{ hasConflict: boolean; conflictingFiles: string[] }> {
    const { 
      excelPath, 
      outputDir, 
      fileNameFormat, 
      outputExt, 
      headerRow = 1, 
      sheetName: preferredSheetName 
    } = options;

    try {
      const cleanExcelPath = path.normalize(excelPath.replace(/^["']|["']$/g, '').trim());
      if (!fs.existsSync(cleanExcelPath)) return { hasConflict: false, conflictingFiles: [] };

      const fileBuffer = fs.readFileSync(cleanExcelPath);
      const workbook = this.readExcelInternal(fileBuffer);
      const { data: allData } = this.getSheetData(workbook, preferredSheetName);

      if (!allData || allData.length === 0) return { hasConflict: false, conflictingFiles: [] };

      // 与 generateFiles 中的表头定位逻辑保持完全一致
      let headerIndex = (headerRow || 1) - 1;
      if (headerIndex < 0 || headerIndex >= allData.length) {
        headerIndex = -1;
      }

      if (headerIndex === -1) {
        for (let i = 0; i < allData.length; i++) {
          const row = allData[i] || [];
          if (row.some(cell => String(cell || '').trim() !== '')) {
            headerIndex = i;
            break;
          }
        }
      }

      if (headerIndex === -1) return { hasConflict: false, conflictingFiles: [] };

      const headers = (allData[headerIndex] || []).map(h => String(h || '').trim());
      const rows = allData.slice(headerIndex + 1).filter(row => 
        row && row.some(cell => String(cell || '').trim() !== '')
      );

      const cleanOutputDir = path.normalize(outputDir.replace(/^["']|["']$/g, '').trim());
      if (!fs.existsSync(cleanOutputDir)) return { hasConflict: false, conflictingFiles: [] };

      const conflictingFiles: string[] = [];
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        let fileName = '';
        if (fileNameFormat.startsWith('取第')) {
          const match = fileNameFormat.match(/取第\s*(\d+)\s*列/);
          if (match) {
            const colIdx = parseInt(match[1]) - 1;
            fileName = (colIdx >= 0 && colIdx < row.length) ? String(row[colIdx]).trim() : '';
          }
        } else {
          fileName = fileNameFormat;
          const fileNamePlaceholders = fileNameFormat.match(/\[(.*?)\]/g) || [];
          for (const ph of fileNamePlaceholders) {
            const colName = ph.substring(1, ph.length - 1).trim();
            // 模糊匹配表头，忽略空格
            const colIdx = headers.findIndex(h => h.trim() === colName);
            const val = (colIdx !== -1 && row[colIdx] !== undefined) ? String(row[colIdx]).trim() : '';
            fileName = fileName.replace(ph, val);
          }
        }

        fileName = fileName.replace(/[\\/:*?"<>|]/g, '_').trim();
        if (!fileName) {
          const firstVal = row.find(v => v && String(v).trim() !== '');
          fileName = firstVal ? String(firstVal).trim().substring(0, 30) : `result_${i + 1}`;
        }
        
        const fullPath = path.join(cleanOutputDir, `${fileName}.${outputExt || 'txt'}`);
        if (fs.existsSync(fullPath)) {
          conflictingFiles.push(fileName);
        }
      }

      return {
        hasConflict: conflictingFiles.length > 0,
        conflictingFiles: conflictingFiles.slice(0, 10) // 只返回前10个作为示例
      };
    } catch (error) {
      console.error('Check conflicts error:', error);
      return { hasConflict: false, conflictingFiles: [] };
    }
  }

  /**
   * 根据模板生成文件
   */
  static async generateFiles(options: GenerateOptions) {
    const { 
      templatePath, 
      excelPath, 
      mapping, 
      outputDir, 
      fileNameFormat, 
      outputExt, 
      headerRow = 1, 
      sheetName: preferredSheetName,
      conflictAction = 'overwrite'
    } = options;

    try {
      console.log(`TemplateService: generateFiles called for ${excelPath}`);
      
      // 1. 读取模板
      const cleanTemplatePath = path.normalize(templatePath.replace(/^["']|["']$/g, '').trim());
      if (!fs.existsSync(cleanTemplatePath)) throw new Error(`模板文件不存在: ${cleanTemplatePath}`);
      const templateContent = fs.readFileSync(cleanTemplatePath, 'utf-8');

      // 2. 读取 Excel
      const cleanExcelPath = path.normalize(excelPath.replace(/^["']|["']$/g, '').trim());
      if (!fs.existsSync(cleanExcelPath)) throw new Error(`Excel 数据文件不存在: ${cleanExcelPath}`);

      const fileBuffer = fs.readFileSync(cleanExcelPath);
      const workbook = this.readExcelInternal(fileBuffer);
      const { data: allData, sheetName } = this.getSheetData(workbook, preferredSheetName);

      console.log(`TemplateService: generateFiles got ${allData.length} rows from sheet "${sheetName}"`);

      if (!allData || allData.length === 0) {
        throw new Error(`Excel 工作表 "${sheetName}" 中未检测到任何数据`);
      }

      // 3. 确定表头行
      let headerIndex = (headerRow || 1) - 1;
      if (headerIndex < 0 || headerIndex >= allData.length) {
        headerIndex = -1;
      }

      if (headerIndex === -1) {
        for (let i = 0; i < allData.length; i++) {
          const row = allData[i] || [];
          if (row.some(cell => String(cell || '').trim() !== '')) {
            headerIndex = i;
            break;
          }
        }
      }

      if (headerIndex === -1) {
        throw new Error('Excel 文件中未检测到有效的表头行');
      }

      const headers = (allData[headerIndex] || []).map(h => String(h || '').trim());
      const rows = allData.slice(headerIndex + 1).filter(row => 
        row && row.some(cell => String(cell || '').trim() !== '')
      );

      if (rows.length === 0) {
        throw new Error('Excel 文件中未检测到数据行，请确认表头下方是否有数据');
      }

      console.log(`TemplateService: Processing ${rows.length} rows with ${headers.length} columns`);

      // 4. 生成文件
      const cleanOutputDir = path.normalize(outputDir.replace(/^["']|["']$/g, '').trim());
      if (!fs.existsSync(cleanOutputDir)) {
        fs.mkdirSync(cleanOutputDir, { recursive: true });
      }

      const results = [];
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          let content = templateContent;
          
          // 替换占位符
          for (const [placeholder, columnHeader] of Object.entries(mapping)) {
            if (!columnHeader || !placeholder || !placeholder.trim()) continue;

            // 模糊匹配表头，忽略空格
            const colIndex = headers.findIndex(h => h.trim() === columnHeader.trim());
            if (colIndex === -1) continue;

            const value = row[colIndex] !== undefined ? String(row[colIndex]).trim() : '';
            const escapedPlaceholder = this.escapeRegExp(placeholder);
            const replaceRegex = new RegExp(escapedPlaceholder, 'g');
            content = content.replace(replaceRegex, value);
          }

          // 生成文件名
          let fileName = '';
          if (fileNameFormat.startsWith('取第')) {
            const match = fileNameFormat.match(/取第\s*(\d+)\s*列/);
            if (match) {
              const colIdx = parseInt(match[1]) - 1;
              fileName = (colIdx >= 0 && colIdx < row.length) ? String(row[colIdx]).trim() : '';
            }
          } else {
            fileName = fileNameFormat;
            const fileNamePlaceholders = fileNameFormat.match(/\[(.*?)\]/g) || [];
            for (const ph of fileNamePlaceholders) {
              const colName = ph.substring(1, ph.length - 1).trim();
              // 模糊匹配表头，忽略空格
              const colIdx = headers.findIndex(h => h.trim() === colName);
              const val = (colIdx !== -1 && row[colIdx] !== undefined) ? String(row[colIdx]).trim() : '';
              fileName = fileName.replace(ph, val);
            }
          }

          fileName = fileName.replace(/[\\/:*?"<>|]/g, '_').trim();
          if (!fileName) {
            const firstVal = row.find(v => v && String(v).trim() !== '');
            fileName = firstVal ? String(firstVal).trim().substring(0, 30) : `result_${i + 1}`;
          }
          
          let fullPath = path.join(cleanOutputDir, `${fileName}.${outputExt || 'txt'}`);
          
          // 处理冲突：如果是创建副本且文件已存在
          if (conflictAction === 'copy' && fs.existsSync(fullPath)) {
            const timestamp = new Date().getTime();
            // 避免极短时间内生成多个文件导致时间戳相同，虽然这里是循环处理，但为了稳健可以加个随机数或索引
            fullPath = path.join(cleanOutputDir, `${fileName}_副本_${timestamp}_${i}.${outputExt || 'txt'}`);
          }

          fs.writeFileSync(fullPath, content, 'utf-8');
          
          successCount++;
          results.push({ success: true, path: fullPath });
        } catch (err: any) {
          failCount++;
          results.push({ success: false, error: err.message });
        }
      }

      return {
        total: rows.length,
        successCount,
        failCount,
        results
      };
    } catch (error: any) {
      console.error('TemplateService Error (generateFiles):', error);
      throw error;
    }
  }

  private static escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
