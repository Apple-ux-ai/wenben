import React, { useState } from 'react';
import { Card, Button, Upload, message, Table, Tag, Space, Typography, Radio, Divider, Modal, Checkbox, Input, Tooltip } from 'antd';
import { 
  InboxOutlined, 
  FileTextOutlined, 
  DeleteOutlined, 
  FolderOpenOutlined, 
  ClearOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  DownloadOutlined,
  FolderAddOutlined,
  FileAddOutlined
} from '@ant-design/icons';
import { marked } from 'marked';
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

export const MarkdownConverter: React.FC = () => {
  const t = useT();
  const { requireAuth } = useAuth();
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [targetFormat, setTargetFormat] = useState<'docx' | 'pdf'>('docx');
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

  const allowedExtensions = ['md', 'markdown', 'mdown', 'mkd'];

  const handleFileAdd = (file: any) => {
    const path = (file as any).path;
    const ext = path.split('.').pop()?.toLowerCase();
    
    if (!allowedExtensions.includes(ext || '')) {
      message.warning(t('仅支持 .md, .markdown 等格式的文件'));
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
        const isMarkdown = allowedExtensions.includes(ext);
        return {
          name: f.name,
          path: f.path,
          relDir: f.relDir,
          size: f.size,
          key: f.path,
          isMarkdown
        };
      });

      setFolderFiles(processedFiles);
      // Default select only Markdown files
      setSelectedFileKeys(processedFiles.filter((f: any) => f.isMarkdown).map((f: any) => f.path));
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

  const processFile = async (file: FileItem) => {
    if (!window.electron) return;
    
    try {
      const mdContent = await window.electron.readFile(file.path);
      const htmlContent = marked.parse(mdContent) as string;
      
      // Wrap in basic HTML structure for conversion
      const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: "Microsoft YaHei", sans-serif; line-height: 1.6; padding: 20px; }
            h1, h2, h3, h4, h5, h6 { color: #333; }
            code { background: #f4f4f4; padding: 2px 4px; border-radius: 4px; }
            pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto; }
            blockquote { border-left: 4px solid #ddd; padding-left: 10px; color: #666; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>
      `;

      const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
      
      let finalOutputDir = outputDir;
      if (keepDirStruct && file.relDir) {
        // Ensure path separator consistency
        const cleanOutputDir = outputDir.replace(/[\\/]+$/, '');
        const cleanRelDir = file.relDir.replace(/^[\\/]+|[\\/]+$/g, '');
        finalOutputDir = `${cleanOutputDir}\\${cleanRelDir}`;
      }

      // We need a temporary HTML file for the existing convertHtmlToFormat handler
      // Use the same base name so the output file has the correct name
      const tempHtmlPath = `${finalOutputDir.replace(/[\\/]+$/, '')}\\${fileNameWithoutExt}.html`;
      
      await window.electron.writeFile(tempHtmlPath, fullHtml);

      try {
        await window.electron.convertHtmlToFormat(tempHtmlPath, targetFormat, finalOutputDir);
        
        setFileList(prev => prev.map(f => f.uid === file.uid ? { ...f, status: 'success' } : f));
      } finally {
        // Delete temporary HTML file if target format is not HTML
        await (window.electron as any).deleteFile(tempHtmlPath);
      }

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
    
    for (const file of fileList) {
      // Update status to processing
      setFileList(prev => prev.map(f => f.uid === file.uid ? { ...f, status: 'processing' } : f));
      await processFile(file);
    }
    
    setProcessing(false);
    message.success(t('处理完成'));
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
        uploadHint={t('仅支持 .md, .markdown 等格式的文件')}
        accept=".md,.markdown"
        extraHeaderActions={
          <Space>
            <Upload
              name="file"
              multiple
              showUploadList={false}
              accept=".md,.markdown"
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
                  <Text type="secondary" style={{ width: '80px' }}>{t('目标格式:')}</Text>
                  <Radio.Group 
                    value={targetFormat} 
                    onChange={e => {
                      setTargetFormat(e.target.value);
                      setFileList(prev => prev.map(f => f.status === 'success' ? { ...f, status: 'pending' } : f));
                    }}
                    optionType="button"
                    buttonStyle="solid"
                    size="small"
                  >
                    <Radio.Button value="docx">docx</Radio.Button>
                    <Radio.Button value="pdf">pdf</Radio.Button>
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
                    disabled={!outputDir}
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
              disabled={fileList.length === 0 || !outputDir}
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
        width={700}
        okText={t('确认导入')}
        cancelText={t('取消')}
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Checkbox checked={showAllFiles} onChange={e => setShowAllFiles(e.target.checked)}>
            {t('显示所有文件 (包括非 Markdown)')}
          </Checkbox>
          <Text type="secondary">{t('已选择 {{count}} 个文件', { count: selectedFileKeys.length })}</Text>
        </div>
        <Table
          size="small"
          dataSource={showAllFiles ? folderFiles : folderFiles.filter(f => f.isMarkdown)}
          rowKey="path"
          columns={[
            { 
              title: t('文件名'), 
              dataIndex: 'name', 
              key: 'name',
              render: (text, record) => (
                <Space>
                  <FileTextOutlined style={{ color: record.isMarkdown ? '#1890ff' : '#8c8c8c' }} />
                  {text}
                </Space>
              )
            },
            { 
              title: t('大小'), 
              dataIndex: 'size', 
              key: 'size', 
              width: 100,
              render: (s) => `${(s / 1024).toFixed(1)} KB` 
            }
          ]}
          rowSelection={{
            selectedRowKeys: selectedFileKeys,
            onChange: (keys) => setSelectedFileKeys(keys),
          }}
          pagination={{ pageSize: 10, size: 'small' }}
          loading={scanning}
          scroll={{ y: 300 }}
        />
      </Modal>
    </div>
  );
};
