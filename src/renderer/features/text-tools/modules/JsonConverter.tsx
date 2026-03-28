import React, { useState, useCallback } from 'react';
import { Card, Button, Select, Upload, message, Table, Space, Tag, Input, Typography, Tooltip, Dropdown, Menu, Popconfirm, Radio, Modal, Divider, Checkbox, Alert } from 'antd';
import { 
  InboxOutlined, 
  FileTextOutlined, 
  FolderOpenOutlined, 
  DeleteOutlined, 
  DeploymentUnitOutlined, 
  FileExcelOutlined, 
  ClearOutlined, 
  PlayCircleOutlined,
  SettingOutlined,
  DownloadOutlined,
  FolderAddOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { useAuth } from '../../../context/AuthContext';
import { useT } from '../../../i18n';
import { UnifiedToolContainer } from '../components/UnifiedToolContainer';

const { Text } = Typography;

interface FileItem {
  uid: string;
  name: string;
  path: string;
  relDir?: string; // Relative directory from imported folder root
  status: 'pending' | 'success' | 'error' | 'processing';
  outputPath?: string;
  error?: string;
}

export const JsonConverter: React.FC = () => {
  const t = useT();
  const { requireAuth } = useAuth();
  const [fileList, setFileList] = useState<FileItem[]>([]);
  const [targetFormat, setTargetFormat] = useState<'xlsx' | 'mm'>('xlsx');
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

  const allowedExtensions = ['json'];

  const handleFileAdd = (file: any) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'json') {
      message.error(t('仅支持 .json 格式的文件'));
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

  const handleDelete = (uid: string) => {
    setFileList(prev => prev.filter(f => f.uid !== uid));
    setSelectedRowKeys(prev => prev.filter(key => key !== uid));
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
        const ext = f.name.split('.').pop()?.toLowerCase() || '';
        const isJson = ext === 'json';
        return {
          name: f.name,
          path: f.path,
          relDir: f.relDir,
          size: f.size,
          key: f.path,
          isJson
        };
      });

      setFolderFiles(processedFiles);
      // Default select only json files
      setSelectedFileKeys(processedFiles.filter((f: any) => f.isJson).map((f: any) => f.path));
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
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!isDuplicate && ext === 'json') {
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
    : folderFiles.filter(f => f.isJson);

  const handleSelectOutputDir = async () => {
    if (!window.electron) return;
    try {
      const path = await window.electron.selectDirectory();
      if (path) {
        setOutputDir(path);
      }
    } catch (error) {
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

  const jsonToFreeMind = (data: any, rootName: string): string => {
    const escape = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    let idCounter = 1;
    const nextId = () => `node-${idCounter++}`;
    
    const traverse = (obj: any): string => {
      if (obj === null) {
        return `<node ID="${nextId()}" CREATED="0" MODIFIED="0" TEXT="null"/>`;
      }
      if (typeof obj !== 'object') {
        return `<node ID="${nextId()}" CREATED="0" MODIFIED="0" TEXT="${escape(String(obj))}"/>`;
      }
      
      if (Array.isArray(obj)) {
        return obj.map((item, index) => {
            if (typeof item !== 'object' && item !== null) {
                return `<node ID="${nextId()}" CREATED="0" MODIFIED="0" TEXT="${escape(String(item))}"/>`;
            }
             return `<node ID="${nextId()}" CREATED="0" MODIFIED="0" TEXT="[${index}]">${traverse(item)}</node>`;
        }).join('');
      }
      
      return Object.keys(obj).map(key => {
        return `<node ID="${nextId()}" CREATED="0" MODIFIED="0" TEXT="${escape(key)}">${traverse(obj[key])}</node>`;
      }).join('');
    };

    const rootText = escape(rootName && rootName.trim().length > 0 ? rootName : 'JSON');
    return `<map version="1.0.1"><node ID="${nextId()}" CREATED="0" MODIFIED="0" TEXT="${rootText}">${traverse(data)}</node></map>`;
  };

  const isPlainObject = (val: any): boolean => {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
  };

  const flattenObject = (obj: any, prefix = ''): any => {
    const result: any = {};
    if (!isPlainObject(obj)) return result;
    Object.keys(obj).forEach(key => {
      const value = (obj as any)[key];
      const path = prefix ? `${prefix}.${key}` : key;
      if (isPlainObject(value)) {
        Object.assign(result, flattenObject(value, path));
      } else {
        result[path] = value;
      }
    });
    return result;
  };

  const findFirstObjectArray = (obj: any, prefix = ''): { path: string; items: any[] } | null => {
    if (!isPlainObject(obj)) return null;
    for (const key of Object.keys(obj)) {
      const value = (obj as any)[key];
      const path = prefix ? `${prefix}.${key}` : key;
      if (Array.isArray(value) && value.length > 0 && value.every(item => isPlainObject(item))) {
        return { path, items: value };
      }
      if (isPlainObject(value)) {
        const found = findFirstObjectArray(value, path);
        if (found) return found;
      }
    }
    return null;
  };

  const jsonToExcelBuffer = (data: any): Uint8Array => {
    let sheetData: any[] = [];

    if (Array.isArray(data)) {
      const allObjects = data.every(item => isPlainObject(item));
      if (allObjects) {
        sheetData = data.map(item => flattenObject(item));
      } else {
        sheetData = data.map((item, index) => {
          if (isPlainObject(item)) {
            return flattenObject(item);
          }
          return { index, value: item };
        });
      }
    } else if (isPlainObject(data)) {
      const arrayInfo = findFirstObjectArray(data);
      if (arrayInfo) {
        const context = flattenObject(data);
        const pathPrefix = arrayInfo.path;
        Object.keys(context)
          .filter(key => key === pathPrefix || key.startsWith(`${pathPrefix}.`))
          .forEach(key => {
            delete context[key];
          });
        sheetData = arrayInfo.items.map(item => ({
          ...context,
          ...flattenObject(item, arrayInfo.path)
        }));
      } else {
        sheetData = [flattenObject(data)];
      }
    } else {
      sheetData = [{ value: data }];
    }

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    return new Uint8Array(wbout);
  };

  const handleConvert = async () => {
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
    
    // 重置所有文件状态
    setFileList(prev => prev.map(f => ({ ...f, status: 'pending', error: undefined, outputPath: undefined })));
    
    const getUniquePath = async (basePath: string, fileName: string, ext: string) => {
      let counter = 1;
      let newPath = `${basePath}\\${fileName}${ext}`;
      while (await window.electron.checkPathExists(newPath)) {
        newPath = `${basePath}\\${fileName}(${counter})${ext}`;
        counter++;
      }
      return newPath;
    };

    const currentFiles = [...fileList];
    
    for (const file of currentFiles) {
       setFileList(prev => prev.map(f => f.uid === file.uid ? { ...f, status: 'processing' } : f));

       try {
         const content = await window.electron.readFile(file.path);
         let jsonData;
         try {
             jsonData = JSON.parse(content);
         } catch (e) {
             throw new Error(t('无效的 JSON 格式'));
         }

         const baseName = file.name.replace(/\.json$/i, '');
         const ext = targetFormat === 'xlsx' ? '.xlsx' : '.mm';
         
         let finalOutputDir = outputDir;
         if (keepDirStruct && file.relDir) {
           finalOutputDir = `${outputDir}\\${file.relDir}`;
         }
         
         const defaultPath = `${finalOutputDir}\\${baseName}${ext}`;
         
         let finalPath = defaultPath;
         const exists = await window.electron.checkPathExists(defaultPath);

         if (exists) {
            // 弹出询问
            await new Promise<void>((resolve) => {
              Modal.confirm({
                title: t('文件已存在'),
                content: t('文件 "{{name}}" 已存在，请选择处理方式：', { name: `${baseName}${ext}` }),
                okText: t('覆盖'),
                cancelText: t('新建副本'),
                closable: false,
                maskClosable: false,
                onOk: () => {
                  finalPath = defaultPath;
                  resolve();
                },
                onCancel: async () => {
                  finalPath = await getUniquePath(finalOutputDir, baseName, ext);
                  resolve();
                }
              });
            });
         }

         let writePromise;
         if (targetFormat === 'xlsx') {
             const buffer = jsonToExcelBuffer(jsonData);
             writePromise = window.electron.writeBinaryFile(finalPath, buffer);
         } else {
             const xmlContent = jsonToFreeMind(jsonData, baseName);
             writePromise = window.electron.writeFile(finalPath, xmlContent);
         }

         await writePromise;
         setFileList(prev => prev.map(f => f.uid === file.uid ? { ...f, status: 'success', outputPath: finalPath } : f));
       } catch (error: any) {
         console.error(error);
         setFileList(prev => prev.map(f => f.uid === file.uid ? { ...f, status: 'error', error: error.message || t('转换失败') } : f));
       }
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
      width: 100,
      render: (_: any, record: FileItem) => (        <Tooltip title={record.error}>
          <Tag color={record.status === 'success' ? 'success' : record.status === 'error' ? 'error' : record.status === 'processing' ? 'processing' : 'default'}>
            {record.status === 'success' ? t('成功') : record.status === 'error' ? t('失败') : record.status === 'processing' ? t('处理中') : t('待处理')}
          </Tag>
        </Tooltip>
      )
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
          size="small"
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
        onFilesRemoveBatch={() => {
          setFileList(prev => prev.filter(f => !selectedRowKeys.includes(f.uid)));
          setSelectedRowKeys([]);
        }}
        onFilesClear={handleClearAll}
        uploadHint={t('仅支持 .json 格式的文件')}
        accept=".json"
        extraHeaderActions={
          <Space>
            <Upload
              name="file"
              multiple
              showUploadList={false}
              accept=".json"
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
                    <Radio.Button value="xlsx">
                      <Space size={4}><FileExcelOutlined />{t('Excel 表格 (.xlsx)')}</Space>
                    </Radio.Button>
                    <Radio.Button value="mm">
                      <Space size={4}><DeploymentUnitOutlined />{t('思维导图 (.mm)')}</Space>
                    </Radio.Button>
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
                    readOnly
                    onClick={handleSelectOutputDir}
                    suffix={
                      <Tooltip title={t('选择目录')}>
                        <FolderOpenOutlined 
                          style={{ cursor: 'pointer', color: '#1890ff' }} 
                          onClick={handleSelectOutputDir} 
                        />
                      </Tooltip>
                    }
                    style={{ flex: 1, cursor: 'pointer' }}
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
              onClick={handleConvert}
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
              dataIndex: 'isJson', 
              key: 'type',
              render: (isJson) => isJson ? <Tag color="blue">JSON</Tag> : <Tag>{t('其他')}</Tag>
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
