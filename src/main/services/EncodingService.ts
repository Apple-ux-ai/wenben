import fs from 'fs';
import path from 'path';
import iconv from 'iconv-lite';
import chardet from 'chardet';

export interface EncodingDetectionResult {
  filePath: string;
  encoding: string;
  confidence: number;
  alternatives: { encoding: string; confidence: number }[];
  hasBOM: boolean;
  success: boolean;
  error?: string;
}

export interface EncodingConvertResult {
  filePath: string;
  outputPath: string;
  success: boolean;
  sourceEncoding: string;
  targetEncoding: string;
  error?: string;
}

// 编码映射表，对接 UI 显示名称和实际处理逻辑
export const ENCODING_MAP: Record<string, string> = {
  'UTF8_无BOM': 'utf-8',
  'UTF8_有BOM': 'utf-8-bom',
  'UTF16_大端': 'utf-16be',
  'UTF16_小端': 'utf-16le',
  'UTF32_大端': 'utf-32be',
  'UTF32_小端': 'utf-32le',
  'BIG5': 'big5',
  'GBK': 'gbk',
  'GB2312': 'gb2312',
  'GB18030': 'gb18030',
};

export class EncodingService {
  /**
   * 手动处理 UTF-32 转换 (iconv-lite 不支持)
   */
  private static encodeUTF32(text: string, endian: 'le' | 'be'): Buffer {
    const codePoints = Array.from(text).map(c => c.codePointAt(0) || 0);
    const buffer = Buffer.alloc(codePoints.length * 4);
    for (let i = 0; i < codePoints.length; i++) {
      if (endian === 'le') {
        buffer.writeUInt32LE(codePoints[i], i * 4);
      } else {
        buffer.writeUInt32BE(codePoints[i], i * 4);
      }
    }
    return buffer;
  }

  private static decodeUTF32(buffer: Buffer, endian: 'le' | 'be'): string {
    const codePoints: number[] = [];
    try {
      for (let i = 0; i < buffer.length; i += 4) {
        if (i + 4 <= buffer.length) {
          const cp = endian === 'le' ? buffer.readUInt32LE(i) : buffer.readUInt32BE(i);
          codePoints.push(cp);
        }
      }
      return String.fromCodePoint(...codePoints);
    } catch (e) {
      console.error('UTF32 decode error:', e);
      return buffer.toString('utf-8'); // 回退到 utf-8
    }
  }

  /**
   * 统一编码函数，支持 BOM 和 UTF-32
   */
  private static encode(content: string, targetEncoding: string): Buffer {
    try {
      if (targetEncoding === 'UTF8_有BOM') {
        const utf8Buffer = iconv.encode(content, 'utf-8');
        return Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), utf8Buffer]);
      }
      if (targetEncoding === 'UTF8_无BOM') {
        return iconv.encode(content, 'utf-8');
      }
      if (targetEncoding === 'UTF32_小端') {
        return this.encodeUTF32(content, 'le');
      }
      if (targetEncoding === 'UTF32_大端') {
        return this.encodeUTF32(content, 'be');
      }
      
      // 其他编码使用 iconv-lite
      const iconvEncoding = ENCODING_MAP[targetEncoding] || targetEncoding;
      return iconv.encode(content, iconvEncoding);
    } catch (e) {
      console.error('Encode error:', e);
      return Buffer.from(content, 'utf-8');
    }
  }

  /**
   * 统一解码函数
   */
  private static decode(buffer: Buffer, sourceEncoding: string): string {
    try {
      if (sourceEncoding === 'UTF32_小端') {
        return this.decodeUTF32(buffer, 'le');
      }
      if (sourceEncoding === 'UTF32_大端') {
        return this.decodeUTF32(buffer, 'be');
      }
      if (sourceEncoding === 'UTF8_有BOM' || sourceEncoding === 'UTF8_无BOM') {
        // 自动移除 BOM 如果存在
        return iconv.decode(buffer, 'utf-8');
      }

      const iconvEncoding = ENCODING_MAP[sourceEncoding] || sourceEncoding;
      return iconv.decode(buffer, iconvEncoding);
    } catch (e) {
      console.error('Decode error:', e);
      return buffer.toString('utf-8');
    }
  }

  /**
   * 批量检测文件编码
   */
  static async detectBatch(filePaths: string[]): Promise<EncodingDetectionResult[]> {
    if (!Array.isArray(filePaths)) return [];
    const results: EncodingDetectionResult[] = [];
    for (const filePath of filePaths) {
      if (!filePath) continue;
      results.push(await this.detectSingle(filePath));
    }
    return results;
  }

  /**
   * 检测单个文件编码
   */
  static async detectSingle(filePath: string): Promise<EncodingDetectionResult> {
    let fd: number | null = null;
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }
      if (!fs.statSync(filePath).isFile()) {
        throw new Error(`不是有效的文件: ${filePath}`);
      }

      fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(4096);
      const bytesRead = fs.readSync(fd, buffer, 0, 4096, 0);
      
      const data = buffer.slice(0, bytesRead);
      
      // 1. 检测 BOM
      if (data.length >= 4) {
        if (data[0] === 0xFF && data[1] === 0xFE && data[2] === 0x00 && data[3] === 0x00) {
          return { filePath, encoding: 'UTF32_小端', confidence: 1, alternatives: [], hasBOM: true, success: true };
        } else if (data[0] === 0x00 && data[1] === 0x00 && data[2] === 0xFE && data[3] === 0xFF) {
          return { filePath, encoding: 'UTF32_大端', confidence: 1, alternatives: [], hasBOM: true, success: true };
        }
      }
      
      if (data.length >= 2) {
        if (data[0] === 0xFF && data[1] === 0xFE) {
          return { filePath, encoding: 'UTF16_小端', confidence: 1, alternatives: [], hasBOM: true, success: true };
        } else if (data[0] === 0xFE && data[1] === 0xFF) {
          return { filePath, encoding: 'UTF16_大端', confidence: 1, alternatives: [], hasBOM: true, success: true };
        } else if (data.length >= 3 && data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
          return { filePath, encoding: 'UTF8_有BOM', confidence: 1, alternatives: [], hasBOM: true, success: true };
        }
      }

      // 2. 使用 chardet 分析
      const analysis = chardet.analyse(data);
      
      if (!analysis || analysis.length === 0) {
        return {
          filePath,
          encoding: 'UTF8_无BOM',
          confidence: 0,
          alternatives: [],
          hasBOM: false,
          success: false,
          error: '无法识别编码'
        };
      }

      const results = analysis.map((item: any) => {
        let name: string = item.name;
        // 映射到 UI 友好的名称
        if (name === 'UTF-8') name = 'UTF8_无BOM';
        else if (name === 'UTF-16LE') name = 'UTF16_小端';
        else if (name === 'UTF-16BE') name = 'UTF16_大端';
        else if (['windows-1252', 'iso-8859-1', 'iso-8859-2'].includes(name.toLowerCase())) name = 'GBK';
        else if (name.toUpperCase() === 'BIG5') name = 'BIG5';
        else if (name.toUpperCase() === 'GB18030') name = 'GB18030';
        
        return { encoding: name, confidence: item.confidence / 100 };
      });

      return {
        filePath,
        encoding: results[0].encoding,
        confidence: results[0].confidence,
        alternatives: results.slice(1),
        hasBOM: false,
        success: true
      };
    } catch (err: any) {
      console.error(`Detect error for ${filePath}:`, err);
      return {
        filePath,
        encoding: 'UTF8_无BOM',
        confidence: 0,
        alternatives: [],
        hasBOM: false,
        success: false,
        error: err?.message || String(err)
      };
    } finally {
      if (fd !== null) {
        try {
          fs.closeSync(fd);
        } catch (e) {
          console.error('Error closing file descriptor:', e);
        }
      }
    }
  }

  static async convertBatch(
    files: { path: string; sourceEncoding?: string; outputPath?: string }[], 
    targetEncoding: string, 
    outputDir?: string,
    maintainDirStructure?: boolean
  ): Promise<EncodingConvertResult[]> {
    const results: EncodingConvertResult[] = [];
    const filePaths = files.map(f => f.path);
    
    // 如果需要保持目录结构且指定了输出目录
    let commonBase = '';
    if (maintainDirStructure && outputDir && filePaths.length > 0) {
      if (filePaths.length === 1) {
        commonBase = path.dirname(filePaths[0]);
      } else {
        // 计算所有文件的公共基准目录
        const splitPaths = filePaths.map(p => p.split(path.sep));
        const firstPath = splitPaths[0];
        let commonLength = 0;
        
        // 找出所有路径共有的最长部分
        for (let i = 0; i < firstPath.length; i++) {
          const part = firstPath[i];
          if (splitPaths.every(p => p[i] === part)) {
            commonLength++;
          } else {
            break;
          }
        }
        
        commonBase = firstPath.slice(0, commonLength).join(path.sep);
        
        // 检查 commonBase 是否是一个有效的文件目录
        if (commonBase && fs.existsSync(commonBase) && !fs.statSync(commonBase).isDirectory()) {
          commonBase = path.dirname(commonBase);
        }
      }
    }

    for (const fileInfo of files) {
      const result = await this.convertSingle(
        fileInfo.path, 
        targetEncoding, 
        outputDir, 
        fileInfo.sourceEncoding,
        commonBase,
        fileInfo.outputPath // 传入预定义的输出路径
      );
      results.push(result);
    }
    return results;
  }

  private static async convertSingle(
    filePath: string, 
    targetEncoding: string, 
    outputDir?: string,
    sourceEncoding?: string,
    commonBase?: string,
    customOutputPath?: string // 新增自定义输出路径参数
  ): Promise<EncodingConvertResult> {
    return new Promise(async (resolve) => {
      let actualSourceEncoding = sourceEncoding || 'unknown';
      let outputPath = customOutputPath || filePath; // 如果有自定义路径则使用，否则使用原路径（覆盖）
      try {
        if (!sourceEncoding) {
          const detection = await this.detectSingle(filePath);
          actualSourceEncoding = detection.encoding;
        }

        const buffer = fs.readFileSync(filePath);

        // 如果没有提供 customOutputPath，则根据 outputDir 计算
        if (!customOutputPath && outputDir) {
          if (commonBase) {
            // 保持原目录结构
            const relativePath = path.relative(commonBase, filePath);
            outputPath = path.join(outputDir, relativePath);
          } else {
            // 平铺输出到目标目录
            const fileName = path.basename(filePath);
            outputPath = path.join(outputDir, fileName);
          }
        }

        // 确保输出目录存在
        const finalOutputDir = path.dirname(outputPath);
        if (!fs.existsSync(finalOutputDir)) {
          fs.mkdirSync(finalOutputDir, { recursive: true });
        }

        const content = this.decode(buffer, actualSourceEncoding);
        const outputBuffer = this.encode(content, targetEncoding);

        fs.writeFileSync(outputPath, outputBuffer);

        resolve({
          filePath,
          outputPath,
          success: true,
          sourceEncoding: actualSourceEncoding,
          targetEncoding
        });
      } catch (err: any) {
        resolve({
          filePath,
          outputPath,
          success: false,
          sourceEncoding: actualSourceEncoding,
          targetEncoding,
          error: err?.message || String(err)
        });
      }
    });
  }
}
