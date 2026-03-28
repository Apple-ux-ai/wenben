import React, { useState, useRef } from 'react';
import { Card, Button, Upload, message, Table, Tag, Space, Input, Tooltip, Radio, Popconfirm, Typography, Modal, Checkbox } from 'antd';
import { 
  InboxOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
  ClearOutlined,
  DownloadOutlined,
  QuestionCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
  SettingOutlined,
  FolderAddOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../../../context/AuthContext';
import { UnifiedToolContainer } from '../components/UnifiedToolContainer';
import { useT } from '../../../i18n';

interface FileItem {
  uid: string;
  name: string;
  path: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

interface ImportFileDetail {
  name: string;
  path: string;
  size: number;
  extension: string;
  isText: boolean;
}

interface MergeResult {
  outputPath: string;
  success: boolean;
  error?: string;
}

type MergeMode = 'single' | 'by_folder';

export const TextFileMerger: React.FC = () => {
  const { requireAuth } = useAuth();
  const { Text } = Typography;
  const t = useT();
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [mergeMode, setMergeMode] = useState<MergeMode>('single');
  const [outputDir, setOutputDir] = useState<string>('');
  const [outputFormat, setOutputFormat] = useState<'txt' | 'docx' | 'xml' | 'json' | 'html'>('txt');
  const [processing, setProcessing] = useState(false);
  const [mergeResults, setMergeResults] = useState<MergeResult[]>([]);
  const resultsRef = useRef<any>(null);
  
  // 合并选项
  const [useSeparator, setUseSeparator] = useState(false);
  const [separatorContent, setSeparatorContent] = useState('');
  const [addNewLine, setAddNewLine] = useState(true);

  // 导入弹窗相关状态
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [allImportFiles, setAllImportFiles] = useState<ImportFileDetail[]>([]);
  const [showAllFormats, setShowAllFormats] = useState(false);
  const [selectedImportKeys, setSelectedImportKeys] = useState<React.Key[]>([]);

  const commonTextExtensions = ['.txt', '.csv', '.json', '.xml', '.html', '.log'];

  // 格式化文件大小
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleFileAdd = (file: any) => {
    const path = file.path || (file.originFileObj && file.originFileObj.path);
    if (!path) return false;

    const ext = `.${path.split('.').pop()?.toLowerCase()}`;
    const hasDot = path.includes('.');
    const isText = commonTextExtensions.includes(ext) || !hasDot;

    if (!isText) {
      message.warning(t('仅支持纯文本格式的文件'));
      return false;
    }

    if (fileList.some(item => item.path === path)) {
      message.warning(t('文件 {{name}} 已在列表中', { name: file.name }));
      return false;
    }

    const newItem: FileItem = {
      uid: file.uid || Math.random().toString(36).substr(2, 9),
      name: file.name,
      path: path,
      status: 'pending'
    };

    setFileList(prev => [...prev, newItem]);
    return false;
  };

  const handleImportFolder = async () => {
    try {
      const dirPath = await window.electron.selectDirectory();
      if (!dirPath) return;

      const files = await window.electron.getDirectoryFiles(dirPath);
      if (!files || files.length === 0) {
        message.info(t('文件夹为空'));
        return;
      }

      const filePaths = (files as any[]).map(f => (typeof f === 'string' ? f : f.path));
      const details: ImportFileDetail[] = await window.electron.getFileDetails(filePaths);
      setAllImportFiles(details);
      
      // 默认不勾选任何文件
      setSelectedImportKeys([]);
      
      setImportModalVisible(true);
    } catch (error) {
      console.error(error);
      message.error(t('扫描文件夹失败'));
    }
  };

  const confirmImport = () => {
    const selected = allImportFiles.filter(f => selectedImportKeys.includes(f.path));
    // 扩展前端的文本文件判定逻辑
    const isSupportedText = (f: ImportFileDetail) => {
      const ext = f.extension.toLowerCase();
      return f.isText || ['.xml', '.json', '.html', '.csv', '.txt', '.log'].includes(ext);
    };
    
    const textFiles = selected.filter(isSupportedText);
    const ignoredCount = selected.length - textFiles.length;

    const newItems: FileItem[] = textFiles.map(f => ({
      uid: Math.random().toString(36).substring(2, 11),
      name: f.name,
      path: f.path,
      status: 'pending'
    }));

    const uniqueNewItems = newItems.filter(nf => !fileList.some(ef => ef.path === nf.path));
    setFileList(prev => [...prev, ...uniqueNewItems]);
    setImportModalVisible(false);

    if (uniqueNewItems.length > 0) {
      message.success(t('已添加 {{count}} 个文本文件', { count: uniqueNewItems.length }));
    } else if (selected.length > 0) {
      message.info(t('所选文本文件已在列表中'));
    }

    if (ignoredCount > 0) {
      message.warning(t('{{count}} 个非文本文件已自动忽略，无法参与合并', { count: ignoredCount }));
    }
  };

  const isSupportedText = (f: ImportFileDetail) => {
    const ext = f.extension.toLowerCase();
    return f.isText || ['.xml', '.json', '.html', '.csv', '.txt', '.log'].includes(ext);
  };

  const filteredImportFiles = showAllFormats ? allImportFiles : allImportFiles.filter(isSupportedText);

  // 手动排序：上移
  const moveUp = (index: number) => {
    if (index === 0) return;
    const newList = [...fileList];
    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    setFileList(newList);
  };

  // 手动排序：下移
  const moveDown = (index: number) => {
    if (index === fileList.length - 1) return;
    const newList = [...fileList];
    [newList[index + 1], newList[index]] = [newList[index], newList[index + 1]];
    setFileList(newList);
  };

  const handleBeforeUpload = (file: any) => {
    const isText = file.type === 'text/plain' || 
      file.name.endsWith('.txt') || 
      file.name.endsWith('.log') || 
      file.name.endsWith('.csv') ||
      file.name.endsWith('.xml') ||
      file.name.endsWith('.json') ||
      file.name.endsWith('.html');
    if (!isText) {
      message.warning(
        t('文件 {{name}} 不是支持的文本文件(txt,csv,xml,json,html)，将被忽略', { name: file.name })
      );
      return false;
    }

    if (fileList.some(item => item.path === file.path)) {
      message.warning(t('文件 {{name}} 已在列表中', { name: file.name }));
      return false;
    }

    const newItem: FileItem = {
      uid: file.uid || Math.random().toString(36).substr(2, 9),
      name: file.name,
      path: file.path || file.originFileObj?.path || '',
      status: 'pending'
    };

    if (!newItem.path && file.originFileObj) {
      newItem.path = file.originFileObj.path;
    }

    if (!newItem.path) {
      message.error(t('无法获取文件路径，该文件将被忽略'));
      return false;
    }

    setFileList(prev => [...prev, newItem]);
    return false;
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning(t('请先勾选要删除的文件'));
      return;
    }
    setFileList(prev => prev.filter(item => !selectedRowKeys.includes(item.uid)));
    setSelectedRowKeys([]);
    message.success(t('已删除选中文件'));
  };

  const handleSelectOutputDir = async () => {
    try {
      const result = await window.electron.selectDirectory();
      if (result) {
        setOutputDir(result);
      }
    } catch (error) {
      console.error(error);
      message.error(t('选择目录失败'));
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

  const handleStart = () => {
    requireAuth(async () => {
      if (fileList.length === 0) {
        message.warning(t('请先添加需要合并的文本文件'));
        return;
      }

      const checkConflict = async () => {
        const filePaths = fileList.map(item => item.path);
        const baseDir = outputDir || (mergeMode === 'single' ? (filePaths[0] ? filePaths[0].substring(0, Math.max(filePaths[0].lastIndexOf('\\'), filePaths[0].lastIndexOf('/'))) : '') : '');
        
        let targetPaths: string[] = [];
        const sep = baseDir.includes('/') ? '/' : '\\';
        
        const ext = `.${outputFormat}`;
        
        if (mergeMode === 'single') {
          targetPaths = [baseDir + `${sep}文本合并结果${ext}`];
        } else {
          const groups = new Set(filePaths.map(p => p.substring(0, Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/')))));
          targetPaths = Array.from(groups).map(dir => {
            const folderName = dir.split(/[\\/]/).pop();
            const targetDir = outputDir || dir;
            const targetSep = targetDir.includes('/') ? '/' : '\\';
            return targetDir + `${targetSep}${folderName}_合并结果${ext}`;
          });
        }

        for (const p of targetPaths) {
          if (await window.electron.checkPathExists(p)) {
            return true;
          }
        }
        return false;
      };

      const runMerge = async (conflictAction: 'overwrite' | 'new' = 'overwrite') => {
        setProcessing(true);
        setMergeResults([]);
        const resetList: FileItem[] = fileList.map(item => ({ ...item, status: 'pending', error: undefined }));
        setFileList(resetList);

        try {
          const filePaths = resetList.map(item => item.path);
          const result = await window.electron.mergeTextFiles(filePaths, {
            mode: mergeMode,
            outputDir: outputDir || undefined,
            outputFormat,
            conflictAction,
            separator: useSeparator ? separatorContent : undefined,
            addNewLine
          });

          if (result.success) {
            const updated: FileItem[] = resetList.map(item => ({ ...item, status: 'success' }));
            setFileList(updated);
            setMergeResults(result.results || []);
            message.success(t('合并完成'));
            
            // 延迟一点时间等待 DOM 更新后再滚动
            setTimeout(() => {
              resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
          } else {
            const updated: FileItem[] = resetList.map(item => ({ ...item, status: 'error', error: result.error || t('合并失败') }));
            setFileList(updated);
            message.error(result.error || t('合并失败'));
          }
        } catch (error: any) {
          const updated: FileItem[] = resetList.map(item => ({ ...item, status: 'error', error: error?.message || t('未知错误') }));
          setFileList(updated);
          message.error(error?.message || t('合并失败'));
        } finally {
          setProcessing(false);
        }
      };

      const hasConflict = await checkConflict();
      if (hasConflict) {
        Modal.confirm({
          title: t('文件已存在'),
          icon: <ExclamationCircleOutlined />,
          content: t('目标目录中已存在同名合并文件，请选择处理方式：'),
          okText: t('覆盖现有文件'),
          cancelText: t('创建新文件'),
          okButtonProps: { danger: true },
          onOk: () => runMerge('overwrite'),
          onCancel: () => {
            runMerge('new');
          },
        });
      } else {
        runMerge('overwrite');
      }
    });
  };

  const columns = [
    {
      title: t('文件名'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: FileItem) => (
        <Space>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <Text>{text}</Text>
        </Space>
      )
    },
    {
      title: t('路径'),
      dataIndex: 'path',
      key: 'path',
      ellipsis: true,
      render: (text: string) => <Text type="secondary" style={{ fontSize: '12px' }}>{text}</Text>
    },
    {
      title: t('排序'),
      key: 'sort',
      width: 100,
      render: (_: any, __: any, index: number) => (
        <Space size={0}>
          <Button 
            type="text" 
            size="small" 
            icon={<ArrowUpOutlined />} 
            disabled={index === 0 || processing}
            onClick={() => moveUp(index)}
          />
          <Button 
            type="text" 
            size="small" 
            icon={<ArrowDownOutlined />} 
            disabled={index === fileList.length - 1 || processing}
            onClick={() => moveDown(index)}
          />
        </Space>
      )
    },
    {
      title: t('状态'),
      key: 'status',
      width: 100,
      render: (_: any, record: FileItem) => {
        if (record.status === 'pending') return <Tag>{t('等待处理')}</Tag>;
        if (record.status === 'processing') return <Tag color="blue">{t('正在处理')}</Tag>;
        if (record.status === 'success') return <Tag color="success">{t('成功')}</Tag>;
        if (record.status === 'error') return <Tooltip title={record.error}><Tag color="error">{t('失败')}</Tag></Tooltip>;
        return null;
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
          onClick={() => {
            setFileList(fileList.filter(item => item.uid !== record.uid));
          }}
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
        onFilesClear={() => {
          setFileList([]);
          setSelectedRowKeys([]);
          setMergeResults([]);
        }}
        uploadHint={t('仅支持 .txt, .html, .json, .xml, .csv, .log 格式的纯文本文件')}
        accept=".txt,.html,.json,.xml,.csv,.log"
        extraHeaderActions={
          <Space>
            <Upload
              name="file"
              multiple
              showUploadList={false}
              accept=".txt,.html,.json,.xml,.csv,.log"
              beforeUpload={(_: any, fileList: any[]) => {
                fileList.forEach(file => handleFileAdd(file));
                return false;
              }}
              directory={false}
            >
              <Button icon={<FileTextOutlined />}>{t('添加文件')}</Button>
            </Upload>
            <Button icon={<FolderAddOutlined />} onClick={handleImportFolder}>{t('导入文件夹')}</Button>
          </Space>
        }
        columns={columns}
        settingsContent={
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 48 }}>
            {/* 合并设置 */}
            <div>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <SettingOutlined style={{ color: '#1890ff' }} />
                <Typography.Text strong>{t('合并设置')}</Typography.Text>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Text type="secondary" style={{ width: '80px' }}>{t('合并方式:')}</Text>
                  <Radio.Group value={mergeMode} onChange={e => setMergeMode(e.target.value)} optionType="button" buttonStyle="solid" size="small">
                    <Radio.Button value="single">{t('全部合并')}</Radio.Button>
                    <Radio.Button value="by_folder">{t('按文件夹合并')}</Radio.Button>
                  </Radio.Group>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Text type="secondary" style={{ width: '80px' }}>{t('分隔符:')}</Text>
                  <Checkbox checked={addNewLine} onChange={e => setAddNewLine(e.target.checked)}>{t('添加换行符')}</Checkbox>
                  <Checkbox checked={useSeparator} onChange={e => setUseSeparator(e.target.checked)}>{t('自定义')}</Checkbox>
                  <Input 
                    placeholder={t('如 \\n\\n')} 
                    size="small"
                    value={separatorContent}
                    onChange={e => setSeparatorContent(e.target.value)}
                    disabled={!useSeparator}
                    style={{ width: 100 }}
                  />
                </div>
              </div>
            </div>

            {/* 输出设置 */}
            <div>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <DownloadOutlined style={{ color: '#1890ff' }} />
                <Typography.Text strong>{t('输出设置')}</Typography.Text>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Text type="secondary" style={{ width: '80px' }}>{t('输出格式:')}</Text>
                  <Radio.Group value={outputFormat} onChange={e => setOutputFormat(e.target.value)} disabled={processing} size="small">
                    <Radio value="txt">txt</Radio>
                    <Radio value="xml">xml</Radio>
                    <Radio value="json">json</Radio>
                    <Radio value="html">html</Radio>
                  </Radio.Group>
                </div>
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
              icon={processing ? <SettingOutlined spin /> : <PlayCircleOutlined />} 
              loading={processing}
              disabled={fileList.length === 0}
              onClick={handleStart}
              ref={resultsRef}
              style={{ height: 50, borderRadius: 25, padding: '0 40px', fontSize: 16, fontWeight: 600, boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)' }}
            >
              {processing ? t('正在合并...') : t('开始批量合并')}
            </Button>
          </div>
        }
      />

      {/* 导入筛选弹窗 */}
      <Modal
        title={t('选择要导入的文件')}
        open={importModalVisible}
        onOk={confirmImport}
        onCancel={() => setImportModalVisible(false)}
        width={800}
        okText={t('导入已选 ({{count}})', { count: selectedImportKeys.length })}
        cancelText={t('取消')}
      >
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
              {t('共发现 {{total}} 个文件，已自动过滤出 {{text}} 个文本文件', {
                total: allImportFiles.length,
                text: allImportFiles.filter(f => isSupportedText(f)).length,
              })}
            </div>
          </div>
          <Checkbox 
            checked={showAllFormats} 
            onChange={e => setShowAllFormats(e.target.checked)}
          >
            {t('显示所有格式 (包含非文本文件)')}
          </Checkbox>
        </div>
        <Table
            rowSelection={{
              selectedRowKeys: selectedImportKeys,
              onChange: keys => setSelectedImportKeys(keys)
            }}
            onRow={(record) => ({
              onClick: () => {
                const key = record.path as React.Key;
                const newKeys = [...selectedImportKeys];
                const index = newKeys.indexOf(key);
                if (index > -1) {
                  newKeys.splice(index, 1);
                } else {
                  newKeys.push(key);
                }
                setSelectedImportKeys(newKeys);
              },
              style: { cursor: 'pointer' }
            })}
            dataSource={filteredImportFiles}
          rowKey="path"
          size="small"
          pagination={{ pageSize: 10, showSizeChanger: false, position: ['bottomRight'] }}
          scroll={{ y: 300 }}
          columns={[
            {
              title: t('文件名'),
              dataIndex: 'name',
              key: 'name',
              width: 250,
              ellipsis: true,
              render: (text, record) => (
                <Space>
                  <FileTextOutlined style={{ color: isSupportedText(record) ? '#1890ff' : '#8c8c8c' }} />
                  {text}
                </Space>
              )
            },
            {
              title: t('类型'),
              dataIndex: 'isText',
              key: 'type',
              width: 80,
              render: (_, record) => isSupportedText(record) ? <Tag color="blue">{t('文本')}</Tag> : <Tag color="default">{t('其他')}</Tag>
            },
            {
              title: t('路径'),
              dataIndex: 'path',
              key: 'path',
              ellipsis: true,
              render: (text) => <Tooltip title={text}>{text}</Tooltip>
            },
            {
              title: t('大小'),
              dataIndex: 'size',
              key: 'size',
              width: 100,
              render: (size) => formatSize(size)
            }
          ]}
        />
      </Modal>
    </div>
  );
};
