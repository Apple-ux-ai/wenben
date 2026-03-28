import React, { useState, useEffect, useRef } from 'react';
import { 
  InboxOutlined, 
  FileTextOutlined, 
  DeleteOutlined, 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  CheckCircleOutlined, 
  FolderOpenOutlined, 
  ReloadOutlined
} from '@ant-design/icons';
import { 
  Card, 
  Button, 
  Upload, 
  Table, 
  Tag, 
  Space, 
  Progress, 
  Radio, 
  Input, 
  Typography, 
  Divider, 
  Tooltip, 
  Modal, 
  Checkbox,
  Popconfirm,
  App
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

export const EmptyLineRemover: React.FC = () => {
  const { message } = App.useApp();
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
  const [showAllFiles, setShowAllFiles] = useState(false);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
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
    setIsPaused(false);
    setIsFinished(false);
    setProcessedCount(0);
    setTotalRemovedLines(0);
    shouldPauseRef.current = false;
    isProcessingRef.current = false;
    setSelectedRowKeys([]);
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
      message.warning(`文件 ${file.name} 已存在列表`);
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
    message.success(`已删除 ${selectedRowKeys.length} 个文件`);
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
      setFolderFiles([]);
      
      // @ts-ignore
      const files = await window.electron.getDirectoryFiles(folderPath);
      
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
    } catch (err: any) {
      console.error('Import folder error detail:', err);
      message.error(t('导入文件夹失败: {{msg}}', { msg: err.message || t('未知错误') }));
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
    message.success(`已导入 ${newFiles.length} 个文件`);
  };

  const startProcessing = async () => {
    requireAuth(async () => {
      if (fileList.length === 0) return;
      if (outputMode === 'new_folder' && !outputDir) {
        message.error(t('请选择输出目录'));
        return;
      }

      setIsProcessing(true);
      setIsPaused(false);
      setIsFinished(false);
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
        const result = await window.electron.removeEmptyLines(file.path, outputMode === 'new_folder' ? targetPath : undefined);

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
    message.success(`处理完成！累计处理 ${fileList.length} 个文件。`);
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

  // --- Renders ---

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
      <style>{`
        .ant-upload-wrapper {
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
        }
        .ant-upload {
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
        }
        .ant-upload-select-drag {
          height: 100% !important;
          flex: 1 !important;
        }
        .ant-upload.ant-upload-drag {
          height: 100% !important;
          border-radius: 8px !important;
          background: #fafafa !important;
          border: 2px dashed #d9d9d9 !important;
          transition: all 0.3s;
          display: flex !important;
          flex-direction: column !important;
        }
        .ant-upload.ant-upload-drag:hover {
          border-color: #40a9ff !important;
          background: #f0f7ff !important;
        }
        .ant-upload-btn {
          flex: 1 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 0 !important;
          height: 100% !important;
        }
        .ant-upload-drag-container {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          width: 100% !important;
          height: 100% !important;
          flex: 1 !important;
        }
        .ant-card-body {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
      `}</style>

      {/* 主要展示区域：导入框或文件列表 */}
      <Card 
        size="small" 
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
        <div style={{ 
          height: '100%', 
          width: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <Dragger
            multiple
            showUploadList={false}
            beforeUpload={handleFileAdd}
            disabled={isProcessing}
            openFileDialogOnClick={fileList.length === 0}
            style={{ 
              height: '100%',
              width: '100%'
            }}
          >
            {fileList.length === 0 ? (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                height: '100%',
                width: '100%'
              }}>
                <div style={{ 
                  width: 80, 
                  height: 80, 
                  borderRadius: '50%', 
                  background: '#fff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(24, 144, 255, 0.1)',
                  marginBottom: 20
                }}>
                  <InboxOutlined style={{ fontSize: '40px', color: '#1890ff' }} />
                </div>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <div style={{ fontSize: '20px', fontWeight: 600, color: '#262626', marginBottom: 8 }}>
                    {t('点击添加文件 或 拖拽到此区域')}
                  </div>
                  <div style={{ fontSize: '14px', color: '#8c8c8c' }}>
              {t('仅支持 .txt, .html, .json, .xml, .csv 格式的纯文本文件')}
            </div>
                </div>
                <Button 
                  type="primary" 
                  size="large"
                  icon={<FolderOpenOutlined />} 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleImportFolder();
                  }}
                  style={{ borderRadius: '6px', height: '44px', padding: '0 32px' }}
                >
                  {t('导入文件夹')}
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
                <div style={{ 
                  padding: '8px 16px', 
                  borderBottom: '1px solid #f0f0f0', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  background: '#fff'
                }}>
                  <Space>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>{t('文件列表')}</span>
                    <Tag color="blue">{fileList.length}</Tag>
                  </Space>
                  <Space>
                    {!isProcessing && (
                      <>
                        {selectedRowKeys.length > 0 && (
                          <Button 
                            type="link" 
                            danger 
                            size="small" 
                            icon={<DeleteOutlined />} 
                            onClick={handleBatchRemove}
                          >
                            {t('移除')}
                          </Button>
                        )}
                        <Button 
                          size="small" 
                          icon={<FolderOpenOutlined />} 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImportFolder();
                          }}
                        >
                          {t('继续添加')}
                        </Button>
                        <Button 
                          size="small" 
                          icon={<ReloadOutlined />} 
                          onClick={handleClearList}
                        >
                          {t('清空列表')}
                        </Button>
                      </>
                    )}
                  </Space>
                </div>
                <Table
                  dataSource={fileList}
                  rowKey="uid"
                  size="small"
                  pagination={false}
                  scroll={{ y: isProcessing ? 'calc(100vh - 450px)' : 'calc(100vh - 400px)' }}
                  rowSelection={isProcessing ? undefined : {
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys),
                  }}
                  style={{ flex: 1 }}
                  columns={[
                    { 
                      title: t('文件名'), 
                      dataIndex: 'name', 
                      ellipsis: true,
                      render: (text) => <Space><FileTextOutlined style={{ color: '#1890ff' }} />{text}</Space>
                    },
                    { 
                      title: t('路径'), 
                      dataIndex: 'path', 
                      ellipsis: true, 
                      width: '30%',
                      render: (text) => <Text type="secondary" style={{ fontSize: '12px' }}>{text}</Text>
                    },
                    { 
                      title: t('状态'), 
                      dataIndex: 'status', 
                      width: 90,
                      render: (status, record) => {
                        if (status === 'success') return <Tag color="success" style={{ borderRadius: '6px', padding: '2px 10px' }}>{t('已处理')}</Tag>;
                        if (status === 'error') return (
                          <Tooltip title={record.errorMessage}>
                            <Tag color="error" style={{ borderRadius: '6px', padding: '2px 10px' }}>{t('失败')}</Tag>
                          </Tooltip>
                        );
                        if (status === 'processing') return <Tag color="processing" style={{ borderRadius: '6px', padding: '2px 10px' }}>{t('处理中')}</Tag>;
                        return <Tag color="default" style={{ borderRadius: '6px', padding: '2px 10px' }}>{t('等待中')}</Tag>;
                      }
                    },
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
                      render: (v) => <Text type="secondary" style={{ fontSize: '12px' }}>{`${(v/1024).toFixed(1)} KB`}</Text>
                    },
                    { 
                      title: t('操作'), 
                      width: 50, 
                      align: 'center',
                      render: (_, r) => (
                        <Popconfirm
                          title={t('确定要移除此文件吗？')}
                          onConfirm={() => handleRemoveFile(r.uid)}
                          okText={t('确定')}
                          cancelText={t('取消')}
                          disabled={isProcessing}
                        >
                          <Button 
                            type="text" 
                            danger 
                            size="small"
                            icon={<DeleteOutlined />} 
                            disabled={isProcessing}
                            onClick={(e) => e.stopPropagation()} 
                          />
                        </Popconfirm>
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
          </Dragger>
        </div>
      </Card>

      {/* 底部配置区域 */}
      <Card 
        size="small" 
        style={{ 
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          background: '#fff',
          flexShrink: 0
        }}
        styles={{ body: { padding: '12px 24px' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 第一行：配置项 */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <div style={{ width: 220 }}>
              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>{t('保存模式')}</Text>
              <Radio.Group 
                value={outputMode} 
                onChange={e => setOutputMode(e.target.value)}
                disabled={isProcessing}
                optionType="button"
                buttonStyle="solid"
                style={{ width: '100%' }}
              >
                <Radio.Button value="overwrite" style={{ width: '50%', textAlign: 'center' }}>{t('覆盖原文件')}</Radio.Button>
                <Radio.Button value="new_folder" style={{ width: '50%', textAlign: 'center' }}>{t('指定目录')}</Radio.Button>
              </Radio.Group>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>{t('输出目录')}</Text>
                {outputMode === 'new_folder' && (
                  <Checkbox 
                    checked={keepDirStruct} 
                    onChange={e => setKeepDirStruct(e.target.checked)}
                    disabled={isProcessing}
                    style={{ fontSize: '12px' }}
                  >
                    {t('保持目录结构')}
                  </Checkbox>
                )}
              </div>
              <Input 
                placeholder={outputMode === 'overwrite' ? t('处理后的文件将直接替换原始文件') : t('请选择输出目录')} 
                value={outputMode === 'overwrite' ? "" : outputDir} 
                readOnly 
                disabled={outputMode === 'overwrite' || isProcessing}
                size="middle"
                style={{ width: '100%' }}
                onClick={outputMode === 'new_folder' ? handleSelectOutputDir : undefined}
                suffix={
                  outputMode === 'new_folder' && (
                    outputDir ? (
                      <DeleteOutlined 
                        style={{ cursor: isProcessing ? 'not-allowed' : 'pointer', color: '#ff4d4f' }} 
                        onClick={(e) => { 
                          if (isProcessing) return;
                          e.stopPropagation(); 
                          setOutputDir(''); 
                        }} 
                      />
                    ) : (
                      <FolderOpenOutlined 
                        style={{ cursor: isProcessing ? 'not-allowed' : 'pointer', color: '#1890ff' }} 
                        onClick={(e) => { 
                          if (isProcessing) return;
                          e.stopPropagation(); 
                          handleSelectOutputDir(); 
                        }} 
                      />
                    )
                  )
                }
              />
            </div>
          </div>

          {/* 第二行：操作按钮 */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            gap: 16, 
            borderTop: '1px solid #f0f0f0', 
            paddingTop: 16,
            marginTop: 4
          }}>
            {!isProcessing ? (
              <Button 
                type="primary" 
                size="large"
                onClick={startProcessing} 
                disabled={fileList.length === 0}
                icon={<CheckCircleOutlined />}
                style={{ 
                  width: 200, 
                  height: 48, 
                  borderRadius: 24, 
                  fontSize: 16, 
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
                onClick={togglePause}
                icon={isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
                style={{ 
                  width: 200, 
                  height: 48, 
                  borderRadius: 24, 
                  fontSize: 16, 
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
          </div>
        </div>
      </Card>

      {/* 处理结果弹窗 */}
      <Modal
        title={null}
        open={isFinished}
        footer={null}
        closable={false}
        centered
        width={520}
        styles={{ body: { padding: '40px 32px' } }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: 72, 
            height: 72, 
            borderRadius: '50%', 
            background: '#f6ffed', 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginBottom: 24,
            border: '1px solid #b7eb8f'
          }}>
            <CheckCircleOutlined style={{ fontSize: '40px', color: '#52c41a' }} />
          </div>
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#262626', marginBottom: 16 }}>{t('处理工作已完成')}</div>
          <div style={{ 
            fontSize: '16px', 
            color: '#595959', 
            lineHeight: 1.8, 
            marginBottom: 32,
            padding: '16px',
            background: '#fafafa',
            borderRadius: '8px'
          }}>
            {t('本次共处理')}{' '}
            <span style={{ fontWeight: 600, color: '#1890ff' }}>{fileList.length}</span>{' '}
            {t('个文件')}
            <br />
            {t('累计移除空白行:')}{' '}
            <span style={{ color: '#52c41a', fontWeight: 600 }}>{totalRemovedLines}</span>{' '}
            {t('行')}
          </div>
          <Space size="middle">
            <Button 
              type="primary" 
              size="large" 
              onClick={handleOpenOutputDir} 
              style={{ minWidth: 140, height: '44px', borderRadius: '8px' }}
            >
              {t('打开输出目录')}
            </Button>
            <Button 
              size="large" 
              onClick={() => setIsFinished(false)} 
              style={{ minWidth: 140, height: '44px', borderRadius: '8px' }}
            >
              {t('关闭窗口')}
            </Button>
          </Space>
        </div>
      </Modal>

      {/* 文件夹导入弹窗 - 保持原有逻辑 */}
      <Modal
        title={t('导入文件夹')}
        open={isFolderModalVisible}
        onCancel={() => setIsFolderModalVisible(false)}
        width={850}
        footer={[
          <Button key="cancel" onClick={() => setIsFolderModalVisible(false)}>
            {t('取消')}
          </Button>,
          <Button
            key="submit"
            type="primary"
            disabled={selectedFileKeys.length === 0}
            onClick={confirmFolderImport}
          >
            {t('导入已选文件 ({{count}})', { count: selectedFileKeys.length })}
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Checkbox 
            checked={showAllFiles} 
            onChange={e => setShowAllFiles(e.target.checked)}
          >
            {t('显示所有文件 (包括非文本文件)')}
          </Checkbox>
          <Text type="secondary">{t('共发现 {{count}} 个文件', { count: folderFiles.length })}</Text>
        </div>

        <Table
          dataSource={filteredFolderFiles}
          rowKey="path"
          size="small"
          pagination={{ pageSize: 10, size: 'small', showSizeChanger: false }}
          scroll={{ y: 350 }}
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys: selectedFileKeys,
            onChange: (keys) => setSelectedFileKeys(keys),
          }}
          onRow={record => {
            const isSelected = selectedFileKeys.includes(record.path as React.Key);
            return {
              onClick: () => {
                const key = record.path as React.Key;
                const newKeys = [...selectedFileKeys];
                const index = newKeys.indexOf(key);
                if (index > -1) {
                  newKeys.splice(index, 1);
                } else {
                  newKeys.push(key);
                }
                setSelectedFileKeys(newKeys);
              },
              style: {
                cursor: 'pointer',
                backgroundColor: isSelected ? '#e6f7ff' : 'transparent'
              }
            };
          }}
          columns={[
            { 
              title: t('文件名'), 
              dataIndex: 'name', 
              width: 220,
              ellipsis: true 
            },
            { 
              title: t('路径'), 
              dataIndex: 'path',
              ellipsis: true,
              render: (text) => <Text type="secondary" style={{ fontSize: '12px' }}>{text}</Text>
            },
            {
              title: t('类型'),
              dataIndex: 'isLikelyText',
              width: 80,
              render: (isText) => (
                <Tag color={isText ? 'green' : 'default'} style={{ borderRadius: '4px', margin: 0 }}>
                  {isText ? t('文本') : t('其他')}
                </Tag>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
};
