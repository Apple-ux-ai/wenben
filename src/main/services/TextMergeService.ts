import fs from 'fs';
import path from 'path';

export type MergeMode = 'single' | 'by_folder';

export interface MergeOptions {
  mode: MergeMode;
  outputDir?: string;
  outputFormat?: 'txt' | 'xml' | 'json' | 'html';
  conflictAction?: 'overwrite' | 'new';
  separator?: string; // 自定义分隔符
  addNewLine?: boolean; // 是否在文件间强制添加换行符
}

export interface MergeResultItem {
  sourceFiles: string[];
  outputPath: string;
  success: boolean;
  error?: string;
}

export interface MergeResult {
  success: boolean;
  results: MergeResultItem[];
  error?: string;
}

export class TextMergeService {
  private static ensureDirExists(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private static getCommonBaseDir(filePaths: string[]): string {
    if (filePaths.length === 0) return '';
    const parts = filePaths.map(p => path.resolve(p).split(path.sep));
    const first = parts[0];
    let end = first.length;

    for (let i = 0; i < first.length; i++) {
      const segment = first[i];
      if (!parts.every(p => p[i] === segment)) {
        end = i;
        break;
      }
    }

    return first.slice(0, end).join(path.sep);
  }

  private static getUniqueOutputPath(outputPath: string): string {
    if (!fs.existsSync(outputPath)) return outputPath;
    const dir = path.dirname(outputPath);
    const ext = path.extname(outputPath);
    const name = path.basename(outputPath, ext);
    let counter = 1;
    let newPath = outputPath;
    while (fs.existsSync(newPath)) {
      newPath = path.join(dir, `${name}_${counter}${ext}`);
      counter++;
    }
    return newPath;
  }

  private static async readFileContent(filePath: string): Promise<string> {
    const chardetModule = await import('chardet');
    const chardet = chardetModule.default || chardetModule;
    
    const iconvModule = await import('iconv-lite');
    const iconv = iconvModule.default || iconvModule;
    
    const buffer = fs.readFileSync(filePath);
    let encoding = '';
    
    // Check BOM
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      encoding = 'utf-8';
    } else if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
      encoding = 'utf-16le';
    } else if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
      encoding = 'utf-16be';
    } else {
      // Use chardet
      const detected = chardet.detect(buffer);
      encoding = (detected && typeof detected === 'string') ? detected : 'utf-8';
      
      // Fix for common misidentification of GBK as Shift_JIS or ISO-8859-1 in Chinese environment
      if (encoding === 'Shift_JIS' || encoding === 'ISO-8859-1' || encoding === 'windows-1252') {
        encoding = 'GB18030';
      }
    }

    // Decode
    try {
      return iconv.decode(buffer, encoding);
    } catch (e) {
      console.warn(`Failed to decode ${filePath} with ${encoding}, trying utf-8`);
      return iconv.decode(buffer, 'utf-8');
    }
  }

  static async mergeFiles(filePaths: string[], options: MergeOptions): Promise<MergeResult> {
    try {
      const validPaths = filePaths.filter(p => p && fs.existsSync(p) && fs.statSync(p).isFile());
      if (validPaths.length === 0) {
        return { success: false, results: [], error: '没有可合并的文件' };
      }

      const results: MergeResultItem[] = [];
      const conflictAction = options.conflictAction || 'overwrite';
      const format = options.outputFormat || 'txt';
      const ext = `.${format}`;

      const processGroup = async (sourceFiles: string[], outputPath: string) => {
        try {
          if (fs.existsSync(outputPath)) {
            if (conflictAction === 'new') {
              outputPath = this.getUniqueOutputPath(outputPath);
            } else {
              fs.unlinkSync(outputPath);
            }
          }

          let combinedContent = '';

          for (let i = 0; i < sourceFiles.length; i++) {
            const p = sourceFiles[i];
            const content = await this.readFileContent(p);
            
            if (i > 0) {
              if (options.separator) {
                const sep = options.separator.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
                combinedContent += sep + '\n';
              } else if (options.addNewLine) {
                combinedContent += '\n';
              }
            }

            combinedContent += content;
          }

          if (format === 'txt') {
            const iconvModule = await import('iconv-lite');
            const iconv = iconvModule.default || iconvModule;
            const bufferOut = iconv.encode(combinedContent, 'GB18030');
            fs.writeFileSync(outputPath, bufferOut);
          } else {
            fs.writeFileSync(outputPath, combinedContent, 'utf8');
          }
          
          return { success: true, outputPath };
        } catch (e: any) {
          return { success: false, outputPath, error: e.message };
        }
      };

      if (options.mode === 'single') {
        const baseDir = options.outputDir || path.dirname(validPaths[0]);
        this.ensureDirExists(baseDir);
        let outputPath = path.join(baseDir, `文本合并结果${ext}`);
        
        const res = await processGroup(validPaths, outputPath);
        results.push({
          sourceFiles: validPaths,
          outputPath: res.outputPath,
          success: res.success,
          error: res.error
        });
      } else {
        const baseDir = options.outputDir || this.getCommonBaseDir(validPaths) || path.dirname(validPaths[0]);
        this.ensureDirExists(baseDir);

        const groups: Record<string, string[]> = {};
        validPaths.forEach(p => {
          const dir = path.dirname(p);
          if (!groups[dir]) groups[dir] = [];
          groups[dir].push(p);
        });

        for (const dir of Object.keys(groups)) {
          const sourceFiles = groups[dir];
          const folderName = path.basename(dir);
          let outputPath = path.join(baseDir, `${folderName}_合并结果${ext}`);
          
          const res = await processGroup(sourceFiles, outputPath);
          results.push({
            sourceFiles,
            outputPath: res.outputPath,
            success: res.success,
            error: res.error
          });
        }
      }

      const allSuccess = results.every(r => r.success);
      return {
        success: allSuccess,
        results,
        error: allSuccess ? undefined : '部分文件合并失败'
      };
    } catch (error: any) {
      return { success: false, results: [], error: error?.message || String(error) };
    }
  }
}
