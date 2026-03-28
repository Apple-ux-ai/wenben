import React, { useState, useEffect, useRef } from 'react';
import { 
  InboxOutlined, 
  FileTextOutlined, 
  DeleteOutlined, 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  CheckCircleOutlined, 
  FolderOpenOutlined, 
  ArrowLeftOutlined,
  ReloadOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { 
  Card, 
  Steps, 
  Button, 
  Upload, 
  Table, 
  Tag, 
  Space, 
  Progress, 
  Statistic, 
  Radio, 
  Input, 
  message, 
  Result,
  Typography,
  Divider,
  Tooltip,
  Modal,
  Checkbox
} from 'antd';
import { useAuth } from '../../../context/AuthContext';
import { useT } from '../../../i18n';

const { Dragger } = Upload;
const { Text, Paragraph } = Typography;

interface FileItem {
  uid: string;
  name: string;
  path: string;
  relDir?: string;
  outputPath?: string;
  size: number;
  status: 'pending' | 'processing' | 'success' | 'error' | 'paused';
  originalLines?: number;
  removedLines?: number;
  errorMessage?: string;
}

export const DuplicateRemover: React.FC = () => {
  const { requireAuth } = useAuth();
  const t = useT();
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [outputMode, setOutputMode] = useState<'overwrite' | 'new_folder'>('overwrite');
  const [outputDir, setOutputDir] = useState<string>('');
  const [keepDirStruct, setKeepDirStruct] = useState<boolean>(false);
  
  // Folder import state
  const [isFolderModalVisible, setIsFolderModalVisible] = useState(false);
  const [folderFiles, setFolderFiles] = useState<any[]>([]);
  const [selectedFileKeys, setSelectedFileKeys] = useState<React.Key[]>([]);
  const [scanning, setScanning] = useState(false);
  const [showAllFiles, setShowAllFiles] = useState(false);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalRemovedLines, setTotalRemovedLines] = useState(0);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Refs for control
  const shouldPauseRef = useRef(false);
  const isProcessingRef = useRef(false);

  // Reset state
  const resetState = () => {
    setFileList([]);
    setIsProcessing(false);
    setIsFinished(false);
    setIsPaused(false);
    setProcessedCount(0);
    setTotalRemovedLines(0);
    shouldPauseRef.current = false;
    isProcessingRef.current = false;
  };

  const allowedExtensions = ['txt', 'html', 'json', 'xml', 'csv'];

  const handleFileAdd = (file: any) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !allowedExtensions.includes(ext)) {
      message.warning(t('仅支持 .txt, .html, .json, .xml, .csv 格式的纯文本文件'));
      return false;
    }

    const isDuplicate = fileList.some(f => f.path === file.path);
    if (isDuplicate) {
      message.warning(t('文件 {{name}} 已存在列表', { name: file.name }));
      return false;
    }
    
    setFileList(prev => [...prev, {
      uid: file.uid,
      name: file.name,
      path: (file as any).path,
      size: file.size,
      status: 'pending'
    }]);
    return false;
  };

  const handleRemoveFile = (uid: string) => {
    setFileList(prev => prev.filter(f => f.uid !== uid));
    setSelectedRowKeys(prev => prev.filter(key => key !== uid));
  };

  const handleBatchRemove = () => {
    if (selectedRowKeys.length === 0) return;
    setFileList(prev => prev.filter(f => !selectedRowKeys.includes(f.uid)));
    setSelectedRowKeys([]);
    message.success(t('已删除 {{count}} 个文件', { count: selectedRowKeys.length }));
  };

  const handleClearList = () => {
    setFileList([]);
    setSelectedRowKeys([]);
    setProcessedCount(0);
    setTotalRemovedLines(0);
  };

  const handleSelectOutputDir = async () => {
    try {
      // @ts-ignore
      const path = await window.electron.selectDirectory();
      if (path) {
        setOutputDir(path);
      } 
    } catch (err) {
      message.error(t('选择文件夹失败'));
    }
  };

  const handleImportFolder = async () => {
    let folderPath = '';
    try {
      // @ts-ignore
      folderPath = await window.electron.selectDirectory();
      if (!folderPath) return;

      setIsFolderModalVisible(true);
      setScanning(true);
      setFolderFiles([]);
      
      console.log('Scanning folder:', folderPath);
      // @ts-ignore
      const files = await window.electron.getDirectoryFiles(folderPath);
      console.log('Found files:', files?.length || 0);
      
      if (!files || !Array.isArray(files)) {
        throw new Error(t('获取文件列表失败：返回数据格式不正确'));
      }

      const allowedExtensions = ['txt', 'html', 'json', 'xml', 'csv'];

      const processedFiles = files.map((f: any) => {
        const ext = f.name.split('.').pop()?.toLowerCase() || '';
        return {
          name: f.name || '',
          path: f.path || '',
          relDir: f.relDir || '',
          size: f.size || 0,
          key: f.path || Math.random().toString(36).substring(7),
          isAllowed: allowedExtensions.includes(ext)
        };
      });

      setFolderFiles(processedFiles);
      setSelectedFileKeys(processedFiles.filter((f: any) => f.isAllowed).map((f: any) => f.path));
      setScanning(false);
    } catch (err: any) {
      console.error('Import folder error detail:', err);
      message.error(t('导入文件夹失败: {{msg}}', { msg: err.message || t('未知错误') }));
      setScanning(false);
      // Don't close modal immediately so user can see what's happening if needed
      // setIsFolderModalVisible(false);
    }
  };

  const filteredFolderFiles = showAllFiles 
    ? folderFiles 
    : folderFiles.filter(f => f.isLikelyText);

  const confirmFolderImport = () => {
    const selectedFiles = folderFiles.filter(f => selectedFileKeys.includes(f.path));
    const newFiles = selectedFiles.map(f => ({
      uid: Math.random().toString(36).substring(2, 9),
      name: f.name,
      path: f.path,
      relDir: f.relDir,
      size: f.size,
      status: 'pending' as const
    }));

    setFileList(prev => {
      const existingPaths = new Set(prev.map(f => f.path));
      const uniqueNewFiles = newFiles.filter(f => !existingPaths.has(f.path));
      return [...prev, ...uniqueNewFiles];
    });

    setIsFolderModalVisible(false);
    setFolderFiles([]);
    setSelectedFileKeys([]);
    message.success(t('已导入 {{count}} 个文件', { count: newFiles.length }));
  };

  const startProcessing = async () => {
    requireAuth(async () => {
      if (fileList.length === 0) return;
      if (outputMode === 'new_folder' && !outputDir) {
        message.error(t('请选择输出目录'));
        return;
      }

      setIsProcessing(true);
      setIsFinished(false);
      setIsPaused(false);
      shouldPauseRef.current = false;
      isProcessingRef.current = true;

      processQueue();
    });
  };

  const processQueue = async () => {
    const pendingFiles = fileList.filter(f => f.status === 'pending' || f.status === 'paused');
    
    for (const file of pendingFiles) {
      if (!isProcessingRef.current) break;
      
      // Check pause
      if (shouldPauseRef.current) {
        setIsPaused(true);
        setIsProcessing(false);
        return;
      }

      // Update status to processing
      setFileList(prev => prev.map(f => f.uid === file.uid ? { ...f, status: 'processing' } : f));

      try {
        // Determine output path
        let targetPath = file.path;
        if (outputMode === 'new_folder') {
            const fileName = file.name;
            const cleanOutputDir = outputDir.replace(/[\\/]+$/, '');
            const separator = outputDir.includes('/') ? '/' : '\\';
            
            if (keepDirStruct && file.relDir) {
                const fullOutputDir = `${cleanOutputDir}${separator}${file.relDir}`;
                // @ts-ignore
                await window.electron.ensureDir(fullOutputDir);
                targetPath = `${fullOutputDir}${separator}${fileName}`;
            } else {
                targetPath = `${cleanOutputDir}${separator}${fileName}`;
            }
        }

        // Call backend to process (handles encoding and writing)
        // @ts-ignore
        const result = await window.electron.removeDuplicateLines(file.path, outputMode === 'new_folder' ? targetPath : undefined);

        // Update success status
        setFileList(prev => prev.map(f => f.uid === file.uid ? { 
          ...f, 
          status: 'success',
          outputPath: targetPath,
          originalLines: result.originalLines,
          removedLines: result.removedLines
        } : f));
        
        setProcessedCount(prev => prev + 1);
        setTotalRemovedLines(prev => prev + result.removedLines);

      } catch (error: any) {
        console.error(error);
        setFileList(prev => prev.map(f => f.uid === file.uid ? { 
          ...f, 
          status: 'error',
          errorMessage: error.message 
        } : f));
        setProcessedCount(prev => prev + 1);
      }

      // Small delay for UI update visibility
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    if (isProcessingRef.current && !shouldPauseRef.current) {
        finishProcessing();
    }
  };

  const finishProcessing = () => {
    setIsProcessing(false);
    isProcessingRef.current = false;
    setIsFinished(true);
  };

  const togglePause = () => {
    if (isPaused) {
        // Resume
        shouldPauseRef.current = false;
        setIsPaused(false);
        setIsProcessing(true);
        isProcessingRef.current = true;
        processQueue();
    } else {
        // Pause
        shouldPauseRef.current = true;
    }
  };

  const getPercent = () => {
    if (fileList.length === 0) return 0;
    return Math.round((processedCount / fileList.length) * 100);
  };

  const handleOpenOutputDir = () => {
    // 1. 优先打开手动设置的输出目录
    if (outputMode === 'new_folder' && outputDir) {
      // @ts-ignore
      window.electron.openDirectory(outputDir);
      return;
    }
    // 2. 尝试打开第一个成功处理的文件所在的目录
    const successFile = fileList.find(f => f.status === 'success' && f.outputPath);
    if (successFile && successFile.outputPath) {
      const path = successFile.outputPath;
      const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
      const dir = path.substring(0, lastSlash);
      // @ts-ignore
      window.electron.openDirectory(dir);
      return;
    }
    // 3. 尝试打开第一个待处理文件所在的目录
    if (fileList.length > 0) {
      const firstFile = fileList[0].path;
      const lastSlash = Math.max(firstFile.lastIndexOf('/'), firstFile.lastIndexOf('\\'));
      const dir = firstFile.substring(0, lastSlash);
      // @ts-ignore
      window.electron.openDirectory(dir);
      return;
    }
    message.warning(t('暂无可以打开的目录'));
  };

  // --- Renders ---

  const renderStep1 = () => (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Dragger
          multiple
          showUploadList={false}
          beforeUpload={handleFileAdd}
          style={{ padding: '20px', background: '#fafafa' }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: '#1890ff', fontSize: 32 }} />
          </p>
          <p className="ant-upload-text">{t('点击此处添加文件')}</p>
          <p className="ant-upload-hint">{t('支持批量上传')}</p>
        </Dragger>

        <Card
          hoverable
          onClick={handleImportFolder}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            alignItems: 'center', 
            background: '#fafafa',
            border: '1px dashed #d9d9d9',
            cursor: 'pointer'
          }}
          styles={{ body: { padding: '20px' } }}
        >
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }}>
              <FolderOpenOutlined />
            </p>
            <p style={{ fontSize: 16, color: 'rgba(0, 0, 0, 0.85)', fontWeight: 500, margin: 0 }}>{t('导入整个文件夹')}</p>
            <p style={{ fontSize: 14, color: 'rgba(0, 0, 0, 0.45)', margin: 0 }}>{t('自动识别文本文件')}</p>
          </div>
        </Card>
      </div>

      <Card title={t('输出设置')} size="small" style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Radio.Group value={outputMode} onChange={e => setOutputMode(e.target.value)}>
                  <Radio value="overwrite">{t('覆盖原文件')}</Radio>
                  <Radio value="new_folder">{t('保存到指定目录')}</Radio>
              </Radio.Group>
              {outputMode === 'new_folder' && (
                <Checkbox 
                  checked={keepDirStruct} 
                  onChange={e => setKeepDirStruct(e.target.checked)}
                >
                  {t('保持目录结构')}
                </Checkbox>
              )}
            </div>
            {outputMode === 'new_folder' && (
                <div style={{ display: 'flex', gap: 8 }}>
                    <Input value={outputDir} readOnly placeholder={t('请选择输出目录')} />
                    <Button icon={<FolderOpenOutlined />} onClick={handleSelectOutputDir}>{t('浏览')}</Button>
                </div>
            )}
        </Space>
      </Card>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Text strong>{t('待处理文件列表 ({{count}})', { count: fileList.length })}</Text>
          {processedCount > 0 && (
            <Tag color="blue">{t('已处理: {{count}}', { count: processedCount })}</Tag>
          )}
        </Space>
        <Space>
          <Button 
            danger 
            size="small" 
            icon={<DeleteOutlined />} 
            disabled={selectedRowKeys.length === 0}
            onClick={handleBatchRemove}
          >
            {t('批量删除')}
          </Button>
          <Button 
            size="small" 
            icon={<ReloadOutlined />} 
            onClick={handleClearList}
            disabled={fileList.length === 0}
          >
            {t('清空列表')}
          </Button>
        </Space>
      </div>

      <Table
        dataSource={fileList}
        rowKey="uid"
        size="small"
        pagination={{ pageSize: 10 }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        onRow={(record) => ({
          onClick: () => {
            const key = record.uid;
            const newKeys = [...selectedRowKeys];
            const index = newKeys.indexOf(key);
            if (index >= 0) {
              newKeys.splice(index, 1);
            } else {
              newKeys.push(key);
            }
            setSelectedRowKeys(newKeys);
          },
          style: { cursor: 'pointer' }
        })}
        columns={[
          { 
            title: t('状态'), 
            dataIndex: 'status', 
            width: 100,
            render: (status, record) => {
              if (status === 'success') return <Tag color="success">{t('完成')}</Tag>;
              if (status === 'error') return (
                <Tooltip title={record.errorMessage}>
                  <Tag color="error">{t('失败')}</Tag>
                </Tooltip>
              );
              if (status === 'processing') return <Tag color="processing">{t('处理中')}</Tag>;
              return <Tag color="default">{t('等待中')}</Tag>;
            }
          },
          { title: t('文件名'), dataIndex: 'name', width: 200, ellipsis: true },
          { title: t('路径'), dataIndex: 'path', ellipsis: true },
          { 
            title: t('结果'), 
            width: 120,
            render: (_, r) => r.status === 'success' ? (
              <Text type="success">
                {t('移除 {{count}} 行', { count: r.removedLines })}
              </Text>
            ) : '-'
          },
          { 
            title: t('大小'), 
            dataIndex: 'size', 
            width: 100, 
            render: (v) => `${(v/1024).toFixed(1)} KB` 
          },
          { 
            title: t('操作'), 
            width: 60, 
            render: (_, r) => (
              <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />} 
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFile(r.uid);
                }} 
              />
            ) 
          }
        ]}
      />
      
      {processedCount > 0 && getOutputDirPath() && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Button 
            icon={<FolderOpenOutlined />} 
            onClick={() => {
              // @ts-ignore
              window.electron.openDirectory(getOutputDirPath());
            }}
          >
            {t('打开结果目录')}
          </Button>
        </div>
      )}

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <Button 
            type="primary" 
            size="large" 
            icon={<PlayCircleOutlined />} 
            onClick={startProcessing}
            disabled={fileList.length === 0}
        >
            {t('开始处理')}
        </Button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div style={{ marginTop: 40, textAlign: 'center' }}>
      <Progress type="circle" percent={getPercent()} size={160} />
      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center', gap: 40 }}>
        <Statistic title={t('总文件数')} value={fileList.length} />
        <Statistic title={t('已处理')} value={processedCount} />
        <Statistic title={t('已移除重复行')} value={totalRemovedLines} valueStyle={{ color: '#3f8600' }} />
      </div>

      <div style={{ marginTop: 40 }}>
        <Button 
            size="large" 
            icon={isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />} 
            onClick={togglePause}
            style={{ minWidth: 120 }}
        >
            {isPaused ? t('继续') : t('暂停')}
        </Button>
      </div>

      <div style={{ marginTop: 24, textAlign: 'left' }}>
        <Text strong>{t('处理日志：')}</Text>
        <div style={{ 
            height: 200, 
            overflowY: 'auto', 
            background: '#f5f5f5', 
            padding: 12, 
            marginTop: 8, 
            borderRadius: 4,
            fontSize: 12,
            fontFamily: 'monospace'
        }}>
            {fileList.filter(f => f.status !== 'pending').map(f => (
                <div key={f.uid} style={{ marginBottom: 4 }}>
                    <Tag color={f.status === 'success' ? 'success' : f.status === 'error' ? 'error' : 'processing'}>
                        {f.status === 'success' ? t('完成') : f.status === 'error' ? t('失败') : t('处理中')}
                    </Tag>
                    {f.name} 
                    {f.status === 'success' && ` - ${t('移除 {{count}} 行', { count: f.removedLines })}`}
                    {f.status === 'error' && ` - ${f.errorMessage}`}
                </div>
            ))}
        </div>
      </div>
    </div>
  );

  const getOutputDirPath = () => {
    if (outputMode === 'new_folder') return outputDir;
    if (fileList.length > 0) {
      const firstFilePath = fileList[0].path;
      const lastSlash = Math.max(firstFilePath.lastIndexOf('/'), firstFilePath.lastIndexOf('\\'));
      return lastSlash !== -1 ? firstFilePath.substring(0, lastSlash) : '';
    }
    return '';
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: 'calc(100vh - 160px)', 
      overflow: 'hidden', 
      gap: '8px', 
      padding: '0 24px 8px 24px',
      boxSizing: 'border-box'
    }}>
      <style>
        {`
          .ant-upload-wrapper, .ant-upload-select, .ant-upload-drag {
            height: 100% !important;
          }
          .ant-upload-drag-container {
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            height: 100% !important;
          }
          .ant-card-body {
            display: flex;
            flex-direction: column;
          }
        `}
      </style>

      {/* 1. 文件列表区域 - 占据剩余空间 */}
      <Card 
        size="small" 
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Space>
              <Text strong>{t('待处理文件列表')}</Text>
              {fileList.length > 0 && (
                <Tag color="blue" style={{ borderRadius: '10px' }}>
                  {t('{{count}} 个文件', { count: fileList.length })}
                </Tag>
              )}
            </Space>
            {fileList.length > 0 && !isProcessing && (
              <Space>
                <Button 
                  type="text" 
                  danger 
                  size="small" 
                  icon={<DeleteOutlined />} 
                  disabled={selectedRowKeys.length === 0}
                  onClick={handleBatchRemove}
                >
                  {t('批量移除')}
                </Button>
                <Divider type="vertical" />
                <Button 
                  type="text" 
                  size="small" 
                  icon={<ReloadOutlined />} 
                  onClick={handleClearList}
                >
                  {t('清空列表')}
                </Button>
              </Space>
            )}
          </div>
        }
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          background: '#fff'
        }}
        styles={{ 
          body: { 
            flex: 1, 
            padding: '12px', 
            display: 'flex', 
            flexDirection: 'column',
            overflow: 'hidden',
            height: '100%'
          } 
        }}
      >
        {fileList.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Dragger
              multiple
              showUploadList={false}
              beforeUpload={handleFileAdd}
              disabled={isProcessing}
            >
              <div className="ant-upload-drag-container">
                <p className="ant-upload-drag-icon">
                  <InboxOutlined style={{ color: '#1890ff', fontSize: '48px' }} />
                </p>
                <p className="ant-upload-text" style={{ fontSize: '18px', fontWeight: 500 }}>
                  {t('点击添加文件 或 拖拽到此区域')}
                </p>
                <p className="ant-upload-hint" style={{ fontSize: '13px', color: 'rgba(0,0,0,0.45)' }}>
                  {t('仅支持 .txt, .html, .json, .xml, .csv 格式的纯文本文件')}
                </p>
                <div style={{ marginTop: '24px' }}>
                  <Button 
                    type="primary" 
                    icon={<FolderOpenOutlined />} 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleImportFolder();
                    }}
                    size="large"
                    style={{ borderRadius: '8px', height: '44px', padding: '0 32px' }}
                  >
                    {t('导入文件夹')}
                  </Button>
                </div>
              </div>
            </Dragger>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Table
              dataSource={fileList}
              rowKey="uid"
              size="small"
              pagination={false}
              scroll={{ y: 'calc(100% - 40px)' }}
              rowSelection={isProcessing ? undefined : {
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys),
              }}
              style={{ flex: 1 }}
              columns={[
                { 
                  title: t('状态'), 
                  dataIndex: 'status', 
                  width: 90,
                  render: (status, record) => {
                    if (status === 'success') return <Tag color="success">{t('完成')}</Tag>;
                    if (status === 'error') return (
                      <Tooltip title={record.errorMessage}>
                        <Tag color="error">{t('失败')}</Tag>
                      </Tooltip>
                    );
                    if (status === 'processing') return <Tag color="processing">{t('处理中')}</Tag>;
                    return <Tag color="default">{t('等待中')}</Tag>;
                  }
                },
                { 
                  title: t('文件名'), 
                  dataIndex: 'name', 
                  ellipsis: true,
                  render: (text) => <Space><FileTextOutlined style={{ color: '#1890ff' }} />{text}</Space>
                },
                { title: t('路径'), dataIndex: 'path', ellipsis: true, width: '30%' },
                { 
                  title: t('移除行数'), 
                  width: 100,
                  align: 'right',
                  render: (_, r) => r.status === 'success' ? (
                    <Text type="success" strong>{r.removedLines}</Text>
                  ) : '-'
                },
                { 
                  title: t('大小'), 
                  dataIndex: 'size', 
                  width: 90, 
                  align: 'right',
                  render: (v) => `${(v/1024).toFixed(1)} KB` 
                },
                { 
                  title: t('操作'), 
                  width: 50, 
                  align: 'center',
                  render: (_, r) => (
                    <Button 
                      type="text" 
                      danger 
                      size="small"
                      icon={<DeleteOutlined />} 
                      disabled={isProcessing}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(r.uid);
                      }} 
                    />
                  ) 
                }
              ]}
            />
            {isProcessing && (
              <div style={{ padding: '12px 16px', background: '#f0f7ff', borderTop: '1px solid #e6f4ff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <Text style={{ fontSize: 12 }}>
                    {t('正在处理: {{name}}', {
                      name: fileList.find(f => f.status === 'processing')?.name || t('准备中...'),
                    })}
                  </Text>
                  <Text style={{ fontSize: 12 }}>{getPercent()}%</Text>
                </div>
                <Progress percent={getPercent()} size="small" status="active" showInfo={false} />
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 2. 输出设置区域 - 固定高度 */}
      <Card 
        size="small" 
        title={<Text strong>{t('输出设置')}</Text>}
        style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <div style={{ marginBottom: '8px' }}><Text type="secondary" style={{ fontSize: 12 }}>{t('保存模式')}</Text></div>
            <Radio.Group 
              value={outputMode} 
              onChange={e => setOutputMode(e.target.value)}
              disabled={isProcessing}
            >
              <Radio value="overwrite">{t('覆盖原文件')}</Radio>
              <Radio value="new_folder">{t('保存到指定目录')}</Radio>
            </Radio.Group>
            {outputMode === 'new_folder' && (
              <div style={{ marginTop: '8px' }}>
                <Checkbox 
                  checked={keepDirStruct} 
                  onChange={e => setKeepDirStruct(e.target.checked)}
                  disabled={isProcessing}
                >
                  {t('保持目录结构')}
                </Checkbox>
              </div>
            )}
          </div>
          
          {outputMode === 'new_folder' && (
            <div>
              <div style={{ marginBottom: '8px' }}><Text type="secondary" style={{ fontSize: 12 }}>{t('输出目录')}</Text></div>
              <Space.Compact style={{ width: '100%' }}>
                <Input 
                  value={outputDir} 
                  placeholder={t('请选择输出目录')} 
                  readOnly 
                  onClick={handleSelectOutputDir}
                  style={{ cursor: 'pointer' }}
                />
                <Button icon={<FolderOpenOutlined />} onClick={handleSelectOutputDir} disabled={isProcessing}>
                  {t('浏览')}
                </Button>
              </Space.Compact>
            </div>
          )}
        </div>
      </Card>

      {/* 3. 操作按钮区域 */}
      <div style={{ 
        padding: '8px 0', 
        display: 'flex', 
        justifyContent: 'center',
        alignItems: 'center',
        gap: '16px',
        background: 'transparent'
      }}>
        {!isProcessing ? (
          <Button 
            type="primary" 
            size="large" 
            icon={<PlayCircleOutlined />} 
            onClick={startProcessing}
            disabled={fileList.length === 0}
            style={{ 
              width: 200,
              height: '48px', 
              borderRadius: '24px',
              fontSize: '16px',
              fontWeight: 500,
              boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)'
            }}
          >
            {t('开始处理')}
          </Button>
        ) : (
          <Button 
            type="primary"
            danger
            size="large" 
            icon={isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />} 
            onClick={togglePause}
            style={{ 
              width: 200,
              height: '48px', 
              borderRadius: '24px',
              fontSize: '16px',
              fontWeight: 500,
              boxShadow: '0 4px 12px rgba(255, 77, 79, 0.3)'
            }}
          >
            {isPaused ? t('继续处理') : t('暂停处理')}
          </Button>
        )}
        <Button 
          size="large"
          icon={<FolderOpenOutlined />} 
          onClick={handleOpenOutputDir}
          disabled={fileList.length === 0 && !outputDir}
          style={{ 
            height: 48, 
            borderRadius: 24, 
            padding: '0 24px',
            fontSize: 16
          }}
        >
          {t('打开结果目录')}
        </Button>
        {!isProcessing && fileList.length > 0 && (
          <Button 
            size="large"
            onClick={resetState}
            style={{ 
              height: 48, 
              borderRadius: 24, 
              padding: '0 24px',
              fontSize: 16
            }}
          >
            {t('清空')}
          </Button>
        )}
      </div>

      {/* 结果弹窗 */}
      <Modal
        open={isFinished}
        onCancel={() => resetState()}
        footer={null}
        centered
        width={560}
        styles={{ body: { padding: '32px 24px' } }}
        closable={false}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            background: '#f6ffed', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            margin: '0 auto 16px',
            color: '#52c41a',
            fontSize: '32px'
          }}>
            <CheckCircleOutlined />
          </div>
          <Typography.Title level={3} style={{ marginBottom: 8 }}>{t('处理完成')}</Typography.Title>
          <Paragraph type="secondary" style={{ fontSize: '15px', marginBottom: 24 }}>
            {t('成功清理了 {{count}} 个文件中的重复行', { count: fileList.length })}
            <br />
            {t('累计移除重复行：')}<Text strong type="danger" style={{ fontSize: '18px' }}>{totalRemovedLines}</Text> {t('行')}
          </Paragraph>
          
          <div style={{ 
            background: '#f8f9fa', 
            padding: '16px', 
            borderRadius: '8px', 
            textAlign: 'left',
            marginBottom: '24px',
            border: '1px solid #f0f0f0'
          }}>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>{t('保存位置：')}</Text>
            </div>
            <Text code style={{ fontSize: '13px', wordBreak: 'break-all', display: 'block', padding: '8px', background: '#fff' }}>
              {getOutputDirPath()}
            </Text>
          </div>

          <Space size={16}>
            <Button 
              type="primary" 
              size="large" 
              icon={<FolderOpenOutlined />} 
              onClick={() => {
                // @ts-ignore
                window.electron.openDirectory(getOutputDirPath());
              }}
              style={{ borderRadius: '8px', height: '44px', padding: '0 24px' }}
            >
              {t('打开输出目录')}
            </Button>
            <Button 
              size="large" 
              onClick={() => resetState()}
              style={{ borderRadius: '8px', height: '44px', padding: '0 24px' }}
            >
              {t('关闭窗口')}
            </Button>
          </Space>
        </div>
      </Modal>

      {/* 文件夹导入弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 32 }}>
            <span>{t('选择要导入的文件')}</span>
            <Checkbox 
              checked={showAllFiles} 
              onChange={e => setShowAllFiles(e.target.checked)}
              style={{ fontWeight: 'normal', fontSize: 14 }}
            >
              {t('显示所有格式 (包含非文本文件)')}
            </Checkbox>
          </div>
        }
        open={isFolderModalVisible}
        onOk={confirmFolderImport}
        onCancel={() => setIsFolderModalVisible(false)}
        width={800}
        okText={t('导入已选 ({{count}})', { count: selectedFileKeys.length })}
        cancelText={t('取消')}
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">
            {showAllFiles
              ? t('共发现 {{count}} 个文件', { count: folderFiles.length })
              : t('共发现 {{total}} 个文件，已自动过滤出 {{text}} 个文本文件', { total: folderFiles.length, text: filteredFolderFiles.length })}
          </Text>
        </div>
        <Table
          loading={scanning}
          dataSource={filteredFolderFiles}
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys: selectedFileKeys,
            onChange: (keys) => setSelectedFileKeys(keys),
          }}
          onRow={(record) => ({
            onClick: () => {
              const key = record.path;
              const newKeys = [...selectedFileKeys];
              const index = newKeys.indexOf(key);
              if (index >= 0) {
                newKeys.splice(index, 1);
              } else {
                newKeys.push(key);
              }
              setSelectedFileKeys(newKeys);
            },
            style: { cursor: 'pointer' }
          })}
          columns={[
            { title: t('文件名'), dataIndex: 'name', width: 250, ellipsis: true },
            { 
              title: t('类型'), 
              dataIndex: 'isLikelyText', 
              width: 80, 
              render: (v) => v ? <Tag color="blue">{t('文本')}</Tag> : <Tag>{t('其他')}</Tag> 
            },
            { title: t('路径'), dataIndex: 'path', ellipsis: true },
            { title: t('大小'), dataIndex: 'size', width: 100, render: (v) => `${(v/1024).toFixed(1)} KB` },
          ]}
          pagination={{ pageSize: 10, size: 'small' }}
          scroll={{ y: 400 }}
          size="small"
        />
      </Modal>
    </div>
  );
};
