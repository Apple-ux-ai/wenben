import React, { useState } from 'react';
import { Card, Button, Radio, Upload, message, Table, Tag, Space, Modal, Checkbox, Divider, Typography, Popconfirm, Tooltip, Input, Alert } from 'antd';
import { 
  InboxOutlined, 
  FileTextOutlined, 
  DeleteOutlined, 
  FolderOpenOutlined, 
  ClearOutlined,
  Html5Outlined,
  SettingOutlined,
  DownloadOutlined,
  FolderAddOutlined,
  RetweetOutlined
} from '@ant-design/icons';
import { useAuth } from '../../../context/AuthContext';
import { useT } from '../../../i18n';
import { UnifiedToolContainer } from '../components/UnifiedToolContainer';

const { Text } = Typography;

interface FileItem {
  uid: string;
  name: string;
  path: string;
  relDir?: string; // Relative directory from imported folder root
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

export const HtmlToFormatConverter: React.FC = () => {
  const t = useT();
  const { requireAuth } = useAuth();
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [targetFormat, setTargetFormat] = useState<'docx' | 'pdf' | 'txt'>('docx');
  const [outputDir, setOutputDir] = useState<string>('');
  const [keepDirStruct, setKeepDirStruct] = useState<boolean>(false);
  const [processing, setProcessing] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Folder import state
  const [isFolderModalVisible, setIsFolderModalVisible] = useState(false);
  const [folderFiles, setFolderFiles] = useState<any[]>([]);
  const [selectedFileKeys, setSelectedFileKeys] = useState<React.Key[]>([]);
  const [scanning, setScanning] = useState(false);
  const [showAllFiles, setShowAllFiles] = useState(false);

  const allowedExtensions = ['html', 'htm'];

  const handleFileAdd = (file: any) => {
    const path = (file as any).path;
    const ext = path.split('.').pop()?.toLowerCase();
    
    if (!allowedExtensions.includes(ext || '')) {
      message.warning(t('仅支持 .html, .htm 格式的文件'));
      return false;
    }

    const isDuplicate = fileList.some(f => f.path === path);
    if (isDuplicate) {
      message.warning(t('文件 {{name}} 已存在列表', { name: file.name }));
      return false;
    }
    
    setFileList(prev => [...prev, {
      uid: file.uid || Math.random().toString(36).substr(2, 9),
      name: file.name,
      path: path,
      status: 'pending' as const
    }]);
    return false;
  };

  const handleDelete = (uid: string) => {
    setFileList(prev => prev.filter(f => f.uid !== uid));
    setSelectedRowKeys(prev => prev.filter(key => key !== uid));
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
        const isHtml = allowedExtensions.includes(ext);
        return {
          name: f.name,
          path: f.path,
          relDir: f.relDir,
          size: f.size,
          key: f.path,
          isHtml
        };
      });

      setFolderFiles(processedFiles);
      // Default select only HTML files
      setSelectedFileKeys(processedFiles.filter((f: any) => f.isHtml).map((f: any) => f.path));
      setScanning(false);
    } catch (err) {
      console.error('Import folder error:', err);
      message.error(t('导入文件夹失败'));
      setScanning(false);
    }
  };

  const confirmFolderImport = () => {
    const selectedFiles = folderFiles.filter(f => selectedFileKeys.includes(f.path));
    const newItems: FileItem[] = [];
    
    selectedFiles.forEach(file => {
      const isDuplicate = fileList.some(f => f.path === file.path);
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!isDuplicate && allowedExtensions.includes(ext)) {
        newItems.push({
          uid: Math.random().toString(36).substr(2, 9),
          name: file.name,
          path: file.path,
          relDir: file.relDir,
          status: 'pending'
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
    : folderFiles.filter(f => f.isHtml);

  const processFile = async (file: FileItem) => {
    if (!window.electron) return;
    
    try {
      let finalOutputDir = outputDir;
      if (keepDirStruct && file.relDir) {
        finalOutputDir = `${outputDir}\\${file.relDir}`;
      }

      // Use new IPC channel for HTML conversion
      await window.electron.convertHtmlToFormat(file.path, targetFormat, finalOutputDir);
      
      setFileList(prev => prev.map(f => f.uid === file.uid ? { ...f, status: 'success' } : f));

    } catch (err: any) {
      console.error(err);
      setFileList(prev => prev.map(f => f.uid === file.uid ? { ...f, status: 'error', error: err.message } : f));
    }
  };

  const handleStart = async () => {
    requireAuth(async () => {
      if (fileList.length === 0) {
        message.warning(t('请先添加文件'));
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
      // Update status to processing
      setFileList(prev => prev.map(f => f.uid === file.uid ? { ...f, status: 'processing' } : f));
      
      await processFile(file);
    }
    
    setProcessing(false);
    message.success(t('处理完成'));
    });
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

  const columns = [
    {
      title: t('文件名'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <><Html5Outlined style={{ marginRight: 8, color: '#1890ff' }} />{text}</>
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
          onClick={() => handleDelete(record.uid)}
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
        uploadHint={t('仅支持 .html, .htm 格式的文件')}
        accept=".html,.htm"
        extraHeaderActions={
          <Space>
            <Upload
              name="file"
              multiple
              showUploadList={false}
              accept=".html,.htm"
              beforeUpload={(_: any, fileList: any[]) => {
                fileList.forEach(file => handleFileAdd(file));
                return false;
              }}
              directory={false}
            >
              <Button icon={<Html5Outlined />}>{t('添加文件')}</Button>
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
                  <Text type="secondary" style={{ width: '80px' }}>{t('目标格式:')}</Text>
                  <Radio.Group 
                    value={targetFormat} 
                    onChange={e => setTargetFormat(e.target.value)}
                    optionType="button"
                    buttonStyle="solid"
                    size="small"
                  >
                    <Radio.Button value="docx">docx</Radio.Button>
                    <Radio.Button value="pdf">pdf</Radio.Button>
                    <Radio.Button value="txt">txt</Radio.Button>
                  </Radio.Group>
                </div>
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
                  message={t('转换后将自动优化输出排版')}
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
              icon={processing ? <SettingOutlined spin /> : <RetweetOutlined />} 
              loading={processing}
              disabled={fileList.length === 0}
              onClick={handleStart}
              style={{ height: 50, borderRadius: 25, padding: '0 40px', fontSize: 16, fontWeight: 600, boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)' }}
            >
              {processing ? t('正在转换...') : t('开始执行转换')}
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
              dataIndex: 'isHtml', 
              key: 'type',
              render: (isHtml) => isHtml ? <Tag color="blue">HTML</Tag> : <Tag>{t('其他')}</Tag>
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
