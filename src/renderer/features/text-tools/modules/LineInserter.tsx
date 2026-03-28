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
  EyeOutlined,
  SwapOutlined,
  QuestionCircleOutlined,
  FileAddOutlined,
  SettingOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { 
  Card, 
  Button, 
  Upload, 
  Table, 
  Tag, 
  Space, 
  Progress, 
  Statistic, 
  Radio, 
  Input, 
  Result,
  Typography,
  Divider,
  Tooltip,
  Modal,
  Checkbox,
  Form,
  InputNumber,
  App
} from 'antd';
import { useAuth } from '../../../context/AuthContext';
import { UnifiedToolContainer } from '../components/UnifiedToolContainer';
import { useT } from '../../../i18n';

const { Dragger } = Upload;
const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface FileItem {
  uid: string;
  name: string;
  path: string;
  outputPath?: string;
  relDir?: string;
  size: number;
  status: 'pending' | 'processing' | 'success' | 'error' | 'paused';
  originalLines?: number;
  modifiedLines?: number;
  errorMessage?: string;
}

export const LineInserter: React.FC = () => {
  const { message } = App.useApp();
  const { requireAuth } = useAuth();
  const t = useT();
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [outputMode, setOutputMode] = useState<'overwrite' | 'new_folder'>('overwrite');
  const [outputDir, setOutputDir] = useState<string>('');
  const [keepDirStruct, setKeepDirStruct] = useState<boolean>(false);
  
  // Insertion options
  const [positionType, setPositionType] = useState<'start' | 'end' | 'specific' | 'interval'>('start');
  const [targetLine, setTargetLine] = useState<number>(1);
  const [intervalLines, setIntervalLines] = useState<number>(100);
  const [insertType, setInsertType] = useState<'text' | 'file'>('text');
  const [insertText, setInsertText] = useState<string>('');
  const [sourceFilePath, setSourceFilePath] = useState<string>('');

  // Folder import state
  const [isFolderModalVisible, setIsFolderModalVisible] = useState(false);
  const [folderFiles, setFolderFiles] = useState<any[]>([]);
  const [selectedFileKeys, setSelectedFileKeys] = useState<React.Key[]>([]);
  const [scanning, setScanning] = useState(false);
  const [showAllFiles, setShowAllFiles] = useState(false);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalInsertedLines, setTotalInsertedLines] = useState(0);
  const [currentInsertText, setCurrentInsertText] = useState<string>('');
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
    setTotalInsertedLines(0);
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
    setTotalInsertedLines(0);
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

  const handleSelectSourceFile = async () => {
    try {
      // @ts-ignore
      const result = await window.electron.selectFiles({
        properties: ['openFile'],
        title: t('选择要插入的文件')
      });
      if (result && result.length > 0) {
        setSourceFilePath(result[0]);
      }
    } catch (err) {
      message.error(t('选择文件失败'));
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

  const handleClearSourceFile = () => {
    setSourceFilePath('');
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
      
      let textToInsert = insertText;
      if (insertType === 'file') {
        if (!sourceFilePath) {
          message.warning(t('请选择要插入的文件'));
          return;
        }
        try {
          // @ts-ignore
          textToInsert = await window.electron.readFile(sourceFilePath);
        } catch (err) {
          message.error(t('读取待插入文件失败'));
          return;
        }
      } else if (!insertText) {
        message.warning(t('请输入要插入的内容'));
        return;
      }

      setIsProcessing(true);
      setIsPaused(false);
      setIsFinished(false);
      shouldPauseRef.current = false;
      isProcessingRef.current = true;
      setCurrentInsertText(textToInsert);

      processQueue(textToInsert);
    });
  };

  const processQueue = async (textToInsertParam?: string) => {
    const textToInsert = textToInsertParam || currentInsertText;
    const pendingFiles = fileList.filter(f => f.status === 'pending' || f.status === 'paused');
    
    for (const file of pendingFiles) {
      if (!isProcessingRef.current) break;
      
      if (shouldPauseRef.current) {
        setIsPaused(true);
        setIsProcessing(false);
        return;
      }

      setFileList(prev => prev.map(f => f.uid === file.uid ? { ...f, status: 'processing' } : f));

      try {
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

        // @ts-ignore
        const result = await window.electron.insertLines(file.path, outputMode === 'new_folder' ? targetPath : undefined, {
          positionType,
          targetLine,
          intervalLines,
          insertText: textToInsert
        });

        setFileList(prev => prev.map(f => f.uid === file.uid ? { 
          ...f, 
          status: 'success',
          outputPath: targetPath,
          originalLines: result.originalLines,
          modifiedLines: result.insertedLines // Using modifiedLines to store inserted count for consistent display
        } : f));
        
        setProcessedCount(prev => prev + 1);
        setTotalInsertedLines(prev => prev + result.insertedLines);

      } catch (error: any) {
        console.error(error);
        setFileList(prev => prev.map(f => f.uid === file.uid ? { 
          ...f, 
          status: 'error',
          errorMessage: error.message 
        } : f));
        setProcessedCount(prev => prev + 1);
      }

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
        shouldPauseRef.current = false;
        setIsPaused(false);
        setIsProcessing(true);
        isProcessingRef.current = true;
        processQueue(currentInsertText);
    } else {
        shouldPauseRef.current = true;
    }
  };

  const getPercent = () => {
    if (fileList.length === 0) return 0;
    return Math.round((processedCount / fileList.length) * 100);
  };

  return (
    <div style={{ height: '100%', padding: '0 24px 32px 24px', overflowY: 'auto' }}>
      <UnifiedToolContainer
        fileList={fileList}
        selectedFileKeys={selectedRowKeys}
        onSelectionChange={(keys) => setSelectedRowKeys(keys)}
        onFilesAdd={(files) => {
          files.forEach(file => handleFileAdd(file));
        }}
        onFileRemove={handleRemoveFile}
        onFilesRemoveBatch={handleBatchRemove}
        onFilesClear={handleClearList}
        uploadHint={t('仅支持 .txt, .html, .json, .xml, .csv 格式的纯文本文件')}
        extraHeaderActions={
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
            <Button icon={<FileTextOutlined />}>{t('添加文件')}</Button>
          </Upload>
        }
        columns={[
          {
            title: t('文件名'),
            dataIndex: 'name',
            key: 'name',
            ellipsis: true,
            render: (text: string) => <><FileTextOutlined style={{ marginRight: 8, color: '#1890ff' }} />{text}</>
          },
          {
            title: t('状态'),
            key: 'status',
            width: 100,
            render: (_: any, record: FileItem) => {
              const statusConfig = {
                pending: { color: 'default', text: t('待处理') },
                processing: { color: 'processing', text: t('处理中') },
                success: { color: 'success', text: t('已完成') },
                error: { color: 'error', text: t('错误') },
                paused: { color: 'warning', text: t('已暂停') }
              };
              const config = statusConfig[record.status as keyof typeof statusConfig] || statusConfig.pending;
              return (
                <Tooltip title={record.errorMessage}>
                  <Tag color={config.color} style={{ borderRadius: '6px', margin: 0 }}>
                    {config.text}
                  </Tag>
                </Tooltip>
              );
            }
          },
          {
            title: t('插入行数'),
            key: 'modifiedLines',
            width: 90,
            render: (_: any, record: FileItem) => (
              record.status === 'success' ? <Tag color="blue">{record.modifiedLines}</Tag> : '-'
            )
          },
          {
            title: t('操作'),
            key: 'action',
            width: 60,
            render: (_: any, record: FileItem) => (
              <Button 
                type="text" 
                danger 
                size="small"
                icon={<CloseOutlined />} 
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFile(record.uid);
                }}
                disabled={isProcessing}
              />
            )
          }
        ]}
        settingsContent={
          <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
            {/* 插入规则 */}
            <div style={{ flex: 1, minWidth: '350px' }}>
              <div style={{ marginBottom: '12px', fontWeight: 500, color: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <EditOutlined style={{ color: '#1890ff' }} /> {t('插入规则')}
              </div>
              <Form layout="horizontal" size="small" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }} labelAlign="left">
                <Form.Item label={t('插入位置')} style={{ marginBottom: '12px' }}>
                  <Radio.Group 
                    value={positionType} 
                    onChange={e => setPositionType(e.target.value)} 
                    optionType="button"
                    buttonStyle="solid"
                  >
                    <Radio.Button value="start">{t('开头')}</Radio.Button>
                    <Radio.Button value="end">{t('末尾')}</Radio.Button>
                    <Radio.Button value="specific">{t('指定行')}</Radio.Button>
                    <Radio.Button value="interval">{t('间隔')}</Radio.Button>
                  </Radio.Group>
                </Form.Item>
                
                {positionType === 'specific' && (
                  <Form.Item label={t('行号')} style={{ marginBottom: '12px' }}>
                    <InputNumber 
                      min={1} 
                      style={{ width: '100%', borderRadius: '6px' }} 
                      value={targetLine} 
                      onChange={v => setTargetLine(v || 1)} 
                      addonBefore={t('第')} 
                      addonAfter={t('行')} 
                    />
                  </Form.Item>
                )}

                {positionType === 'interval' && (
                  <Form.Item label={t('间隔')} style={{ marginBottom: '12px' }}>
                    <InputNumber 
                      min={1} 
                      style={{ width: '100%', borderRadius: '6px' }} 
                      value={intervalLines} 
                      onChange={v => setIntervalLines(v || 1)} 
                      addonBefore={t('每')} 
                      addonAfter={t('行')} 
                    />
                  </Form.Item>
                )}

                <Form.Item label={t('内容来源')} style={{ marginBottom: '8px' }}>
                  <Radio.Group value={insertType} onChange={e => setInsertType(e.target.value)}>
                    <Radio value="text">{t('输入文本')}</Radio>
                    <Radio value="file">{t('读取文件')}</Radio>
                  </Radio.Group>
                </Form.Item>

                <Form.Item label=" " colon={false} style={{ marginBottom: 0 }}>
                  {insertType === 'text' ? (
                    <TextArea 
                      rows={3} 
                      placeholder={t('请输入要插入的内容...')} 
                      value={insertText}
                      onChange={e => setInsertText(e.target.value)}
                      style={{ borderRadius: '6px', resize: 'none' }}
                    />
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Input 
                        value={sourceFilePath} 
                        readOnly 
                        placeholder={t('请选择源文件...')}
                        style={{ borderRadius: '6px', fontSize: '12px' }}
                        suffix={
                          sourceFilePath ? (
                            <DeleteOutlined 
                              style={{ color: '#ff4d4f', cursor: 'pointer' }} 
                              onClick={handleClearSourceFile} 
                            />
                          ) : (
                            <FileTextOutlined style={{ color: '#bfbfbf' }} />
                          )
                        }
                      />
                      <Button size="small" onClick={handleSelectSourceFile} style={{ borderRadius: '6px' }}>{t('选择')}</Button>
                    </div>
                  )}
                </Form.Item>
              </Form>
            </div>

            <div style={{ width: 1, background: '#f0f0f0', margin: '0 8px' }} />

            {/* 输出设置 */}
            <div style={{ flex: 1, minWidth: '300px' }}>
              <div style={{ marginBottom: '12px', fontWeight: 500, color: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SaveOutlined style={{ color: '#1890ff' }} /> {t('输出设置')}
              </div>
              <Form layout="horizontal" size="small" labelCol={{ span: 6 }} wrapperCol={{ span: 18 }} labelAlign="left">
                <Form.Item label={t('保存方式')} style={{ marginBottom: '12px' }}>
                  <Radio.Group value={outputMode} onChange={e => setOutputMode(e.target.value)} optionType="button" buttonStyle="solid">
                    <Radio.Button value="overwrite">{t('覆盖原文件')}</Radio.Button>
                    <Radio.Button value="new_folder">{t('另存为...')}</Radio.Button>
                  </Radio.Group>
                </Form.Item>

                {outputMode === 'new_folder' && (
                  <>
                    <Form.Item label={t('输出目录')} style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Input 
                          value={outputDir} 
                          readOnly 
                          placeholder={t('请选择输出目录...')}
                          style={{ borderRadius: '6px', fontSize: '12px' }}
                          suffix={
                            outputDir ? (
                              <DeleteOutlined 
                                style={{ color: '#ff4d4f', cursor: 'pointer' }} 
                                onClick={() => setOutputDir('')} 
                              />
                            ) : (
                              <FolderOpenOutlined style={{ color: '#bfbfbf' }} />
                            )
                          }
                        />
                        <Button size="small" onClick={handleSelectOutputDir} style={{ borderRadius: '6px' }}>{t('选择')}</Button>
                      </div>
                    </Form.Item>
                    <Form.Item label=" " colon={false} style={{ marginBottom: 0 }}>
                      <Checkbox 
                        checked={keepDirStruct} 
                        onChange={e => setKeepDirStruct(e.target.checked)}
                        style={{ fontSize: '13px' }}
                      >
                        {t('保持原目录结构')}
                      </Checkbox>
                    </Form.Item>
                  </>
                )}
              </Form>
            </div>
          </div>
        }
        actionsContent={
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }}>
            <Button 
              size="large"
              onClick={handleOpenOutputDir}
              disabled={fileList.length === 0 && !outputDir}
              style={{ height: 48, borderRadius: 24, padding: '0 24px', fontSize: 16 }}
            >
              {t('打开结果目录')}
            </Button>
            
            {!isProcessing ? (
              <Tooltip
                title={
                  fileList.length === 0
                    ? t('请先导入待处理的文件')
                    : outputMode === 'new_folder' && !outputDir
                      ? t('请先选择输出目录')
                      : ''
                }
              >
                <div style={{ display: 'inline-block' }}>
                  <Button 
                    type="primary" 
                    size="large" 
                    icon={<PlayCircleOutlined />}
                    onClick={startProcessing}
                    disabled={fileList.length === 0 || (outputMode === 'new_folder' && !outputDir)}
                    style={{ 
                      height: 48, 
                      borderRadius: 24, 
                      padding: '0 32px', 
                      fontSize: 16, 
                      boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
                      minWidth: 160
                    }}
                  >
                    {t('开始处理')}
                  </Button>
                </div>
              </Tooltip>
            ) : (
              <Space size="middle">
                <Button 
                  size="large" 
                  icon={isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
                  onClick={togglePause}
                  style={{ height: 48, borderRadius: 24, padding: '0 32px', minWidth: 120 }}
                >
                  {isPaused ? t('继续') : t('暂停')}
                </Button>
                <Button 
                  danger
                  size="large" 
                  icon={<ReloadOutlined />}
                  onClick={resetState}
                  style={{ height: 48, borderRadius: 24, padding: '0 32px', minWidth: 120 }}
                >
                  {t('停止')}
                </Button>
              </Space>
            )}
          </div>
        }
      />

      {/* Result Modal */}
      <Modal
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
          <div style={{ fontSize: '24px', fontWeight: 600, color: '#262626', marginBottom: 16 }}>{t('处理完成')}</div>
          <div style={{ 
            fontSize: '16px', 
            color: '#595959', 
            lineHeight: 1.8, 
            marginBottom: 32,
            padding: '16px',
            background: '#fafafa',
            borderRadius: '8px'
          }}>
            {t('已成功处理')}{' '}
            <span style={{ fontWeight: 600, color: '#1890ff' }}>{processedCount}</span>{' '}
            {t('个文件')}
            <br />
            {t('共插入')}{' '}
            <span style={{ color: '#52c41a', fontWeight: 600 }}>{totalInsertedLines}</span>{' '}
            {t('行')}
          </div>
          <Space size="middle">
            <Button 
              type="primary" 
              size="large" 
              icon={<FolderOpenOutlined />}
              onClick={() => {
                setIsFinished(false);
                handleOpenOutputDir();
              }}
              style={{ minWidth: 140, height: '44px', borderRadius: '8px' }}
            >
              {t('查看结果')}
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

      {/* Folder Import Modal */}
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
              : t('共发现 {{total}} 个文件，已自动过滤出 {{text}} 个文本文件', {
                  total: folderFiles.length,
                  text: filteredFolderFiles.length,
                })}
          </Text>
        </div>
        <Table
          loading={scanning}
          dataSource={showAllFiles ? folderFiles : folderFiles.filter(f => f.isLikelyText)}
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
            { title: t('文件名'), dataIndex: 'name', ellipsis: true },
            { 
              title: t('类型'), 
              dataIndex: 'isLikelyText', 
              width: 80, 
              render: (v) => v ? <Tag color="blue">{t('文本')}</Tag> : <Tag>{t('其他')}</Tag> 
            },
            { title: t('大小'), dataIndex: 'size', width: 100, render: (v) => `${(v/1024).toFixed(1)} KB` },
          ]}
          pagination={{ pageSize: 10, size: 'small' }}
        />
      </Modal>
    </div>
  );
};
