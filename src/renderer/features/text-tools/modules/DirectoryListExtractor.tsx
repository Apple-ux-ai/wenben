import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Steps, 
  Button, 
  Table, 
  Space, 
  Typography, 
  message, 
  Alert, 
  Modal, 
  Select, 
  Radio, 
  Input, 
  Switch, 
  Tooltip,
  Empty,
  Dropdown,
  Checkbox,
  Tag,
  MenuProps,
  Popconfirm
} from 'antd';
import { useAuth } from '../../../context/AuthContext';
import { UnifiedToolContainer } from '../components/UnifiedToolContainer';
import { useT } from '../../../i18n';
import { 
  FolderAddOutlined, 
  MoreOutlined, 
  DownloadOutlined, 
  FolderOpenOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
  FileSearchOutlined,
  PlusOutlined,
  ClearOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  FileAddOutlined
} from '@ant-design/icons';
import path from 'path';

const { Title, Text } = Typography;

interface FolderItem {
  uid: string;
  name: string;
  path: string;
  createdAt: string;
  modifiedAt: string;
  isDirectory: boolean;
}

interface PreviewItem {
  key: string;
  originalName: string;
  originalPath: string;
  newName: string;
  newPath: string;
}

export const DirectoryListExtractor: React.FC<{ onImport?: (path: string) => void; isModal?: boolean; onClose?: () => void }> = ({ onImport, isModal, onClose }) => {
  const { requireAuth } = useAuth();
  const t = useT();
  const [currentStep, setCurrentStep] = useState(0);
  const [folderList, setFolderList] = useState<FolderItem[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // 文件夹扫描导入相关状态
  const [scannedFiles, setScannedFiles] = useState<any[]>([]);
  const [selectedFileKeys, setSelectedFileKeys] = useState<React.Key[]>([]);
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [scanning, setScanning] = useState(false);

  const [generatedPath, setGeneratedPath] = useState<string | null>(null);
  
  // 其它选项
  const [listFormat, setListFormat] = useState<'xlsx' | 'txt'>('xlsx');
  const [listContent, setListContent] = useState<'files' | 'folders' | 'both'>('files');
  
  // 输出目录
  const [saveTo, setSaveTo] = useState<'specified' | 'original'>('specified');
  const [outputPath, setOutputPath] = useState('');
  const [singleTaskMode, setSingleTaskMode] = useState(false);
  
  // 预览
  const [previewData, setPreviewData] = useState<PreviewItem[]>([]);
  
  // 处理状态
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // 拖拽处理
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!window.electron) return;
    
    const paths = Array.from(e.dataTransfer.files).map(f => f.path);
    if (paths.length > 0) {
      const newItems: FolderItem[] = [];
      for (const p of paths) {
        const info = await window.electron.getFileInfo(p);
        newItems.push({
          uid: Math.random().toString(36).substr(2, 9),
          name: p.split(/[\\/]/).pop() || '',
          path: p,
          createdAt: info.createdAt,
          modifiedAt: info.modifiedAt,
          isDirectory: info.isDirectory
        });
      }
      if (newItems.length > 0) {
        setFolderList(prev => [...prev, ...newItems]);
        message.success(t('成功导入 {{count}} 个项目', { count: newItems.length }));
      }
    }
  };

  // 监听文件夹列表变化，更新预览
  useEffect(() => {
    if (currentStep === 3) {
      updatePreview();
    }
  }, [currentStep, folderList, listFormat, outputPath]);

  const updatePreview = () => {
    const preview = folderList.map((folder, index) => {
      const fileName = `${t('待处理文本表格')}.${listFormat}`;
      const fullOutputPath = saveTo === 'specified' 
        ? (outputPath ? `${outputPath}\\${fileName}` : `[${t('未设置输出目录')}]\\${fileName}`)
        : `${folder.path}\\${fileName}`;
        
      return {
        key: index.toString(),
        originalName: folder.name,
        originalPath: folder.path,
        newName: fileName,
        newPath: fullOutputPath
      };
    });
    setPreviewData(preview);
  };

  const handleAddFolder = async () => {
    if (!window.electron) return;
    try {
      const selectedPath = await window.electron.selectDirectory();
      if (selectedPath) {
        setScanning(true);
        // 获取目录下所有文件
        const files = await window.electron.getDirectoryFiles(selectedPath);
        if (files && files.length > 0) {
          // 获取详细信息（包括是否为文本文件）
          const details = await window.electron.getFileDetails(files.map((f: any) => f.path));
          setScannedFiles(details);
          // 默认选中所有文本文件
          const textFiles = details.filter((f: any) => f.isText).map((f: any) => f.path);
          setSelectedFileKeys(textFiles);
          setIsImportModalOpen(true);
        } else {
          message.info(t('该文件夹下没有发现文件'));
        }
      }
    } catch (error) {
      console.error('Select folder error:', error);
      message.error(t('扫描文件夹失败'));
    } finally {
      setScanning(false);
    }
  };

  const handleExecuteImportFiles = async () => {
    if (selectedFileKeys.length === 0) {
      message.warning(t('请至少选择一个文件'));
      return;
    }

    const selectedFiles = scannedFiles.filter(f => selectedFileKeys.includes(f.path));
    const newItems: FolderItem[] = [];

    for (const f of selectedFiles) {
      const info = await window.electron.getFileInfo(f.path);
      newItems.push({
        uid: Math.random().toString(36).substr(2, 9),
        name: f.name,
        path: f.path,
        createdAt: info.createdAt,
        modifiedAt: info.modifiedAt,
        isDirectory: false
      });
    }

    setFolderList(prev => [...prev, ...newItems]);
    setIsImportModalOpen(false);
    message.success(t('成功导入 {{count}} 个文件', { count: newItems.length }));
  };

  const handleAddFiles = async () => {
    if (!window.electron) return;
    try {
      const paths = await window.electron.selectFiles({
        title: t('选择文件'),
        properties: ['openFile', 'multiSelections']
      });
      if (paths && paths.length > 0) {
        const newItems: FolderItem[] = [];
        for (const p of paths) {
          const info = await window.electron.getFileInfo(p);
          newItems.push({
            uid: Math.random().toString(36).substr(2, 9),
            name: p.split(/[\\/]/).pop() || '',
            path: p,
            createdAt: info.createdAt,
            modifiedAt: info.modifiedAt,
            isDirectory: false
          });
        }
        setFolderList(prev => [...prev, ...newItems]);
        message.success(t('成功导入 {{count}} 个文件', { count: newItems.length }));
      }
    } catch (error) {
      console.error('Select files error:', error);
    }
  };

  const handleProcess = async () => {
    requireAuth(async () => {
      if (folderList.length === 0) return message.warning(t('请先添加文件夹或文件'));
      if (saveTo === 'specified' && !outputPath) return message.warning(t('请选择输出目录'));
      
      // 预计算输出路径
      let targetPath = outputPath;
      if (saveTo === 'specified') {
        // 模拟主进程逻辑：如果 outputPath 是目录，则生成文件名
        const isDir = !targetPath.match(/\.(xlsx|txt)$/i);
        if (isDir) {
          const fileName = `${t('待处理文本表格')}.${listFormat}`;
          targetPath = targetPath.endsWith('\\') || targetPath.endsWith('/') 
            ? `${targetPath}${fileName}` 
            : `${targetPath}\\${fileName}`;
        }
        
        // 检查文件是否存在
        if (window.electron) {
          const exists = await window.electron.checkPathExists(targetPath);
          if (exists) {
            Modal.confirm({
              title: t('文件已存在'),
              closable: true,
              content: t('目标文件 "{{name}}" 已存在，是否覆盖？', { name: targetPath.split(/[\\/]/).pop() }),
              okText: t('覆盖'),
              cancelText: t('取消'),
              onOk: () => executeProcessing(),
            });
            return;
          }
        }
      }

      // 文件不存在或不需要询问
      executeProcessing();
    });
  };

  const executeProcessing = async () => {
    setIsProcessing(true);
    try {
      // 强制预计算带文件名的完整输出路径，以覆盖主进程的自动命名逻辑
      let finalOutputPath = outputPath;
      const isDir = !finalOutputPath.match(/\.(xlsx|txt)$/i);
      if (isDir) {
        const fileName = `${t('待处理文本表格')}.${listFormat}`;
        finalOutputPath = finalOutputPath.endsWith('\\') || finalOutputPath.endsWith('/') 
          ? `${finalOutputPath}${fileName}` 
          : `${finalOutputPath}\\${fileName}`;
      }

      const options = {
        listFormat,
        listContent,
        saveTo,
        outputPath: finalOutputPath, // 传递带文件名的完整路径
        singleTaskMode
      };
      
      // 调用 IPC 进行处理并获取生成的路径
      const finalPath = await window.electron.extractDirectoryList(folderList.map(f => f.path), options);
      setGeneratedPath(finalPath);
      
      setIsCompleted(true);
      message.success(t('处理完成'));
      setCurrentStep(4);
    } catch (error: any) {
      console.error('Process error:', error);
      // 提取错误信息中的关键部分
      let msg = error.message || t('处理过程中出现错误');
      if (msg.includes('Error: ')) {
        msg = msg.split('Error: ').pop();
      }
      message.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenOutputDir = () => {
    // 1. 优先打开手动设置的输出目录
    if (outputPath) {
      // @ts-ignore
      window.electron.openDirectory(outputPath);
      return;
    }
    // 2. 尝试打开生成的路径所在的目录
    if (generatedPath) {
      const lastSlash = Math.max(generatedPath.lastIndexOf('/'), generatedPath.lastIndexOf('\\'));
      const dir = generatedPath.substring(0, lastSlash);
      // @ts-ignore
      window.electron.openDirectory(dir);
      return;
    }
    // 3. 尝试打开第一个待处理项目所在的目录
    if (folderList.length > 0) {
      const firstItem = folderList[0].path;
      const lastSlash = Math.max(firstItem.lastIndexOf('/'), firstItem.lastIndexOf('\\'));
      const dir = firstItem.substring(0, lastSlash);
      // @ts-ignore
      window.electron.openDirectory(dir);
      return;
    }
    message.warning(t('暂无可以打开的目录'));
  };

  const columns = [
    { title: t('序号'), dataIndex: 'index', key: 'index', render: (_: any, __: any, index: number) => index + 1 },
    { title: t('名称'), dataIndex: 'name', key: 'name' },
    { title: t('路径'), dataIndex: 'path', key: 'path' },
    { title: t('创建时间'), dataIndex: 'createdAt', key: 'createdAt', render: (val: string) => val.split('T')[0] },
    { title: t('修改时间'), dataIndex: 'modifiedAt', key: 'modifiedAt', render: (val: string) => val.split('T')[0] },
    { 
      title: t('操作'), 
      key: 'action',
      render: (_: any, record: FolderItem) => (
        <Space>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => {
            setFolderList(prev => prev.filter(f => f.uid !== record.uid));
          }} />
        </Space>
      )
    }
  ];

  const previewColumns = [
    { title: t('序号'), dataIndex: 'index', key: 'index', render: (_: any, __: any, index: number) => index + 1 },
    { title: t('原名称'), dataIndex: 'originalName', key: 'originalName' },
    { title: t('原路径'), dataIndex: 'originalPath', key: 'originalPath' },
    { title: t('新名称'), dataIndex: 'newName', key: 'newName', render: (text: string) => <Text type="danger">{text}</Text> },
    { title: t('新路径'), dataIndex: 'newPath', key: 'newPath', render: (text: string) => <Text type="danger">{text}</Text> }
  ];

  const handleImportFromClipboard = async () => {
    if (!window.electron) return;
    try {
      const text = await window.electron.getClipboardText();
      if (!text) {
        message.warning(t('剪切板中没有内容'));
        return;
      }
      
      const paths = text.split(/\r?\n/).map(p => p.trim().replace(/^["']|["']$/g, '')).filter(p => p !== '');
      if (paths.length === 0) {
        message.warning(t('未检测到有效路径'));
        return;
      }

      const newItems: FolderItem[] = [];
      for (const p of paths) {
        const exists = await window.electron.checkPathExists(p);
        if (exists) {
          const info = await window.electron.getFileInfo(p);
          if (info.isDirectory) {
            newItems.push({
              uid: Math.random().toString(36).substr(2, 9),
              name: p.split(/[\\/]/).pop() || '',
              path: p,
              createdAt: info.createdAt,
              modifiedAt: info.modifiedAt,
              isDirectory: true
            });
          }
        }
      }

      if (newItems.length > 0) {
        setFolderList(prev => [...prev, ...newItems]);
        message.success(t('从剪切板成功导入 {{count}} 个文件夹', { count: newItems.length }));
      } else {
        message.warning(t('剪切板中未发现文件夹路径'));
      }
    } catch (error) {
      console.error('Clipboard import error:', error);
    }
  };

  const menuItems: MenuProps['items'] = [
    { key: 'clipboard', label: t('从剪切板自动读取'), onClick: handleImportFromClipboard }
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: isModal ? '0' : '0 24px 32px 24px' }}>
      {isModal && (
        <div style={{ marginBottom: 16, flexShrink: 0 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={onClose}>{t('返回')}</Button>
        </div>
      )}

      <UnifiedToolContainer
        fileList={folderList}
        selectedFileKeys={selectedRowKeys}
        onSelectionChange={(keys) => setSelectedRowKeys(keys)}
        onFilesAdd={async (files) => {
          if (files && files.length > 0) {
            const newItems: FolderItem[] = [];
            for (const f of files) {
              const p = f.path || (f.originFileObj && f.originFileObj.path);
              if (!p) continue;
              const info = await window.electron.getFileInfo(p);
              newItems.push({
                uid: Math.random().toString(36).substr(2, 9),
                name: p.split(/[\\/]/).pop() || '',
                path: p,
                createdAt: info.createdAt,
                modifiedAt: info.modifiedAt,
                isDirectory: info.isDirectory
              });
            }
            if (newItems.length > 0) {
              setFolderList(prev => [...prev, ...newItems]);
              message.success(t('成功导入 {{count}} 个项目', { count: newItems.length }));
            }
          } else {
            handleAddFolder();
          }
        }}
        onFileRemove={(uid) => {
          setFolderList(prev => prev.filter(f => f.uid !== uid));
          setSelectedRowKeys(selectedRowKeys.filter(key => key !== uid));
        }}
        onFilesRemoveBatch={() => {
          setFolderList(prev => prev.filter(f => !selectedRowKeys.includes(f.uid)));
          setSelectedRowKeys([]);
        }}
        onFilesClear={() => {
          setFolderList([]);
          setSelectedRowKeys([]);
        }}
        uploadHint={t('仅支持 .txt, .html, .json, .xml, .csv 格式的文件')}
        accept=".txt,.html,.json,.xml,.csv"
        extraHeaderActions={
          <Space>
            <Button icon={<FolderAddOutlined />} onClick={handleAddFolder} loading={scanning}>{t('添加文件夹')}</Button>
            <Button icon={<FileAddOutlined />} onClick={handleAddFiles}>{t('添加文件')}</Button>
            <Dropdown menu={{ items: menuItems }}>
              <Button icon={<MoreOutlined />} />
            </Dropdown>
          </Space>
        }
        columns={[
          { 
            title: t('名称'), 
            dataIndex: 'name', 
            key: 'name',
            render: (text: string, record: FolderItem) => (
              <Space>
                {record.isDirectory ? <FolderOpenOutlined style={{ color: '#faad14' }} /> : <FileTextOutlined style={{ color: '#1890ff' }} />}
                {text}
              </Space>
            )
          },
          { 
            title: t('路径'), 
            dataIndex: 'path', 
            key: 'path',
            ellipsis: true,
            render: (text: string) => <Text type="secondary" style={{ fontSize: 12 }}>{text}</Text>
          },
          { 
            title: t('创建时间'), 
            dataIndex: 'createdAt', 
            key: 'createdAt', 
            width: 120,
            render: (val: string) => val ? val.split('T')[0] : '-' 
          },
          { 
            title: t('修改时间'), 
            dataIndex: 'modifiedAt', 
            key: 'modifiedAt', 
            width: 120,
            render: (val: string) => val ? val.split('T')[0] : '-' 
          },
          { 
            title: t('操作'), 
            key: 'action',
            width: 80,
            align: 'center',
            render: (_: any, record: FolderItem) => (
              <Button 
                type="text" 
                danger 
                size="small"
                icon={<DeleteOutlined />} 
                onClick={(e) => {
                  e.stopPropagation();
                  setFolderList(prev => prev.filter(f => f.uid !== record.uid));
                  setSelectedRowKeys(selectedRowKeys.filter(key => key !== record.uid));
                }} 
              />
            )
          }
        ]}
        settingsContent={
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
            {/* 左侧：导出设置 */}
            <div>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <DownloadOutlined style={{ color: '#1890ff' }} />
                <Typography.Text strong>{t('导出设置')}</Typography.Text>
              </div>
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13 }}>{t('清单格式:')}</Text>
                  <Radio.Group size="small" value={listFormat} onChange={e => setListFormat(e.target.value)}>
                    <Radio.Button value="xlsx">Excel (.xlsx)</Radio.Button>
                    <Radio.Button value="txt">{t('文本 (.txt)')}</Radio.Button>
                  </Radio.Group>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13 }}>{t('提取内容:')}</Text>
                  <Radio.Group size="small" value={listContent} onChange={e => setListContent(e.target.value)}>
                    <Radio.Button value="files">{t('仅文件')}</Radio.Button>
                    <Radio.Button value="folders">{t('仅文件夹')}</Radio.Button>
                    <Radio.Button value="both">{t('全部')}</Radio.Button>
                  </Radio.Group>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Space>
                    <Text style={{ fontSize: 13 }}>{t('单任务模式:')}</Text>
                    <Tooltip title={t('电脑配置较差或处理海量文件时开启，更稳定但速度稍慢')}>
                      <QuestionCircleOutlined style={{ color: '#faad14', cursor: 'help', fontSize: 12 }} />
                    </Tooltip>
                  </Space>
                  <Switch size="small" checked={singleTaskMode} onChange={setSingleTaskMode} />
                </div>
              </Space>
            </div>

            {/* 右侧：保存设置 */}
            <div>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FolderOpenOutlined style={{ color: '#52c41a' }} />
                <Typography.Text strong>{t('保存设置')}</Typography.Text>
              </div>
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                <Space.Compact style={{ width: '100%' }}>
                  <Input 
                    value={outputPath} 
                    placeholder={t('请选择输出目录...')}
                    readOnly 
                    size="large"
                    style={{ borderRadius: '8px 0 0 8px' }}
                  />
                  <Button 
                    size="large"
                    icon={<FolderOpenOutlined />} 
                    onClick={async () => {
                      if (window.electron) {
                        const path = await window.electron.selectDirectory();
                        if (path) setOutputPath(path);
                      }
                    }}
                    style={{ borderRadius: '0 8px 8px 0' }}
                  />
                </Space.Compact>
                <Alert 
                  type="info" 
                  showIcon 
                  message={<Text type="secondary" style={{ fontSize: 12 }}>{t('生成的清单将保存为：待处理文本表格.{{ext}}', { ext: listFormat })}</Text>}
                  style={{ padding: '8px 12px', borderRadius: 8 }}
                />
              </Space>
            </div>
          </div>
        }
        actionsContent={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button 
              size="large"
              icon={<FolderOpenOutlined />} 
              onClick={handleOpenOutputDir}
              disabled={folderList.length === 0 && !outputPath}
              style={{ height: 50, borderRadius: 25, padding: '0 24px' }}
            >
              {t('打开结果目录')}
            </Button>
            <Button 
              type="primary" 
              size="large" 
              icon={isProcessing ? <PlayCircleOutlined spin /> : <PlayCircleOutlined />} 
              loading={isProcessing}
              disabled={folderList.length === 0}
              onClick={handleProcess}
              style={{ height: 50, borderRadius: 25, padding: '0 40px', fontSize: 16, fontWeight: 600, boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)' }}
            >
              {isProcessing ? t('正在生成清单...') : t('开始提取清单')}
            </Button>
          </div>
        }
      />

      {/* 完成后的模态框提示 */}
      <Modal
        title={t('处理完成')}
        open={isCompleted}
        onCancel={() => setIsCompleted(false)}
        footer={[
          <Button key="close" onClick={() => setIsCompleted(false)}>{t('关闭')}</Button>,
          <Button 
            key="open" 
            type="primary" 
            icon={<FolderOpenOutlined />}
            onClick={() => {
              if (window.electron && generatedPath) {
                const dirPath = generatedPath.replace(/[\\/][^\\/]+$/, '');
                window.electron.openDirectory(dirPath);
              }
            }}
          >
            {t('打开目录')}
          </Button>,
          isModal && onImport && generatedPath && (
            <Button 
              key="import-module"
              type="primary" 
              style={{ background: '#fa8c16', borderColor: '#fa8c16' }}
              onClick={() => onImport(generatedPath)}
            >
              {t('导入到模块')}
            </Button>
          )
        ].filter(Boolean)}
      >
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
          <p>{t('清单文件已成功生成到指定目录！')}</p>
          <Text type="secondary" copyable>{generatedPath}</Text>
        </div>
      </Modal>

      {/* 文件夹扫描导入弹窗 */}
      <Modal
        title={t('选择要导入的文件')}
        open={isImportModalOpen}
        onCancel={() => setIsImportModalOpen(false)}
        width={800}
        footer={[
          <Button key="cancel" onClick={() => setIsImportModalOpen(false)}>{t('取消')}</Button>,
          <Button 
            key="import" 
            type="primary" 
            onClick={handleExecuteImportFiles}
            disabled={selectedFileKeys.length === 0}
          >
            {t('导入已选文件 ({{count}})', { count: selectedFileKeys.length })}
          </Button>
        ]}
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Checkbox 
            checked={showAllFiles} 
            onChange={e => setShowAllFiles(e.target.checked)}
          >
            {t('显示所有文件 (包括非文本文件)')}
          </Checkbox>
          <Text type="secondary">{t('共发现 {{count}} 个文件', { count: scannedFiles.length })}</Text>
        </div>
        
        <Table
          dataSource={scannedFiles.filter(f => showAllFiles || f.isText)}
          columns={[
            { 
              title: t('文件名'), 
              dataIndex: 'name', 
              key: 'name',
              width: '30%',
              ellipsis: true
            },
            { 
              title: t('路径'), 
              dataIndex: 'path', 
              key: 'path',
              width: '55%',
              ellipsis: true,
              render: (text) => <Text type="secondary">{text}</Text>
            },
            { 
              title: t('类型'), 
              dataIndex: 'isText', 
              key: 'type',
              width: '15%',
              render: (isText) => isText ? <Tag color="green">{t('文本')}</Tag> : <Tag color="default">{t('其它')}</Tag>
            }
          ]}
          rowKey="path"
          rowSelection={{
            selectedRowKeys: selectedFileKeys,
            onChange: (keys) => setSelectedFileKeys(keys),
          }}
          pagination={{ pageSize: 8 }}
          size="small"
          scroll={{ y: 400 }}
        />
      </Modal>
    </div>
  );
};
