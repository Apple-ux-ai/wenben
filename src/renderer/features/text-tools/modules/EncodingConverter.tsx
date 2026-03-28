import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, Button, Select, Upload, Table, Space, Tag, Input, Typography, Tooltip, Dropdown, Popconfirm, Modal, Checkbox, Divider, App } from 'antd';
import { InboxOutlined, FileTextOutlined, FolderOpenOutlined, EditOutlined, InfoCircleOutlined, DeleteOutlined, CheckCircleOutlined, SettingOutlined } from '@ant-design/icons';
import { useAuth } from '../../../context/AuthContext';
import { UnifiedToolContainer } from '../components/UnifiedToolContainer';
import { useFileManager } from '../hooks/useFileManager';
import { BaseFileItem } from '../types/tool-common';
import { useT } from '../../../i18n';

const { Dragger } = Upload;
const { Text } = Typography;

interface FileItem extends BaseFileItem {
  status: 'pending' | 'success' | 'error' | 'detecting';
  sourceEncoding?: string;
  confidence?: number;
  alternatives?: { encoding: string; confidence: number }[];
  hasBOM?: boolean;
}

export const EncodingConverter: React.FC = () => {
  const { message } = App.useApp();
  const { requireAuth } = useAuth();
  const t = useT();
  
  // 使用统一文件管理 Hook
  const { 
    fileList, 
    setFileList, 
    selectedFileKeys, 
    setSelectedFileKeys,
    addFiles, 
    removeFile, 
    removeSelectedFiles, 
    clearAllFiles, 
    updateFile,
    isProcessing: processing,
    setIsProcessing: setProcessing
  } = useFileManager<FileItem>();

  const [globalSourceEncoding, setGlobalSourceEncoding] = useState('auto');
  const [targetEncoding, setTargetEncoding] = useState('UTF8_无BOM');
  const [outputDir, setOutputDir] = useState<string>('');
  const [maintainDirStructure, setMaintainDirStructure] = useState(true);
  const resultRef = useRef<HTMLDivElement>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [result, setResult] = useState<{ successCount: number; failCount: number } | null>(null);

  // Folder import state removed

  const encodingOptions = [
    { value: 'UTF8_无BOM', label: 'UTF8_无BOM' },
    { value: 'UTF8_有BOM', label: 'UTF8_有BOM' },
    { value: 'UTF16_大端', label: 'UTF16_大端' },
    { value: 'UTF16_小端', label: 'UTF16_小端' },
    { value: 'UTF32_大端', label: 'UTF32_大端' },
    { value: 'UTF32_小端', label: 'UTF32_小端' },
    { value: 'BIG5', label: 'BIG5' },
    { value: 'GBK', label: 'GBK' },
    { value: 'GB2312', label: 'GB2312' },
    { value: 'GB18030', label: 'GB18030' },
  ];

  const handleManualEncoding = (uid: string, encoding: string) => {
    updateFile(uid, { sourceEncoding: encoding, confidence: 1 });
  };

  useEffect(() => {
    if (isCompleted && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isCompleted]);

  const columns = [
    {
      title: t('文件名'),
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string) => <><FileTextOutlined style={{ marginRight: 10 }} />{text}</>
    },
    {
      title: t('原编码 (自动识别)'),
      key: 'sourceEncoding',
      width: 220,
      render: (_: any, record: FileItem) => {
        const items = [
          { key: 'utf-8', label: 'UTF-8' },
          { key: 'gbk', label: 'GBK' },
          { key: 'big5', label: 'Big5' },
          { key: 'utf-16le', label: 'UTF-16 LE' },
          { key: 'utf-16be', label: 'UTF-16 BE' },
          ...(record.alternatives && record.alternatives.length > 0 ? [{ type: 'divider' as const }] : []),
          ...(record.alternatives?.map(alt => ({
            key: alt.encoding,
            label: `${t('建议')}: ${alt.encoding} (${Math.round(alt.confidence * 100)}%)`
          })) || [])
        ];

        return (
          <Space size="small">
            <Tag color={record.status === 'detecting' ? 'processing' : 'blue'} style={{ borderRadius: '6px', padding: '2px 8px' }}>
              {record.status === 'detecting' ? t('检测中...') : record.sourceEncoding || t('未知')}
            </Tag>
            {record.confidence !== undefined && (
              <Tooltip title={`${t('置信度')}: ${Math.round(record.confidence * 100)}% ${record.hasBOM ? t('(含有 BOM)') : ''}`}>
                <InfoCircleOutlined style={{ color: record.confidence > 0.8 ? '#52c41a' : '#faad14', fontSize: '14px' }} />
              </Tooltip>
            )}
            <Dropdown 
              menu={{ 
                items, 
                onClick: ({ key }) => handleManualEncoding(record.uid, key) 
              }} 
              trigger={['click']}
            >
              <Button type="link" size="small" icon={<EditOutlined />} style={{ padding: '0 4px' }} />
            </Dropdown>
          </Space>
        );
      }
    },
    {
      title: t('转换后路径'),
      dataIndex: 'outputPath',
      key: 'outputPath',
      ellipsis: true,
      render: (path: string, record: FileItem) => {
        if (record.status !== 'success' || !path) return '-';
        return (
          <Button 
            type="link" 
            size="small" 
            style={{ padding: 0, fontSize: '13px' }}
            onClick={() => window.electron.openDirectory(path.substring(0, path.lastIndexOf('\\')))}
          >
            {path}
          </Button>
        );
      }
    },
    {
      title: t('状态'),
      key: 'status',
      width: 120,
      render: (_: any, record: FileItem) => (
        <Tooltip title={record.error}>
          <Tag 
            color={record.status === 'success' ? 'success' : record.status === 'error' ? 'error' : record.status === 'detecting' ? 'processing' : 'default'}
            style={{ borderRadius: '6px', padding: '2px 10px' }}
          >
            {record.status === 'success' ? t('已转换') : record.status === 'error' ? t('失败') : record.status === 'detecting' ? t('识别中') : t('待处理')}
          </Tag>
        </Tooltip>
      )
    },
    {
      title: t('操作'),
      key: 'action',
      width: 100,
      render: (_: any, record: FileItem) => (
        <Popconfirm
          title={t('确定要移除此文件吗？')}
          onConfirm={() => removeFile(record.uid)}
          okText={t('确定')}
          cancelText={t('取消')}
        >
          <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />} 
            size="middle"
            style={{ borderRadius: '6px' }}
          />
        </Popconfirm>
      )
    }
  ];

  const handleAutoDetect = useCallback(async (newFiles: FileItem[]) => {
    if (!window.electron) {
      console.warn('Electron not available');
      return;
    }
    
    const validFiles = newFiles.filter(f => !!f.path);
    if (validFiles.length === 0) return;
    
    const paths = validFiles.map(f => f.path);
    try {
      const results = await window.electron.detectEncoding(paths);
      setFileList(prev => prev.map(f => {
        const result = results.find((r: any) => r.filePath === f.path);
        if (result) {
          return {
            ...f,
            status: result.success ? 'pending' : 'error',
            sourceEncoding: result.encoding,
            confidence: result.confidence,
            alternatives: result.alternatives,
            hasBOM: result.hasBOM,
            error: result.error
          };
        }
        return f;
      }));
    } catch (error: any) {
      console.error('Detection error:', error);
      message.error(t('编码自动识别失败: {{msg}}', { msg: error?.message || t('未知错误') }));
      setFileList(prev => prev.map(f => 
        newFiles.some(nf => nf.uid === f.uid) ? { ...f, status: 'error', error: error?.message } : f
      ));
    }
  }, [setFileList]);

  const allowedExtensions = ['txt', 'html', 'json', 'xml', 'csv'];

  const handleFilesAdd = (files: any[]) => {
    const newItems: FileItem[] = [];
    const disallowedFiles: string[] = [];

    files.forEach(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (ext && allowedExtensions.includes(ext)) {
        newItems.push({
          uid: f.uid || Math.random().toString(36).substr(2, 9),
          name: f.name,
          path: f.path || (f.originFileObj && f.originFileObj.path),
          size: f.size,
          status: 'detecting' as const
        });
      } else {
        disallowedFiles.push(f.name);
      }
    });

    if (disallowedFiles.length > 0) {
      message.warning(t('以下文件格式不支持，已跳过：{{files}}', { files: disallowedFiles.join(', ') }));
    }
    
    if (newItems.length > 0) {
      addFiles(newItems);
      handleAutoDetect(newItems);
    }
  };

  const handleSelectOutputDir = async () => {
    if (!window.electron) return;
    try {
      const path = await window.electron.selectDirectory();
      if (path) {
        setOutputDir(path);
      }
    } catch (error) {
      console.error('Select directory error:', error);
    }
  };

  const handleOpenOutputDir = () => {
    if (outputDir) {
      // @ts-ignore
      window.electron.openDirectory(outputDir);
      return;
    }
    const successFile = fileList.find(f => f.status === 'success' && f.outputPath);
    if (successFile && successFile.outputPath) {
      const path = successFile.outputPath;
      const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
      const dir = path.substring(0, lastSlash);
      // @ts-ignore
      window.electron.openDirectory(dir);
      return;
    }
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

  const getUniquePath = async (basePath: string, fileName: string) => {
    const lastDotIndex = fileName.lastIndexOf('.');
    const name = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
    const ext = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
    
    let counter = 1;
    let newPath = `${basePath}\\${fileName}`;
    while (await window.electron.checkPathExists(newPath)) {
      newPath = `${basePath}\\${name}(${counter})${ext}`;
      counter++;
    }
    return newPath;
  };

  const calculateCommonBase = (filePaths: string[]) => {
    if (filePaths.length === 0) return '';
    if (filePaths.length === 1) {
      const path = filePaths[0];
      const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
      return lastSlash !== -1 ? path.substring(0, lastSlash) : '';
    }

    const splitPaths = filePaths.map(p => p.split(/[/\\]/));
    const firstPath = splitPaths[0];
    let commonLength = 0;

    for (let i = 0; i < firstPath.length; i++) {
      const part = firstPath[i];
      if (splitPaths.every(p => p[i] === part)) {
        commonLength++;
      } else {
        break;
      }
    }

    return firstPath.slice(0, commonLength).join('\\');
  };

  const handleStart = async () => {
    requireAuth(async () => {
      if (fileList.length === 0) {
        message.warning(t('请先添加文件'));
        return;
      }

    if (!window.electron) {
      message.error(t('系统组件未就绪，请在桌面应用中使用该功能'));
      return;
    }

    const validFiles = fileList.filter(f => !!f.path);
    if (validFiles.length === 0) {
      message.error(t('没有可处理的文件'));
      return;
    }

    setProcessing(true);
    setIsCompleted(false);
    setResult(null);
    try {
      setFileList(prev => prev.map(f => ({ ...f, status: 'detecting' })));

      const commonBase = maintainDirStructure && outputDir ? calculateCommonBase(validFiles.map(f => f.path)) : '';
      
      const filesWithPaths = await Promise.all(validFiles.map(async (f) => {
        let expectedOutputPath = f.path;
        if (outputDir) {
          if (commonBase) {
            const relativePath = f.path.substring(commonBase.length).replace(/^[/\\]/, '');
            expectedOutputPath = `${outputDir}\\${relativePath}`;
          } else {
            expectedOutputPath = `${outputDir}\\${f.name}`;
          }
        }
        const exists = outputDir ? await window.electron.checkPathExists(expectedOutputPath) : false;
        return { ...f, expectedOutputPath, exists };
      }));

      const conflicts = filesWithPaths.filter(f => f.exists);
      let globalAction: 'overwrite' | 'duplicate' | 'cancel' = 'overwrite';

      if (conflicts.length > 0) {
        globalAction = await new Promise<'overwrite' | 'duplicate' | 'cancel'>((resolve) => {
          const modal = Modal.confirm({
            title: t('文件已存在'),
            width: 500,
            closable: true,
            maskClosable: true,
            content: (
              <div style={{ marginTop: 16 }}>
                <p>{t('以下 {{count}} 个文件在目标目录中已存在：', { count: conflicts.length })}</p>
                <div style={{ 
                  maxHeight: '200px', 
                  overflowY: 'auto', 
                  background: '#f5f5f5', 
                  padding: '8px', 
                  borderRadius: '4px',
                  marginBottom: '16px'
                }}>
                  {conflicts.map(f => (
                    <div key={f.path} style={{ fontSize: '12px', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <FileTextOutlined style={{ marginRight: 8 }} />
                      {f.expectedOutputPath.split(/[/\\]/).pop()}
                    </div>
                  ))}
                </div>
                <p>{t('请选择处理方式：')}</p>
              </div>
            ),
            footer: (
              <div style={{ textAlign: 'right', marginTop: 16 }}>
                <Button onClick={() => { modal.destroy(); resolve('cancel'); }}>{t('取消转换')}</Button>
                <Button 
                  style={{ marginLeft: 8 }} 
                  onClick={() => { modal.destroy(); resolve('duplicate'); }}
                >
                  {t('全部新建副本')}
                </Button>
                <Button 
                  type="primary" 
                  style={{ marginLeft: 8 }} 
                  onClick={() => { modal.destroy(); resolve('overwrite'); }}
                >
                  {t('全部覆盖')}
                </Button>
              </div>
            ),
            onCancel: () => resolve('cancel')
          });
        });
      }

      if (globalAction === 'cancel') {
        setProcessing(false);
        setFileList(prev => prev.map(f => f.status === 'detecting' ? { ...f, status: 'pending' } : f));
        return;
      }

      const filesToProcess = await Promise.all(filesWithPaths.map(async (f) => {
        let finalPath = f.expectedOutputPath;
        if (f.exists && globalAction === 'duplicate') {
          const normalizedPath = f.expectedOutputPath.replace(/\//g, '\\');
          const lastSlashIndex = normalizedPath.lastIndexOf('\\');
          const basePath = normalizedPath.substring(0, lastSlashIndex);
          const fileName = normalizedPath.substring(lastSlashIndex + 1);
          
          await window.electron.ensureDir(basePath);
          finalPath = await getUniquePath(basePath, fileName);
        }

        return {
          path: f.path,
          sourceEncoding: globalSourceEncoding === 'auto' ? (f.sourceEncoding || 'UTF8_无BOM') : globalSourceEncoding,
          outputPath: finalPath
        };
      }));

      const results = await window.electron.processEncoding({
        files: filesToProcess,
        targetEncoding,
        outputDir: outputDir || undefined,
        maintainDirStructure
      });

      if (Array.isArray(results)) {
        setFileList(prev => prev.map(item => {
          const r = results.find((res: any) => res.filePath === item.path);
          if (r) {
            return {
              ...item,
              status: r.success ? 'success' : 'error',
              outputPath: r.outputPath,
              error: r.error
            };
          }
          return item;
        }));

        const successCount = results.filter((r: any) => r.success).length;
        const failCount = results.length - successCount;
        setResult({ successCount, failCount });
        setIsCompleted(true);
        
        if (successCount === results.length) {
          message.success(t('转换完成，共 {{count}} 个文件', { count: successCount }));
        } else {
          message.warning(t('转换完成，成功 {{success}} 个，失败 {{fail}} 个', { success: successCount, fail: failCount }));
        }
      }
    } catch (err: any) {
      console.error('Process error:', err);
      message.error(t('处理过程中出现错误: {{msg}}', { msg: err?.message || t('未知错误') }));
    } finally {
        setProcessing(false);
      }
    });
  };

  const handleImportFolder = async () => {
    if (!window.electron) return;
    try {
      // @ts-ignore
      const folderPath = await window.electron.selectDirectory();
      if (!folderPath) return;

      const files = await window.electron.getDirectoryFiles(folderPath);
      
      const allowedExtensions = ['txt', 'html', 'json', 'xml', 'csv'];
      const processedFiles: FileItem[] = [];
      const disallowedFiles: string[] = [];

      files.forEach((f: any) => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        if (ext && allowedExtensions.includes(ext)) {
          processedFiles.push({
            uid: Math.random().toString(36).substr(2, 9),
            name: f.name,
            path: f.path,
            size: f.size,
            status: 'detecting' as const
          });
        } else {
          disallowedFiles.push(f.name);
        }
      });

      if (disallowedFiles.length > 0) {
        message.warning(t('文件夹中以下文件格式不支持，已跳过：{{files}}', { files: disallowedFiles.join(', ') }));
      }

      if (processedFiles.length > 0) {
        addFiles(processedFiles);
        handleAutoDetect(processedFiles);
        message.success(t('已从文件夹导入 {{count}} 个文件', { count: processedFiles.length }));
      } else {
        message.warning(t('该文件夹下未找到支持的文本文件'));
      }
    } catch (err) {
      console.error('Import folder error:', err);
      message.error(t('导入文件夹失败'));
    }
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: '32px' }}>
      <UnifiedToolContainer
        fileList={fileList}
        selectedFileKeys={selectedFileKeys}
        onSelectionChange={setSelectedFileKeys}
        onFilesAdd={handleFilesAdd}
        onFileRemove={removeFile}
        onFilesRemoveBatch={removeSelectedFiles}
        onFilesClear={clearAllFiles}
        columns={columns}
        processing={processing}
        uploadHint={t('仅支持 .txt, .html, .json, .xml, .csv 格式的纯文本文件')}
        extraHeaderActions={
          <Space>
            <Upload
              name="file"
              multiple
              showUploadList={false}
              accept=".txt,.html,.json,.xml,.csv"
              beforeUpload={(_: any, fileList: any[]) => {
                handleFilesAdd(fileList);
                return false;
              }}
              directory={false}
            >
              <Button icon={<FileTextOutlined />}>{t('添加文件')}</Button>
            </Upload>
            <Button 
              icon={<FolderOpenOutlined />} 
              onClick={handleImportFolder}
              disabled={processing}
            >
              {t('导入文件夹')}
            </Button>
          </Space>
        }
        settingsContent={
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}><Space><SettingOutlined style={{ color: '#1677ff' }} />{t('转换设置')}</Space></div>
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 80, fontSize: '13px' }}>{t('目标编码：')}</span>
                  <Select
                    size="small"
                    value={targetEncoding}
                    onChange={setTargetEncoding}
                    options={encodingOptions}
                    style={{ flex: 1, maxWidth: '200px' }}
                    disabled={processing}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 80, fontSize: '13px' }}>{t('指定原编码：')}</span>
                  <Select
                    size="small"
                    value={globalSourceEncoding}
                    onChange={setGlobalSourceEncoding}
                    style={{ flex: 1, maxWidth: '200px' }}
                    disabled={processing}
                    options={[
                      { value: 'auto', label: t('自动识别 (推荐)') },
                      ...encodingOptions
                    ]}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 80, fontSize: '13px' }}>{t('目录结构：')}</span>
                  <Checkbox 
                    checked={maintainDirStructure}
                    onChange={e => setMaintainDirStructure(e.target.checked)}
                    disabled={!outputDir || processing}
                    style={{ fontSize: '13px' }}
                  >
                    {t('保持原文件夹层级')}
                  </Checkbox>
                </div>
              </Space>
            </div>

            <div style={{ width: 1, background: '#f0f0f0', alignSelf: 'stretch', margin: '4px 0' }} />

            <div style={{ flex: 1, minWidth: '300px' }}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}><Space><FolderOpenOutlined style={{ color: '#faad14' }} />{t('输出设置')}</Space></div>
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 80, fontSize: '13px' }}>{t('保存目录：')}</span>
                  <Input 
                    value={outputDir} 
                    onChange={e => setOutputDir(e.target.value)}
                    size="small" 
                    placeholder={t('默认保存在原文件所在目录')}
                    style={{ flex: 1, fontSize: '12px' }} 
                    prefix={<FolderOpenOutlined style={{ color: '#bfbfbf' }} />}
                    disabled={processing}
                  />
                  <Button size="small" onClick={handleSelectOutputDir} disabled={processing}>{t('选择')}</Button>
                </div>
                <Text type="secondary" style={{ fontSize: '12px', marginLeft: '88px', display: 'block' }}>
                  {t('未指定目录时，转换后的文件将保存在原文件同级目录下')}
                </Text>
              </Space>
            </div>
          </div>
        }
        actionsContent={
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }}>
            <Button 
              size="large"
              onClick={handleOpenOutputDir}
              disabled={fileList.length === 0 && !outputDir}
            >
              {t('打开输出目录')}
            </Button>
            <Tooltip title={fileList.length === 0 ? t('请先添加需要转换的文件') : ''}>
              <div style={{ display: 'inline-block', cursor: fileList.length === 0 ? 'not-allowed' : 'default' }}>
                <Button 
                  type="primary" 
                  size="large"
                  icon={<CheckCircleOutlined />} 
                  loading={processing}
                  disabled={fileList.length === 0}
                  onClick={handleStart}
                  style={{ minWidth: 120, pointerEvents: fileList.length === 0 ? 'none' : 'auto' }}
                >
                  {processing ? t('转换中...') : t('开始转换')}
                </Button>
              </div>
            </Tooltip>
          </div>
        }
      />

      {/* 结果显示弹窗 - 使用 Modal 代替内联卡片 */}
      <Modal
        open={isCompleted && !!result}
        onCancel={() => {
          setIsCompleted(false);
          setResult(null);
        }}
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
          <Typography.Title level={3} style={{ marginBottom: 8 }}>{t('文件编码转换完成')}</Typography.Title>
          <Typography.Paragraph type="secondary" style={{ fontSize: '15px', marginBottom: 24 }}>
            {t('已成功转换')}{' '}
            <Typography.Text strong type="success" style={{ fontSize: '18px' }}>{result?.successCount || 0}</Typography.Text>{' '}
            {t('个文件')}
            {result?.failCount !== undefined && result.failCount > 0 && (
              <>
                <br />
                {t('失败')}{' '}
                <Typography.Text strong type="danger">{result.failCount}</Typography.Text>{' '}
                {t('个')}
              </>
            )}
          </Typography.Paragraph>
          
          <div style={{ 
            background: '#f8f9fa', 
            padding: '16px', 
            borderRadius: '8px', 
            textAlign: 'left',
            marginBottom: '24px',
            border: '1px solid #f0f0f0'
          }}>
            <div style={{ marginBottom: 8 }}>
              <Typography.Text type="secondary" style={{ fontSize: '12px' }}>{t('保存位置：')}</Typography.Text>
            </div>
            <Typography.Text code style={{ fontSize: '13px', wordBreak: 'break-all', display: 'block', padding: '8px', background: '#fff' }}>
              {outputDir || t('原文件所在目录')}
            </Typography.Text>
          </div>

          <Space size={16}>
            <Button 
              type="primary" 
              size="large" 
              icon={<FolderOpenOutlined />} 
              onClick={handleOpenOutputDir}
              style={{ height: 48, borderRadius: 24, padding: '0 32px', fontSize: 16 }}
            >
              {t('打开输出目录')}
            </Button>
            <Button 
              size="large" 
              onClick={() => {
                setIsCompleted(false);
                setResult(null);
              }}
              style={{ height: 48, borderRadius: 24, padding: '0 24px', fontSize: 16 }}
            >
              {t('关闭')}
            </Button>
          </Space>
        </div>
      </Modal>
    </div>
  );
};
