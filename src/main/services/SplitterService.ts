import fs from 'fs';
import path from 'path';
import readline from 'readline';
import iconv from 'iconv-lite';
import chardet from 'chardet';

export interface SplitOptions {
  mode: 'lines' | 'count';
  value: number; // lines per file or file count
  outputDir?: string;
  conflictAction?: 'overwrite' | 'rename';
}

export class SplitterService {
  /**
   * Check if split files already exist for the given file and options
   */
  public static async checkSplitConflict(
    filePath: string, 
    options: { mode: 'lines' | 'count'; value: number; outputDir?: string }
  ): Promise<{ hasConflict: boolean; targetDir: string }> {
    const fileInfo = path.parse(filePath);
    const targetDir = options.outputDir || path.join(path.dirname(filePath), `${fileInfo.name}_split`);
    
    if (fs.existsSync(targetDir)) {
      const files = fs.readdirSync(targetDir);
      // 只有当文件名、模式、数值完全一致时，才判定为冲突
      // 使用新的命名规则: 文件名_mode[lines/count]_[数值]_[编号]
      const pattern = `^${this.escapeRegExp(fileInfo.name)}_mode${options.mode}_${options.value}_\\d+${this.escapeRegExp(fileInfo.ext)}$`;
      const conflictRegex = new RegExp(pattern, 'i');
      const hasConflict = files.some(f => conflictRegex.test(f));
      return { hasConflict, targetDir };
    }
    
    return { hasConflict: false, targetDir };
  }

  /**
   * Helper to escape string for RegExp
   */
  private static escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Detect file encoding
   */
  private static async detectEncoding(filePath: string): Promise<string> {
    try {
      const buffer = Buffer.alloc(4096);
      const fd = await fs.promises.open(filePath, 'r');
      await fd.read(buffer, 0, 4096, 0);
      await fd.close();
      
      // 1. 手动检查 BOM
      if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        return 'utf-8';
      } else if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
        return 'utf-16le';
      } else if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
        return 'utf-16be';
      }
      
      // 2. 使用 chardet 检测
      const detected = chardet.detect(buffer);
      let encoding = (detected || 'utf-8').toLowerCase();

      // 3. 针对纯英文/ASCII 的优化：
      // 纯英文经常被误认为 ISO-8859-1、windows-1252、ASCII 等单字节编码
      // 这些在字节层面与 UTF-8 完全兼容，因此统一按 UTF-8 处理最安全
      if (
        encoding === 'iso-8859-1' ||
        encoding === 'windows-1252' ||
        encoding === 'ascii'
      ) {
        return 'utf-8';
      }

      // 4. 防止无 BOM 的文件被误判为 UTF-16
      // 如果没有检测到 UTF-16 的 BOM，但 chardet 返回了 utf-16le / utf-16be，
      // 极大概率是误判（尤其是纯英文内容），此时强制按 UTF-8 处理
      if (
        (encoding === 'utf-16le' || encoding === 'utf-16be')
      ) {
        return 'utf-8';
      }

      return iconv.encodingExists(encoding) ? encoding : 'utf-8';
    } catch (error) {
      console.error('Encoding detection failed:', error);
      return 'utf-8';
    }
  }

  /**
   * Count total lines in a file (binary, encoding-agnostic)
   */
  private static async countLines(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      let count = 0;
      let leftover = Buffer.alloc(0);

      const stream = fs.createReadStream(filePath);

      stream.on('data', (chunk: Buffer) => {
        const buf = Buffer.concat([leftover, chunk]);
        let start = 0;

        for (let i = 0; i < buf.length; i++) {
          if (buf[i] === 0x0a) {
            count++;
            start = i + 1;
          }
        }

        leftover = buf.slice(start);
      });

      stream.on('end', () => {
        if (leftover.length > 0) {
          count++;
        }
        resolve(count);
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Split file
   */
  public static async splitFile(filePath: string, options: SplitOptions): Promise<{ success: boolean; files: string[]; error?: string }> {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, files: [], error: 'File not found' };
      }

      const fileInfo = path.parse(filePath);
      let outputDir = options.outputDir || path.join(path.dirname(filePath), `${fileInfo.name}_split`);
      
      // Ensure output directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Handle conflicts: clear for overwrite or find copy suffix for rename
      let copySuffix = '';
      const files = fs.readdirSync(outputDir);
      const basePattern = `${this.escapeRegExp(fileInfo.name)}_mode${options.mode}_${options.value}_\\d+`;
      const conflictRegex = new RegExp(`^${basePattern}${this.escapeRegExp(fileInfo.ext)}$`, 'i');

      if (options.conflictAction === 'rename') {
        if (files.some(f => conflictRegex.test(f))) {
          // Find the next available copy number
          let copyNum = 1;
          while (files.some(f => new RegExp(`^${basePattern}\\(副本${copyNum}\\)${this.escapeRegExp(fileInfo.ext)}$`, 'i').test(f))) {
            copyNum++;
          }
          copySuffix = `(副本${copyNum})`;
        }
      } else if (options.conflictAction === 'overwrite') {
        // Clear existing split files to avoid leftovers
        files.forEach(f => {
          if (conflictRegex.test(f)) {
            try { fs.unlinkSync(path.join(outputDir, f)); } catch (e) {}
          }
        });
      }

      let linesPerFile: number;
      let totalLines = 0;
      let totalFiles = 0;

      if (options.mode === 'count') {
        totalLines = await this.countLines(filePath);
        if (totalLines === 0) {
          return { success: false, files: [], error: 'Empty file' };
        }
        totalFiles = options.value;
        linesPerFile = Math.ceil(totalLines / totalFiles);
      } else {
        totalLines = await this.countLines(filePath);
        linesPerFile = options.value;
        totalFiles = Math.ceil(totalLines / linesPerFile);
      }

      if (linesPerFile < 1) linesPerFile = 1;

      // Determine padding for index (e.g., 01, 001)
      const indexPadding = Math.max(2, totalFiles.toString().length);

      return new Promise((resolve, reject) => {
        const createdFiles: string[] = [];
        let currentFileIndex = 1;
        let currentLineCount = 0;
        let currentBuffers: Buffer[] = [];

        const saveCurrentChunk = () => {
          if (currentBuffers.length > 0) {
            // 格式: 文件名_mode[lines/count]_[数值]_[编号](副本N).扩展名
            const paddedIndex = currentFileIndex.toString().padStart(indexPadding, '0');
            const newFileName = `${fileInfo.name}_mode${options.mode}_${options.value}_${paddedIndex}${copySuffix}${fileInfo.ext}`;
            const newFilePath = path.join(outputDir, newFileName);
            
            try {
              const contentBuffer = Buffer.concat(currentBuffers);
              fs.writeFileSync(newFilePath, contentBuffer);
              createdFiles.push(newFilePath);
              currentFileIndex++;
              currentBuffers = [];
              currentLineCount = 0;
            } catch (err: any) {
              reject(new Error(`Failed to save chunk ${currentFileIndex}: ${err.message}`));
            }
          }
        };

        const handleLine = (lineBuf: Buffer) => {
          currentBuffers.push(lineBuf);
          currentLineCount++;

          if (currentLineCount >= linesPerFile) {
            saveCurrentChunk();
          }
        };

        let leftover = Buffer.alloc(0);
        const stream = fs.createReadStream(filePath);

        stream.on('data', (chunk: Buffer) => {
          const buf = Buffer.concat([leftover, chunk]);
          let start = 0;

          for (let i = 0; i < buf.length; i++) {
            if (buf[i] === 0x0a) {
              const lineBuf = buf.slice(start, i + 1);
              handleLine(lineBuf);
              start = i + 1;
            }
          }

          leftover = buf.slice(start);
        });

        stream.on('end', () => {
          try {
            if (leftover.length > 0) {
              handleLine(leftover);
            }
            saveCurrentChunk(); // Save remaining lines
            resolve({ success: true, files: createdFiles });
          } catch (err: any) {
            reject({ success: false, files: createdFiles, error: err.message });
          }
        });

        stream.on('error', (err) => {
          reject({ success: false, files: createdFiles, error: err.message });
        });
      });

    } catch (error: any) {
      return { success: false, files: [], error: error.message };
    }
  }
}
