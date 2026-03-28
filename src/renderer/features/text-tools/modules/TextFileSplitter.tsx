import React, { useState, useRef } from 'react';
import { Card, Button, Radio, Upload, message, Table, Tag, Space, Input, Tooltip, InputNumber, Popconfirm, Typography, Divider, Modal, Checkbox } from 'antd';
import { 
  InboxOutlined, 
  FileTextOutlined, 
  DeleteOutlined, 
  FolderOpenOutlined, 
  QuestionCircleOutlined, 
  ClearOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  SettingOutlined,
  FolderAddOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../../../context/AuthContext';
import { UnifiedToolContainer } from '../components/UnifiedToolContainer';
import { useT } from '../../../i18n';

const { Text } = Typography;
const { confirm } = Modal;

interface FileItem {
  uid: string;
  name: string;
  path: string;
  relDir?: string; // Relative directory from imported folder root
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
  outputFiles?: string[];
}

export const TextFileSplitter: React.FC = () => {
  const { requireAuth } = useAuth();
  const t = useT();
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [splitMode, setSplitMode] = useState<'lines' | 'count'>('lines');
  const [splitValue, setSplitValue] = useState<number>(1000);
  const [outputDir, setOutputDir] = useState<string>('');
  const [keepDirStruct, setKeepDirStruct] = useState<boolean>(false);
  const [processing, setProcessing] = useState(false);
  const actionRef = useRef<HTMLButtonElement>(null);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Folder import state
  const [isFolderModalVisible, setIsFolderModalVisible] = useState(false);
  const [folderFiles, setFolderFiles] = useState<any[]>([]);
  const [selectedFileKeys, setSelectedFileKeys] = useState<React.Key[]>([]);
  const [scanning, setScanning] = useState(false);
  const [showAllFiles, setShowAllFiles] = useState(false);

  const commonTextExtensions = ['.txt', '.csv', '.json', '.xml', '.html', '.log'];

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

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning(t('请先勾选要删除的文件'));
      return;
    }
    setFileList(prev => prev.filter(item => !selectedRowKeys.includes(item.uid)));
    setSelectedRowKeys([]);
    message.success(t('已删除选中文件'));
  };

  const handleClearAll = () => {
    setFileList([]);
    setSelectedRowKeys([]);
    message.success(t('已清空列表'));
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
        const ext = `.${f.name.split('.').pop()?.toLowerCase()}`;
        const hasDot = f.name.includes('.');
        const isText = commonTextExtensions.includes(ext) || !hasDot;
        return {
          name: f.name,
          path: f.path,
          size: f.size,
          key: f.path,
          isText,
          relDir: f.relDir
        };
      });

      setFolderFiles(processedFiles);
      setSelectedFileKeys(processedFiles.filter((f: any) => f.isText).map((f: any) => f.path));
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
      if (!isDuplicate) {
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
      message.info(t('所选文件已在列表中'));
    }
    
    setIsFolderModalVisible(false);
    setFolderFiles([]);
    setSelectedFileKeys([]);
  };

  const filteredFolderFiles = showAllFiles 
    ? folderFiles 
    : folderFiles.filter(f => f.isText);

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

  const handleStart = async () => {
    requireAuth(async () => {
      if (fileList.length === 0) {
        message.warning(t('请先添加需要拆分的文本文件'));
        return;
      }

    // Check for conflict on all files to decide action for the batch
    let conflictAction: 'overwrite' | 'rename' | 'cancel' = 'overwrite';
    try {
      let hasAnyConflict = false;
      let conflictTargetDir = '';
      
      for (const file of fileList) {
        const conflictCheck = await window.electron.checkSplitConflict(file.path, {
          mode: splitMode,
          value: splitValue,
          outputDir: outputDir || undefined
        });
        if (conflictCheck.hasConflict) {
          hasAnyConflict = true;
          conflictTargetDir = conflictCheck.targetDir;
          break;
        }
      }

      if (hasAnyConflict) {
        // Show inquiry modal
        await new Promise<void>((resolve, reject) => {
          confirm({
            title: t('检测到输出目录已存在同名拆分文件'),
            icon: <ExclamationCircleOutlined />,
            closable: true,
            content: t('输出目录 "{{dir}}" 已包含同名文件的拆分记录。您希望如何处理？', { dir: conflictTargetDir }),
            okText: t('生成新文件'),
            okType: 'primary',
            cancelText: t('覆盖现有文件'),
            onOk() {
              conflictAction = 'rename';
              resolve();
            },
            onCancel(close) {
              if (close.triggerCancel) {
                conflictAction = 'overwrite';
                resolve();
              } else {
                conflictAction = 'cancel';
                reject(new Error('USER_CANCELLED'));
              }
            },
          });
        });
      }
    } catch (error: any) {
      // If user clicked X or ESC, stop the processing
      if (error.message === 'USER_CANCELLED') {
        setProcessing(false);
        return;
      }
      console.log('Conflict check interrupted or failed', error);
    }

    setProcessing(true);
    
    // Reset status for all files to allow re-processing
    const resetFileList: FileItem[] = fileList.map(item => ({ ...item, status: 'pending', error: undefined, outputFiles: undefined }));
    setFileList(resetFileList);
    
    // Process sequentially to avoid system overload
    const newFileList = [...resetFileList];
    
    for (let i = 0; i < newFileList.length; i++) {
      newFileList[i] = { ...newFileList[i], status: 'processing', error: undefined };
      setFileList([...newFileList]);

      try {
        let finalOutputDir = outputDir || undefined;
        if (keepDirStruct && newFileList[i].relDir && outputDir) {
          finalOutputDir = `${outputDir}\\${newFileList[i].relDir}`;
        }

        const result = await window.electron.splitFile(newFileList[i].path, {
          mode: splitMode,
          value: splitValue,
          outputDir: finalOutputDir,
          conflictAction: conflictAction
        });

        if (result.success) {
          newFileList[i] = { 
            ...newFileList[i], 
            status: 'success', 
            outputFiles: result.files 
          };
        } else {
          newFileList[i] = { 
            ...newFileList[i], 
            status: 'error', 
            error: result.error || t('拆分失败') 
          };
        }
      } catch (error: any) {
        newFileList[i] = { 
          ...newFileList[i], 
          status: 'error', 
          error: error.message || t('未知错误') 
        };
      }
      
      setFileList([...newFileList]);
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
        onFilesClear={handleClearAll}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
            {/* 拆分设置区域 */}
            <div>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <SettingOutlined style={{ color: '#1890ff' }} />
                <Typography.Text strong>{t('拆分设置')}</Typography.Text>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Text type="secondary" style={{ width: '80px' }}>{t('拆分方式:')}</Text>
                  <Radio.Group value={splitMode} onChange={e => setSplitMode(e.target.value)} optionType="button" buttonStyle="solid" size="small">
                    <Radio.Button value="lines">{t('按行数拆分')}</Radio.Button>
                    <Radio.Button value="count">{t('按文件数量拆分')}</Radio.Button>
                  </Radio.Group>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Text type="secondary" style={{ width: '80px' }}>
                    {splitMode === 'lines' ? t('每文件行数:') : t('拆分文件数:')}
                  </Text>
                  <InputNumber 
                    min={1} 
                    value={splitValue} 
                    onChange={val => setSplitValue(val || 1)} 
                    style={{ flex: 1 }}
                    size="small"
                  />
                  <Tooltip title={splitMode === 'lines' ? t('将原文件每 N 行保存为一个新文件') : t('将原文件平均拆分为 N 个新文件')}>
                    <Button icon={<QuestionCircleOutlined />} size="small" />
                  </Tooltip>
                </div>
              </div>
            </div>

            {/* 输出保存设置 */}
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
              ref={actionRef}
              style={{ height: 50, borderRadius: 25, padding: '0 40px', fontSize: 16, fontWeight: 600, boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)' }}
            >
              {processing ? t('正在拆分...') : t('开始执行批量拆分')}
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
              {t('显示所有文件')}
            </Checkbox>
            <Text type="secondary">
              {t('已扫描到 {{total}} 个文件，当前显示 {{shown}} 个', {
                total: folderFiles.length,
                shown: filteredFolderFiles.length,
              })}
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
              dataIndex: 'isText', 
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
          onRow={record => ({
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
            style: { cursor: 'pointer' }
          })}
          pagination={{ pageSize: 10 }}
          loading={scanning}
          scroll={{ y: 400 }}
        />
      </Modal>
    </div>
  );
};
