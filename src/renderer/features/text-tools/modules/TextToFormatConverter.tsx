import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, Button, Radio, Upload, message, Table, Tag, Space, Input, 
  Tooltip, InputNumber, Popconfirm, Typography, Modal, Checkbox, Divider, Alert
} from 'antd';
import {
  InboxOutlined,
  FileTextOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  QuestionCircleOutlined,
  ClearOutlined,
  EyeOutlined,
  SettingOutlined,
  FolderAddOutlined,
  FileAddOutlined,
  RetweetOutlined
} from '@ant-design/icons';
import { useAuth } from '../../../context/AuthContext';
import { useT } from '../../../i18n';
import { UnifiedToolContainer } from '../components/UnifiedToolContainer';

const { Title, Text, Paragraph } = Typography;

interface FileItem {
  uid: string;
  name: string;
  path: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  relDir?: string; // 相对目录结构
  error?: string;
}

function encodeBMP(imgData: ImageData, ppi: number): Uint8Array {
  const width = imgData.width;
  const height = imgData.height;
  const data = imgData.data;

  // BMP 行对齐：每行字节数必须是 4 的倍数
  const rowBytes = width * 3;
  const padding = (4 - (rowBytes % 4)) % 4;
  const stride = rowBytes + padding; 
  
  const fileSize = 54 + stride * height;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // Bitmap File Header
  view.setUint8(0, 0x42); // 'B'
  view.setUint8(1, 0x4D); // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true);
  view.setUint32(10, 54, true); // Pixel data offset

  // Bitmap Info Header
  view.setUint32(14, 40, true); // Header size
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true); // Planes
  view.setUint16(28, 24, true); // 24-bit RGB
  view.setUint32(30, 0, true); // Compression (BI_RGB)
  view.setUint32(34, 0, true); // Image size (can be 0 for BI_RGB)
  
  const ppm = Math.round(ppi * 39.3701);
  view.setInt32(38, ppm, true); // X pixels per meter
  view.setInt32(42, ppm, true); // Y pixels per meter
  view.setUint32(46, 0, true); // Colors used
  view.setUint32(50, 0, true); // Important colors

  // Pixel Data
  const pixelDataStart = 54;
  
  for (let y = 0; y < height; y++) {
    // BMP 存储通常是自底向上
    const rowIdx = height - 1 - y;
    let offset = pixelDataStart + rowIdx * stride;
    
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4; // Canvas data is top-down RGBA
      
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // BMP uses BGR format
      view.setUint8(offset, b);
      view.setUint8(offset + 1, g);
      view.setUint8(offset + 2, r);
      offset += 3;
    }
    // Padding bytes are automatically 0 because ArrayBuffer is initialized to 0
  }

  return new Uint8Array(buffer);
}

export const TextToFormatConverter: React.FC = () => {
  const t = useT();
  const { requireAuth } = useAuth();
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [conversionType, setConversionType] = useState<'common' | 'image'>('common');
  const [targetFormat, setTargetFormat] = useState<'docx' | 'pdf' | 'xlsx' | 'html' | 'jpg' | 'png' | 'bmp'>('docx');
  const [imagePPI, setImagePPI] = useState<number>(300);
  const [outputDir, setOutputDir] = useState<string>('');
  const [keepDirStruct, setKeepDirStruct] = useState(false);
  const [processing, setProcessing] = useState(false);
  const actionRef = useRef<HTMLButtonElement>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Folder import state
  const [isFolderModalVisible, setIsFolderModalVisible] = useState(false);
  const [folderFiles, setFolderFiles] = useState<any[]>([]);
  const [selectedFileKeys, setSelectedFileKeys] = useState<React.Key[]>([]);
  const [scanning, setScanning] = useState(false);
  const [showAllFiles, setShowAllFiles] = useState(false);

  // Update target format when type changes
  useEffect(() => {
    if (conversionType === 'common') {
      if (['jpg', 'png', 'bmp'].includes(targetFormat)) {
        setTargetFormat('docx');
      }
    } else {
      if (!['jpg', 'png', 'bmp'].includes(targetFormat)) {
        setTargetFormat('jpg');
      }
    }
  }, [conversionType]);

  const allowedExtensions = ['txt', 'html', 'json', 'xml', 'csv'];

  const handleFileAdd = (file: any) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !allowedExtensions.includes(ext)) {
      message.warning(t('仅支持 .txt, .html, .json, .xml, .csv 格式的纯文本文件'));
      return false;
    }

    const isDuplicate = fileList.some(f => f.path === (file as any).path);
    if (isDuplicate) {
      message.warning(t('文件 {{name}} 已存在列表', { name: file.name }));
      return false;
    }
    
    setFileList(prev => [...prev, {
      uid: file.uid || Math.random().toString(36).substr(2, 9),
      name: file.name,
      path: (file as any).path,
      status: 'pending' as const
    }]);
    return false;
  };

  const handleBatchDelete = () => {
    setFileList(prev => prev.filter(f => !selectedRowKeys.includes(f.uid)));
    setSelectedRowKeys([]);
    message.success(t('已批量删除选中的文件'));
  };

  const handleClearAll = () => {
    setFileList([]);
    setSelectedRowKeys([]);
    message.success(t('已清空列表'));
  };

  const handleSelectOutputDir = async () => {
    if (!window.electron) return;
    const path = await window.electron.selectDirectory();
    if (path) {
      setOutputDir(path);
    }
  };

  const handleImportFolder = async () => {
    if (!window.electron) return;
    try {
      const folderPath = await window.electron.selectDirectory();
      if (!folderPath) return;

      setIsFolderModalVisible(true);
      setScanning(true);
      
      const files = await window.electron.getDirectoryFiles(folderPath);

      const processedFiles: any[] = files.map((f: any) => {
        const ext = f.name.split('.').pop()?.toLowerCase() || '';
        const isAllowed = allowedExtensions.includes(ext);
        return {
          name: f.name,
          path: f.path,
          size: f.size,
          key: f.path,
          isAllowed,
          relDir: f.relDir
        };
      });

      setFolderFiles(processedFiles);
      // Default select only allowed files
      setSelectedFileKeys(processedFiles.filter((f: any) => f.isAllowed).map((f: any) => f.path));
      setScanning(false);
    } catch (err) {
      console.error('Import folder error:', err);
      message.error(t('导入文件夹失败'));
      setScanning(false);
    }
  };

  const confirmFolderImport = () => {
    const selectedFiles = folderFiles.filter(f => selectedFileKeys.includes(f.key));
    const newItems: FileItem[] = [];
    
    selectedFiles.forEach(file => {
      const isDuplicate = fileList.some(f => f.path === file.path);
      if (!isDuplicate && allowedExtensions.includes(file.name.split('.').pop()?.toLowerCase() || '')) {
        newItems.push({
          uid: Math.random().toString(36).substr(2, 9),
          name: file.name,
          path: file.path,
          status: 'pending',
          relDir: file.relDir
        });
      }
    });

    if (newItems.length > 0) {
      setFileList(prev => [...prev, ...newItems]);
      message.success(t('成功导入 {{count}} 个文件', { count: newItems.length }));
    } else if (selectedFiles.length > 0) {
      message.info(t('所选文件已在列表中或格式不支持'));
    }
    
    setIsFolderModalVisible(false);
    setFolderFiles([]);
    setSelectedFileKeys([]);
  };

  const filteredFolderFiles = showAllFiles 
    ? folderFiles 
    : folderFiles.filter(f => f.isAllowed);

  const processFile = async (file: FileItem) => {
    if (!window.electron) return;
    
    try {
      const content = await window.electron.readFile(file.path);
      const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
      
      let outputData: string | Uint8Array | null = null;
      let extension = targetFormat;

      if (targetFormat === 'docx') {
        outputData = await window.electron.convertToDocx(content); 
      } else if (targetFormat === 'xlsx') {
        outputData = await window.electron.convertToXlsx(content);
      } else if (targetFormat === 'html') {
        outputData = `<html><body><pre>${content}</pre></body></html>`;
      } else if (['jpg', 'png', 'bmp', 'pdf'].includes(targetFormat)) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context not available');

        // A4 width at 300 PPI is 2480 pixels. 
        // Let's use PPI setting. 
        // A4 width is 210mm = 8.27 inches.
        const width = Math.round(8.27 * imagePPI); 
        const padding = Math.round(width * 0.05); // 5% padding
        const fontSize = Math.round(12 * (imagePPI / 96)); // Scale font size
        const lineHeight = Math.round(fontSize * 1.5);
        
        ctx.font = `${fontSize}px "Microsoft YaHei", sans-serif`;
        
        const lines = content.split(/\r?\n/);
        const wrappedLines: string[] = [];
        
        const contentWidth = width - padding * 2;
        
        lines.forEach(line => {
          if (line.trim() === '') {
            wrappedLines.push('');
            return;
          }
          
          let currentLine = '';
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const testLine = currentLine + char;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > contentWidth) {
              wrappedLines.push(currentLine);
              currentLine = char;
            } else {
              currentLine = testLine;
            }
          }
          wrappedLines.push(currentLine);
        });

        const height = wrappedLines.length * lineHeight + padding * 2;
        canvas.width = width;
        canvas.height = height;
        
        // Re-get context after resize (safeguard)
        const ctx2 = canvas.getContext('2d');
        if (!ctx2) throw new Error('Canvas context lost');
        
        ctx2.fillStyle = '#ffffff';
        ctx2.fillRect(0, 0, width, height);
        ctx2.fillStyle = '#000000';
        ctx2.font = `${fontSize}px "Microsoft YaHei", sans-serif`;
        ctx2.textBaseline = 'top';
        
        wrappedLines.forEach((line, index) => {
          ctx2.fillText(line, padding, padding + index * lineHeight);
        });
        
        if (targetFormat === 'bmp') {
          const imageData = ctx2.getImageData(0, 0, width, height);
          outputData = encodeBMP(imageData, imagePPI);
        } else {
          const mime = targetFormat === 'jpg' ? 'image/jpeg' : 'image/png';
          const quality = targetFormat === 'jpg' ? 0.9 : undefined;
          const dataUrl = canvas.toDataURL(mime, quality as any);
          const base64Data = dataUrl.replace(/^data:image\/(?:png|jpeg);base64,/, "");
          const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
          
          if (targetFormat === 'pdf') {
            outputData = await window.electron.convertImageToPdf(imageBytes);
          } else {
            outputData = imageBytes;
          }
        }
      }

      if (outputData) {
        let finalOutputDir = outputDir;
        if (keepDirStruct && file.relDir) {
          finalOutputDir = `${outputDir}\\${file.relDir}`;
          // 确保子目录存在
          if (window.electron.ensureDir) {
            await window.electron.ensureDir(finalOutputDir);
          }
        }
        
        const outputPath = `${finalOutputDir}\\${fileNameWithoutExt}.${extension}`;
        if (typeof outputData === 'string') {
           await window.electron.writeFile(outputPath, outputData);
        } else {
           await window.electron.writeBinaryFile(outputPath, outputData);
        }
        setFileList(prev => prev.map(f => f.uid === file.uid ? { ...f, status: 'success' } : f));
      } else {
        throw new Error("Conversion failed");
      }

    } catch (err: any) {
      console.error(err);
      setFileList(prev => prev.map(f => f.uid === file.uid ? { ...f, status: 'error', error: err.message } : f));
    }
  };

  const handleOpenOutputDir = () => {
    // 1. 优先打开手动设置的输出目录
    if (outputDir) {
      // @ts-ignore
      window.electron.openDirectory(outputDir);
      return;
    }
    // 2. 尝试打开第一个待处理文件所在的目录
    if (fileList.length > 0) {
      const firstFile = fileList[0].path;
      const lastSlash = Math.max(firstFile.lastIndexOf('/'), firstFile.lastIndexOf('\\'));
      if (lastSlash !== -1) {
        const dir = firstFile.substring(0, lastSlash);
        // @ts-ignore
        window.electron.openDirectory(dir);
        return;
      }
    }
    message.warning(t('暂无可以打开的目录'));
  };

  const handleStart = async () => {
    requireAuth(async () => {
      if (fileList.length === 0) {
        message.warning(t('请先添加文本文件'));
        return;
      }
    if (!outputDir) {
      message.warning(t('请选择输出目录'));
      return;
    }
    setProcessing(true);
    
    // 重置所有文件状态，以便可以重复处理
    setFileList(prev => prev.map(f => ({ ...f, status: 'pending', error: undefined })));
    
    // 获取当前文件列表的副本进行处理
    const currentFiles = [...fileList];
    
    for (const file of currentFiles) {
        setFileList(prev => prev.map(f => f.uid === file.uid ? { ...f, status: 'processing' } : f));
        await processFile(file);
    }
    
    setProcessing(false);
    message.success(t('处理完成'));
    
    // 滚动到操作按钮位置
    setTimeout(() => {
      actionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
    });
  };

  const columns = [
    {
      title: t('文件名'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <><FileTextOutlined style={{ marginRight: 8, color: '#1890ff' }} />{text}</>
    },
    {
      title: t('路径'),
      dataIndex: 'path',
      key: 'path',
      ellipsis: true,
      render: (text: string) => <Text type="secondary" style={{ fontSize: '12px' }}>{text}</Text>
    },
    {
      title: t('状态'),
      key: 'status',
      width: 120,
      render: (_: any, record: FileItem) => {
        const statusMap = {
          pending: <Tag>{t('等待中')}</Tag>,
          processing: <Tag color="processing">{t('处理中')}</Tag>,
          success: <Tag color="success">{t('成功')}</Tag>,
          error: <Tag color="error">{t('失败')}</Tag>
        };
        return statusMap[record.status] || <Tag>{record.status}</Tag>;
      }
    },
    {
      title: t('操作'),
      key: 'action',
      width: 80,
      render: (_: any, record: FileItem) => (
        <Button 
          type="text" 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => setFileList(prev => prev.filter(f => f.uid !== record.uid))}
        />
      )
    }
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 32px 24px' }}>
      <UnifiedToolContainer
        fileList={fileList}
        selectedFileKeys={selectedRowKeys}
        onSelectionChange={(keys) => setSelectedRowKeys(keys)}
        onFilesAdd={(files) => {
          files.forEach(file => handleFileAdd(file));
        }}
        onFileRemove={(uid) => {
          setFileList(prev => prev.filter(f => f.uid !== uid));
          setSelectedRowKeys(prev => prev.filter(key => key !== uid));
        }}
        onFilesRemoveBatch={handleBatchDelete}
        onFilesClear={handleClearAll}
        uploadHint={t('仅支持 .txt, .html, .json, .xml, .csv 格式的纯文本文件')}
        accept=".txt,.html,.json,.xml,.csv"
        extraHeaderActions={
          <Space>
            <Upload
              name="file"
              multiple
              showUploadList={false}
              accept=".txt,.html,.json,.xml,.csv"
              beforeUpload={(_: any, fileList: any[]) => {
                fileList.forEach(file => handleFileAdd(file));
                return false;
              }}
              directory={false}
            >
              <Button icon={<FileAddOutlined />}>{t('添加文件')}</Button>
            </Upload>
            <Button icon={<FolderAddOutlined />} onClick={handleImportFolder}>{t('导入文件夹')}</Button>
          </Space>
        }
        columns={columns}
        settingsContent={
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
            <div>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <SettingOutlined style={{ color: '#1890ff' }} />
                <Typography.Text strong>{t('转换格式设置')}</Typography.Text>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Text type="secondary" style={{ width: '80px' }}>{t('格式类型:')}</Text>
                  <Radio.Group 
                    value={conversionType} 
                    onChange={e => setConversionType(e.target.value)}
                    optionType="button"
                    buttonStyle="solid"
                    size="small"
                  >
                    <Radio.Button value="common">{t('常用格式')}</Radio.Button>
                    <Radio.Button value="image">{t('转换为图片')}</Radio.Button>
                  </Radio.Group>
                </div>

                {conversionType === 'common' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Text type="secondary" style={{ width: '80px' }}>{t('目标格式:')}</Text>
                    <Radio.Group 
                      value={targetFormat} 
                      onChange={e => setTargetFormat(e.target.value)}
                      optionType="button"
                      size="small"
                    >
                      <Radio.Button value="docx">docx</Radio.Button>
                      <Radio.Button value="pdf">pdf</Radio.Button>
                      <Radio.Button value="xlsx">xlsx</Radio.Button>
                      <Radio.Button value="html">html</Radio.Button>
                    </Radio.Group>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Text type="secondary" style={{ width: '80px' }}>{t('图片质量:')}</Text>
                    <Space>
                      <Text style={{ fontSize: 12 }}>PPI:</Text>
                      <Radio.Group 
                        value={imagePPI} 
                        onChange={e => setImagePPI(e.target.value)}
                        size="small"
                      >
                        <Radio value={96}>96</Radio>
                        <Radio value={150}>150</Radio>
                        <Radio value={300}>300</Radio>
                      </Radio.Group>
                    </Space>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <DownloadOutlined style={{ color: '#1890ff' }} />
                <Typography.Text strong>{t('输出保存设置')}</Typography.Text>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Text type="secondary" style={{ width: '80px' }}>{t('输出目录:')}</Text>
                  <Input 
                    placeholder={t('请选择输出目录...')} 
                    value={outputDir}
                    size="small"
                    suffix={
                      <Tooltip title={t('选择目录')}>
                        <FolderOpenOutlined 
                          style={{ cursor: 'pointer', color: '#1890ff' }} 
                          onClick={handleSelectOutputDir} 
                        />
                      </Tooltip>
                    }
                    style={{ flex: 1 }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Text type="secondary" style={{ width: '80px' }}>{t('保存方式:')}</Text>
                  <Checkbox 
                    checked={keepDirStruct} 
                    onChange={e => setKeepDirStruct(e.target.checked)}
                  >
                    {t('保持目录结构')}
                  </Checkbox>
                </div>
                <Alert 
                  message={targetFormat === 'docx' ? t('按行转换为 Word 段落') : t('系统将自动优化输出排版')}
                  type="info" 
                  showIcon 
                  style={{ padding: '4px 12px', borderRadius: 8 }}
                />
              </div>
            </div>
          </div>
        }
        actionsContent={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button 
              size="large" 
              icon={<FolderOpenOutlined />}
              onClick={handleOpenOutputDir}
              disabled={fileList.length === 0 && !outputDir}
              style={{ height: 50, borderRadius: 25, padding: '0 24px' }}
            >
              {t('打开结果目录')}
            </Button>
            <Button 
              type="primary" 
              size="large" 
              icon={processing ? <SettingOutlined spin /> : <DownloadOutlined />} 
              loading={processing}
              disabled={fileList.length === 0}
              onClick={handleStart}
              ref={actionRef}
              style={{ height: 50, borderRadius: 25, padding: '0 40px', fontSize: 16, fontWeight: 600, boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)' }}
            >
              {processing ? t('正在转换...') : t('开始执行批量转换')}
            </Button>
          </div>
        }
      />

      <Modal
        title={t('导入文件夹')}
        open={isFolderModalVisible}
        onOk={confirmFolderImport}
        onCancel={() => setIsFolderModalVisible(false)}
        width={800}
        okText={t('确定导入')}
        cancelText={t('取消')}
      >
        <div style={{ marginBottom: 16 }}>
          <Space split={<Divider type="vertical" />}>
            <Checkbox 
              checked={showAllFiles} 
              onChange={e => setShowAllFiles(e.target.checked)}
            >
              {t('显示所有文件 (包括非文本文件)')}
            </Checkbox>
            <Text type="secondary">
              {t('已扫描到 {{total}} 个文件，当前显示 {{shown}} 个', { total: folderFiles.length, shown: filteredFolderFiles.length })}
            </Text>
          </Space>
        </div>
        
        <Table
          size="small"
          dataSource={filteredFolderFiles}
          rowKey="path"
          columns={[
            { title: t('文件名'), dataIndex: 'name', key: 'name' },
            { 
              title: t('类型'), 
              dataIndex: 'isLikelyText', 
              key: 'type',
              render: (isText) => isText ? <Tag color="blue">{t('文本')}</Tag> : <Tag>{t('其他')}</Tag>
            },
            { 
              title: t('大小'), 
              dataIndex: 'size', 
              key: 'size',
              render: (size) => `${(size / 1024).toFixed(2)} KB`
            },
          ]}
          rowSelection={{
            selectedRowKeys: selectedFileKeys,
            onChange: (keys) => setSelectedFileKeys(keys),
          }}
          pagination={{ pageSize: 10 }}
          loading={scanning}
          scroll={{ y: 400 }}
        />
      </Modal>
    </div>
  );
};
