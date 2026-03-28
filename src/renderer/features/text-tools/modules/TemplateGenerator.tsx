import React, { useState, useEffect } from 'react';
import { 
  FileTextOutlined,
  FileExcelOutlined,
  FolderOpenOutlined,
  CheckCircleOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  CloseOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import { 
  Steps, 
  Button, 
  Typography, 
  Space, 
  Input,
  Select,
  Table,
  Tag,
  Tooltip,
  Modal,
  Checkbox, 
  Radio, 
  Collapse, 
  InputNumber, 
  Switch, 
  Upload,
  App
} from 'antd';
import { useAuth } from '../../../context/AuthContext';
import { useT } from '../../../i18n';

import { UnifiedToolContainer } from '../components/UnifiedToolContainer';
import { useFileManager } from '../hooks/useFileManager';
import { BaseFileItem } from '../types/tool-common';

const { Title, Text, Paragraph } = Typography;

interface MappingItem {
  placeholder: string;
  column: string;
}

interface TemplateFile extends BaseFileItem {
  ext: string;
  modifiedAt: string;
}

interface MappingConfig {
  id: string;
  name: string;
  excelPath: string;
  headerRow: number;
  sheetName?: string;
  options: string[];
  processFirstSheetOnly: boolean;
  processVisibleRowsOnly: boolean;
  filenameGenerationType: 'column' | 'custom';
  filenameColumnIndex?: number;
  fileNameFormat: string;
  mapping: Record<string, string>;
  headers: string[];
}

export const TemplateGenerator: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { message } = App.useApp();
  const { requireAuth } = useAuth();
  const t = useT();

  // Step 1: File Management via Hook
  const { 
    fileList, 
    setFileList, 
    addFiles, 
    removeFile, 
    removeSelectedFiles, 
    clearAllFiles, 
    selectedFileKeys, 
    setSelectedFileKeys,
    isProcessing: processing,
    setIsProcessing: setProcessing
  } = useFileManager<TemplateFile>();

  // Alias fileList to templateFiles for compatibility
  const templateFiles = fileList;

  // Selected template path logic
  const [selectedTemplatePath, setSelectedTemplatePath] = useState('');
  
  // Step 2: Mappings
  const [mappings, setMappings] = useState<MappingConfig[]>([]);
  const [selectedMappingId, setSelectedMappingId] = useState<string>('');
  
  // Modal for New Mapping
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalStep, setModalStep] = useState(0);
  const [newMapping, setNewMapping] = useState<Partial<MappingConfig>>({
    name: '',
    excelPath: '',
    headerRow: 1,
    options: ['仅第一个工作表', '仅可见行'],
    processFirstSheetOnly: true,
    processVisibleRowsOnly: true,
    filenameGenerationType: 'column',
    filenameColumnIndex: 1,
    fileNameFormat: '',
    mapping: {}
  });

  // Step 3: Output
  const [saveMode, setSaveMode] = useState<'specific' | 'overwrite'>('specific');
  const [outputPath, setOutputPath] = useState('C:\\Users\\admin\\Desktop\\模板生成产出');
  // const [singleTaskMode, setSingleTaskMode] = useState(false);
  
  // Processing (isProcessing is handled by useFileManager)
  const [isCompleted, setIsCompleted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [placeholders, setPlaceholders] = useState<string[]>([]);

  // Conflict state
  const [conflictModalVisible, setConflictModalVisible] = useState(false);
  const [conflictingFiles, setConflictingFiles] = useState<string[]>([]);
  const [pendingProcessParams, setPendingProcessParams] = useState<{
    activeMapping: MappingConfig;
    outputDir: string;
  } | null>(null);

  // Auto-select first file logic
  useEffect(() => {
    if (templateFiles.length > 0) {
      // If nothing selected, or selected file removed, select first
      const currentExists = templateFiles.find(f => f.path === selectedTemplatePath);
      if (!selectedTemplatePath || !currentExists) {
        const first = templateFiles[0];
        setSelectedTemplatePath(first.path);
        // detection will be triggered by the next effect
      }
    } else {
      if (selectedTemplatePath) {
        setSelectedTemplatePath('');
        setPlaceholders([]);
      }
    }
  }, [templateFiles, selectedTemplatePath]);

  // Trigger detection when selection changes
  useEffect(() => {
    if (selectedTemplatePath) {
      detectPlaceholders(selectedTemplatePath);
    }
  }, [selectedTemplatePath]);

  // Detect placeholders from template
  const detectPlaceholders = async (filePath: string) => {
    if (!window.electron) return;
    try {
      const content = await window.electron.readFile(filePath);
      console.log('Template content read, length:', content.length);
      
      // 改进正则：支持 [姓名] 和 {姓名}，并处理可能的空格
      const bracketMatches = content.match(/\[\s*(.*?)\s*\]/g) || [];
      const braceMatches = content.match(/\{\s*(.*?)\s*\}/g) || [];
      const allMatches = [...bracketMatches, ...braceMatches];
      
      const uniquePlaceholders = Array.from(new Set(allMatches.map(m => {
        // 保留原始的占位符（包含括号），以便 UI 显示和映射 key 使用
        // 同时做一个简单的内部 trim，例如 "[ 姓名 ]" -> "[姓名]"，看起来更整洁
        const open = m.startsWith('[') ? '[' : '{';
        const close = m.endsWith(']') ? ']' : '}';
        const inner = m.substring(1, m.length - 1).trim();
        return `${open}${inner}${close}`;
      }))).filter(p => p.length > 2); // 至少包含括号和内容
      
      console.log('Detected placeholders:', uniquePlaceholders);
      setPlaceholders(uniquePlaceholders);
      
      if (uniquePlaceholders.length === 0) {
        console.warn('No placeholders found in template. Check if you use [Field] format.');
      }
    } catch (error) {
      console.error('Error detecting placeholders:', error);
      message.error(t('解析模板文件失败'));
    }
  };

  // Add files to list (removed custom implementation, using useFileManager hook directly)
  // Auto-selection handled by useEffect


  // Handle add files (from UnifiedToolContainer or manual)
  const handleFilesAdd = async (files: any[]) => {
    if (files && files.length > 0) {
      const newFiles: TemplateFile[] = [];
      const disallowedFiles: string[] = [];

      files.forEach(f => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        if (ext === 'txt') {
          newFiles.push({
            uid: f.uid || Math.random().toString(36).substr(2, 9),
            name: f.name,
            path: f.path || (f.originFileObj && f.originFileObj.path),
            size: f.size,
            ext: ext,
            modifiedAt: new Date().toLocaleString(),
            status: 'success'
          });
        } else {
          disallowedFiles.push(f.name);
        }
      });

      if (disallowedFiles.length > 0) {
        message.warning(t('请导入带有[]占位符的txt模板文件'));
      }

      if (newFiles.length > 0) {
        addFiles(newFiles);
      }
    }
  };

  // Handle import from folder
  const handleImportFolder = async () => {
    if (!window.electron) return;
    try {
      const folderPath = await window.electron.selectDirectory();
      if (!folderPath) return;

      const files = await window.electron.getDirectoryFiles(folderPath);
      
      if (!files || !Array.isArray(files)) {
        throw new Error(t('获取文件列表失败'));
      }

      const processedFiles: TemplateFile[] = [];
      const disallowedFiles: string[] = [];

      files.forEach((f: any) => {
        const ext = f.name.split('.').pop()?.toLowerCase();
        if (ext === 'txt') {
          processedFiles.push({
            uid: Math.random().toString(36).substr(2, 9),
            name: f.name,
            path: f.path,
            size: f.size,
            ext: ext,
            modifiedAt: new Date().toLocaleString(),
            status: 'success'
          });
        } else {
          disallowedFiles.push(f.name);
        }
      });

      if (disallowedFiles.length > 0) {
        message.warning(t('请导入带有[]占位符的txt模板文件'));
      }

      if (processedFiles.length > 0) {
        addFiles(processedFiles);
        message.success(t('已导入 {{count}} 个 .txt 模板文件', { count: processedFiles.length }));
      } else {
        message.warning(t('该文件夹下未找到支持的 .txt 模板文件'));
      }
    } catch (err: any) {
      console.error('Import folder error:', err);
      message.error(t('导入文件夹失败: {{msg}}', { msg: err.message || t('未知错误') }));
    }
  };

  // Clear list
  const handleClearList = () => {
    if (templateFiles.length === 0) return;
    
    Modal.confirm({
      title: t('确认清空'),
      content: t('确定要清空当前所有已选模板吗？'),
      onOk: () => {
        clearAllFiles();
        setSelectedTemplatePath('');
        setPlaceholders([]);
      }
    });
  };


  // Handle excel selection for modal
  const handleSelectExcelForModal = async () => {
    if (!window.electron) return;
    try {
      const paths = await window.electron.selectFiles({
        title: t('选择数据源 Excel 文件'),
        filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls', 'csv'] }]
      });
      if (paths && paths.length > 0) {
        setNewMapping(prev => ({ ...prev, excelPath: paths[0] }));
        if (!newMapping.name) {
          const fileName = paths[0].split(/[\\/]/).pop()?.split('.')[0] || '';
          setNewMapping(prev => ({ ...prev, name: fileName }));
        }
        message.success(t('已选择 Excel 文件'));
      }
    } catch (error) {
      console.error('Select excel error:', error);
      message.error(t('选择 Excel 失败'));
    }
  };

  const handleBatchReplace = () => {
    if (!newMapping.headers || !placeholders.length) {
      message.warning(t('未检测到表头或模板占位符'));
      return;
    }
    
    const newAutoMapping: Record<string, string> = { ...(newMapping.mapping || {}) };
    let count = 0;
    
    // 遍历模板中的占位符 (e.g. "[姓名]", "{编号}")
    placeholders.forEach(p => {
      // 移除首尾括号进行匹配
      const cleanP = p.replace(/^\[|\]$|^\{|\}$/g, '').trim().toLowerCase();
      
      // 尝试在 Excel 表头中寻找匹配项
      // 匹配规则：完全一致、忽略大小写一致、包含关系
      const match = newMapping.headers?.find(h => {
        const cleanH = h.trim().toLowerCase();
        return cleanH === cleanP || 
               cleanH.includes(cleanP) ||
               cleanP.includes(cleanH);
      });
      
      if (match) {
        // 直接使用带括号的 p 作为 key，这样 Input 框中显示的就是 "[姓名]"
        newAutoMapping[p] = match;
        count++;
      }
    });
    
    if (count > 0) {
      setNewMapping(prev => ({ ...prev, mapping: newAutoMapping }));
      message.success(t('自动匹配完成，成功匹配 {{count}} 个字段', { count }));
    } else {
      message.warning(
        t('自动匹配完成，但未找到匹配的字段。请确保模板中的 [关键字] 与 Excel 表头名称一致。当前检测到模板占位符: {{placeholders}}', {
          placeholders: placeholders.join(', ') || t('无'),
        })
      );
    }
  };

  const handleSaveMapping = () => {
    if (!newMapping.name || !newMapping.excelPath) {
      message.error(t('请填写名称并选择数据文件'));
      return;
    }

    const mappingToSave = {
      ...newMapping,
      id: newMapping.id || Date.now().toString(),
      // 确保将用户在 Step 1 设置的关键字映射保存下来
    } as MappingConfig;

    if (newMapping.id) {
      setMappings(prev => prev.map(m => m.id === newMapping.id ? mappingToSave : m));
      message.success(t('对应关系更新成功'));
    } else {
      setMappings(prev => [...prev, mappingToSave]);
      message.success(t('对应关系创建成功'));
    }

    setSelectedMappingId(mappingToSave.id);
    setIsModalVisible(false);
    setModalStep(0);
    setNewMapping({
      name: '',
      excelPath: '',
      headerRow: 1,
      options: ['仅第一个工作表', '仅可见行'],
      processFirstSheetOnly: true,
      processVisibleRowsOnly: true,
      filenameGenerationType: 'column',
      filenameColumnIndex: 1,
      fileNameFormat: '',
      mapping: {}
    });
  };

  const handleNextInModal = async () => {
    if (modalStep === 0) {
      if (!newMapping.name || !newMapping.excelPath) {
        message.warning(t('请填写名称并选择 Excel 文件'));
        return;
      }
      try {
        console.log('Attempting to get excel headers for:', newMapping.excelPath);
        if (!window.electron || !window.electron.getExcelHeaders) {
          throw new Error('Electron API getExcelHeaders not found. Please restart the app.');
        }
        
        // 确保路径清理干净
        const cleanExcelPath = newMapping.excelPath.trim().replace(/^["']|["']$/g, '');
        type ExcelHeadersResult = string[] | { headers: string[]; sheetName: string };
        const headerResult: ExcelHeadersResult = await window.electron.getExcelHeaders(cleanExcelPath, newMapping.headerRow || 1);

        const headers: string[] = Array.isArray(headerResult) ? headerResult : headerResult.headers;
        const sheetName = Array.isArray(headerResult) ? undefined : headerResult.sheetName;
        
        console.log('Successfully got headers:', headers, 'from sheet:', sheetName);
        if (!headers || headers.length === 0) {
          throw new Error(t('Excel 文件中未检测到有效的表头数据，请检查文件内容。'));
        }

        const initialMapping: Record<string, string> = {};
        placeholders.forEach(p => {
          const cleanP = p.replace(/^\[|\]$|^\{|\}$/g, '').trim().toLowerCase();
          const match = headers.find((h: string) => {
            const cleanH = h.trim().toLowerCase();
            return cleanH === cleanP || 
                   cleanH.includes(cleanP) || 
                   cleanP.includes(cleanH);
          });
          if (match) initialMapping[p] = match;
        });
        
        setNewMapping(prev => ({ 
          ...prev, 
          excelPath: cleanExcelPath,
          headerRow: newMapping.headerRow || 1,
          sheetName,
          headers, 
          mapping: initialMapping,
          // 仅在新建（没有已保存的 fileNameFormat）且 headers 存在时设置默认值
          fileNameFormat: prev.fileNameFormat || (headers.length > 0 ? t('取第 {{index}} 列', { index: 1 }) : '')
        }));
        setModalStep(1);
      } catch (error: any) {
        console.error('Get headers error:', error);
        message.error(t('读取 Excel 失败: {{msg}}', { msg: error.message }));
      }
    } else {
      handleSaveMapping();
    }
  };

  const handleEditMapping = (record: MappingConfig) => {
    setNewMapping(record);
    setIsModalVisible(true);
    setModalStep(0);
  };

  const handleSelectOutputDir = async () => {
    if (!window.electron) return;
    try {
      const path = await window.electron.selectDirectory();
      if (path) {
        setOutputPath(path);
      }
    } catch (error) {
      console.error('Select output dir error:', error);
    }
  };

  const handleOpenOutputDir = () => {
    // 1. 优先打开手动设置的输出目录
    if (outputPath) {
      // @ts-ignore
      window.electron.openDirectory(outputPath);
      return;
    }
    // 2. 尝试打开第一个待处理文件所在的目录
    if (templateFiles.length > 0) {
      const firstFile = templateFiles[0].path;
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

  const handleProcess = async () => {
    requireAuth(async () => {
      if (!window.electron) return;
      
      const activeMapping = mappings.find(m => m.id === selectedMappingId);
      if (!activeMapping) {
        return message.warning(t('请选择一个对应关系'));
      }

      // 确定最终输出目录
      let finalOutputDir = outputPath;
      if (saveMode === 'overwrite') {
        finalOutputDir = selectedTemplatePath.substring(0, selectedTemplatePath.lastIndexOf('\\'));
      }

      // 冲突检测逻辑：仅在“目标目录相同 + 生成的文件名相同”时提示
      try {
        const api: any = (window.electron as any).checkTemplateConflicts;
        if (typeof api === 'function') {
          // 根据当前设置，推导与实际生成一致的文件名规则
          let finalFileNameFormat = activeMapping.fileNameFormat;
          if (activeMapping.filenameGenerationType === 'column') {
            const colIndex = activeMapping.filenameColumnIndex || 1;
            if (activeMapping.headers && colIndex > 0 && colIndex <= activeMapping.headers.length) {
              finalFileNameFormat = `[${activeMapping.headers[colIndex - 1]}]`;
            } else {
              finalFileNameFormat = activeMapping.headers && activeMapping.headers.length > 0 ? `[${activeMapping.headers[0]}]` : 'output';
            }
          }

          const conflictResult = await api({
            excelPath: activeMapping.excelPath,
            outputDir: finalOutputDir,
            fileNameFormat: finalFileNameFormat,
            outputExt: 'txt',
            headerRow: activeMapping.headerRow,
            sheetName: activeMapping.sheetName
          });

          if (conflictResult && conflictResult.hasConflict) {
            setConflictingFiles(conflictResult.conflictingFiles || []);
            setPendingProcessParams({ activeMapping, outputDir: finalOutputDir });
            setConflictModalVisible(true);
            return;
          }
        }
      } catch (e) {
        console.error('Check conflicts error:', e);
      }

      // 如果没有冲突，直接执行
      await executeProcessing(activeMapping, finalOutputDir, 'overwrite');
    });
  };

  // 抽离出的执行函数
  const executeProcessing = async (activeMapping: MappingConfig, outputDir: string, conflictAction: 'overwrite' | 'copy' = 'overwrite') => {
    setProcessing(true);
    setIsCompleted(false); // 开始处理时重置状态
    try {
      // Determine filename format
      let finalFileNameFormat = activeMapping.fileNameFormat;
      
      if (activeMapping.filenameGenerationType === 'column') {
        const colIndex = activeMapping.filenameColumnIndex || 1;
        if (activeMapping.headers && colIndex > 0 && colIndex <= activeMapping.headers.length) {
           finalFileNameFormat = `[${activeMapping.headers[colIndex - 1]}]`;
        } else {
           finalFileNameFormat = activeMapping.headers && activeMapping.headers.length > 0 ? `[${activeMapping.headers[0]}]` : 'output';
        }
      }

      const res = await window.electron.generateFromTemplate({
        templatePath: selectedTemplatePath,
        excelPath: activeMapping.excelPath,
        mapping: activeMapping.mapping,
        outputDir: outputDir,
        fileNameFormat: finalFileNameFormat,
        outputExt: 'txt', // 固定为 txt
        headerRow: activeMapping.headerRow,
        // singleTaskMode,
        sheetName: activeMapping.sheetName,
        conflictAction
      });
      setResult(res);
      setIsCompleted(true);
      message.success(`成功生成 ${res.successCount} 个文件`);
      // 更新输出目录状态，以便用户点击“打开目录”时能找到正确位置
      setOutputPath(outputDir);
    } catch (error: any) {
      console.error('Process error:', error);
      message.error(`生成失败: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f5f7fa' }}>
      <style>
        {`
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
        `}
      </style>

      {/* Unified Tool Container */}
      <div style={{ height: '100%', padding: '0 24px 32px 24px', overflowY: 'auto' }}>
        <UnifiedToolContainer
          // File List Props
          fileList={templateFiles}
          selectedFileKeys={selectedFileKeys}
          onSelectionChange={setSelectedFileKeys}
          onFilesAdd={handleFilesAdd}
          onFileRemove={(uid) => removeFile(uid)}
          onFilesRemoveBatch={removeSelectedFiles}
          onFilesClear={() => {
            clearAllFiles();
            setSelectedTemplatePath('');
            setPlaceholders([]);
          }}
          uploadHint={t('导入拥有[替换内容]占位的txt文件')}
          
          // Extra Header Actions
          extraHeaderActions={
            <Space>
              <Upload
                name="file"
                multiple
                showUploadList={false}
                accept=".txt"
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
          
          // Columns
          columns={[
            { 
              title: t('模板名称'), 
              dataIndex: 'name', 
              key: 'name', 
              ellipsis: true,
              render: (text) => <Space><FileTextOutlined style={{ color: '#1890ff' }} />{text}</Space>
            },
            { 
              title: t('大小'), 
              dataIndex: 'size', 
              key: 'size', 
              width: 100,
              render: (size: number) => (size / 1024).toFixed(2) + ' KB'
            },
            { 
              title: t('当前使用'), 
              key: 'selection', 
              width: 100,
              align: 'center',
              render: (_, record) => (
                <Radio 
                  checked={selectedTemplatePath === record.path}
                  onChange={() => {
                    setSelectedTemplatePath(record.path);
                    detectPlaceholders(record.path);
                  }}
                />
              )
            },
            {
              title: t('操作'),
              key: 'action',
              width: 60,
              render: (_, record) => (
                <Button 
                  type="text" 
                  danger 
                  size="small"
                  icon={<CloseOutlined />} 
                  onClick={() => {
                    removeFile(record.uid);
                    if (selectedTemplatePath === record.path) {
                      const remaining = templateFiles.filter(f => f.uid !== record.uid);
                      if (remaining.length > 0) {
                         setSelectedTemplatePath(remaining[0].path);
                         detectPlaceholders(remaining[0].path);
                      } else {
                         setSelectedTemplatePath('');
                         setPlaceholders([]);
                      }
                    }
                  }}
                />
              )
            }
          ]}
          
          // Settings Content
          settingsContent={
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              {selectedTemplatePath && (
                <div style={{ 
                  width: '100%',
                  padding: '8px 12px', 
                  background: placeholders.length > 0 ? '#f6ffed' : '#fff7e6', 
                  borderRadius: '6px',
                  border: `1px solid ${placeholders.length > 0 ? '#b7eb8f' : '#ffd591'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  {placeholders.length > 0 ? (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  ) : (
                    <InfoCircleOutlined style={{ color: '#faad14' }} />
                  )}
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <Text strong style={{ fontSize: '13px' }}>
                      {placeholders.length > 0
                        ? t('已识别占位符 ({{count}})：', { count: placeholders.length })
                        : t('未检测到占位符')}
                    </Text>
                    <Text type="secondary" style={{ fontSize: '12px' }} ellipsis>
                      {placeholders.length > 0 
                        ? placeholders.join(', ') 
                        : t('请确保模板中使用 [字段名] 或 {字段名} 格式')}
                    </Text>
                  </div>
                  {placeholders.length > 0 && <Tag color="success">{t('识别成功')}</Tag>}
                </div>
              )}
              
              <div style={{ flex: 1, minWidth: '300px' }}>
                <div style={{ marginBottom: 8, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Space><FileExcelOutlined style={{ color: '#52c41a' }} />{t('数据源与对应关系')}</Space>
                  <Button 
                    type="link" 
                    size="small" 
                    icon={<PlusOutlined />}
                    onClick={() => setIsModalVisible(true)}
                  >
                    {t('新建')}
                  </Button>
                </div>
                <Table
                  dataSource={mappings}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  scroll={{ y: 120 }}
                  columns={[
                    { title: t('名称'), dataIndex: 'name', key: 'name', ellipsis: true },
                    { 
                      title: t('选择'), 
                      key: 'selection', 
                      width: 60,
                      align: 'center',
                      render: (_, record) => (
                        <Radio 
                          checked={selectedMappingId === record.id}
                          onChange={() => setSelectedMappingId(record.id)}
                        />
                      )
                    },
                    { 
                      title: t('操作'), 
                      key: 'action', 
                      width: 90,
                      render: (_, record) => (
                        <Space size={0}>
                          <Button type="link" size="small" onClick={() => handleEditMapping(record)}>{t('编辑')}</Button>
                          <Button type="link" size="small" danger onClick={() => {
                            setMappings(prev => prev.filter(m => m.id !== record.id));
                            if (selectedMappingId === record.id) setSelectedMappingId('');
                          }}>{t('删除')}</Button>
                        </Space>
                      )
                    }
                  ]}
                  locale={{ emptyText: <Text type="secondary" style={{ fontSize: '12px' }}>{t('点击“新建”配置 Excel 数据')}</Text> }}
                  style={{ border: '1px solid #f0f0f0', borderRadius: '8px' }}
                />
              </div>
              
              <div style={{ width: 1, background: '#f0f0f0', margin: '0 12px' }} />
              
              <div style={{ flex: 1, minWidth: '300px' }}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}><Space><SettingOutlined style={{ color: '#faad14' }} />{t('输出设置')}</Space></div>
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 80, fontSize: '13px' }}>{t('保存方式：')}</span>
                    <Radio.Group 
                      size="small" 
                      value={saveMode} 
                      onChange={e => setSaveMode(e.target.value)}
                      optionType="button"
                      buttonStyle="solid"
                    >
                      <Radio.Button value="specific">{t('指定目录')}</Radio.Button>
                      <Radio.Button value="overwrite">{t('同级目录')}</Radio.Button>
                    </Radio.Group>
                  </div>

                  {saveMode === 'specific' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 80, fontSize: '13px' }}>{t('目录：')}</span>
                      <Input 
                        value={outputPath} 
                        readOnly 
                        size="small" 
                        placeholder={t('请选择保存目录')}
                        style={{ flex: 1, fontSize: '12px' }} 
                        prefix={<FolderOpenOutlined style={{ color: '#bfbfbf' }} />}
                      />
                      <Button size="small" onClick={handleSelectOutputDir}>{t('选择')}</Button>
                    </div>
                  )}
                </Space>
              </div>
            </div>
          }
          
          // Actions Content
          actionsContent={
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px' }}>
              <Button 
                size="large"
                onClick={handleOpenOutputDir}
                disabled={templateFiles.length === 0 && !outputPath}
              >
                {t('打开结果目录')}
              </Button>
              <Tooltip
                title={
                  !selectedTemplatePath
                    ? t('请先选择一个模板文件')
                    : !selectedMappingId
                      ? t('请先配置并选中一个 Excel 数据源')
                      : ''
                }
              >
                <div style={{ display: 'inline-block', cursor: (!selectedTemplatePath || !selectedMappingId) ? 'not-allowed' : 'default' }}>
                  <Button 
                    type="primary" 
                    size="large"
                    icon={<CheckCircleOutlined />} 
                    loading={processing}
                    disabled={!selectedTemplatePath || !selectedMappingId}
                    onClick={handleProcess}
                    style={{ minWidth: 120, pointerEvents: (!selectedTemplatePath || !selectedMappingId) ? 'none' : 'auto' }}
                  >
                    {t('开始生成文件')}
                  </Button>
                </div>
              </Tooltip>
            </div>
          }
        />
      </div>

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
          <Title level={3} style={{ marginBottom: 8 }}>{t('任务生成完成')}</Title>
          <Paragraph type="secondary" style={{ fontSize: '15px', marginBottom: 24 }}>
            {t('已根据模板和数据成功生成了')}{' '}
            <Text strong type="success" style={{ fontSize: '18px' }}>{result?.successCount || 0}</Text>{' '}
            {t('个文件')}
            {result?.failCount > 0 && (
              <>
                <br />
                {t('失败')}{' '}
                <Text strong type="danger">{result.failCount}</Text>{' '}
                {t('个')}
              </>
            )}
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
              {outputPath}
            </Text>
          </div>

          <Space size={16}>
            <Button 
              type="primary" 
              size="large" 
              icon={<FolderOpenOutlined />} 
              onClick={handleOpenOutputDir}
              style={{ height: 48, borderRadius: 24, padding: '0 32px', fontSize: 16 }}
            >
              {t('打开结果目录')}
            </Button>
            <Button 
              size="large" 
              onClick={() => {
                setIsCompleted(false);
                setResult(null);
              }}
              style={{ height: 48, borderRadius: 24, padding: '0 24px', fontSize: 16 }}
            >
              {t('关闭窗口')}
            </Button>
          </Space>
        </div>
      </Modal>

      {/* Conflict Modal */}
      <Modal
        title={
          <Space>
            <QuestionCircleOutlined style={{ color: '#faad14' }} />
            <span>{t('文件冲突检测')}</span>
          </Space>
        }
        open={conflictModalVisible}
        onCancel={() => setConflictModalVisible(false)}
        closable={true}
        maskClosable={false}
        width={500}
        footer={[
          <Button key="cancel" onClick={() => setConflictModalVisible(false)}>
            {t('取消返回')}
          </Button>,
          <Button 
            key="copy" 
            onClick={async () => {
              setConflictModalVisible(false);
              if (pendingProcessParams) {
                await executeProcessing(pendingProcessParams.activeMapping, pendingProcessParams.outputDir, 'copy');
              }
            }}
          >
            {t('跳过并创建副本')}
          </Button>,
          <Button 
            key="overwrite" 
            type="primary" 
            danger
            onClick={async () => {
              setConflictModalVisible(false);
              if (pendingProcessParams) {
                await executeProcessing(pendingProcessParams.activeMapping, pendingProcessParams.outputDir, 'overwrite');
              }
            }}
          >
            {t('覆盖原有文件')}
          </Button>
        ]}
      >
        <div style={{ padding: '8px 0' }}>
          <Paragraph>
            {t('检测到输出目录中已存在')}{' '}
            <Text strong type="danger">{conflictingFiles.length}</Text>{' '}
            {t('个同名文件。您希望如何处理这些冲突？')}
          </Paragraph>
          <div style={{ background: '#fffbe6', padding: '12px', borderRadius: '4px', border: '1px solid #ffe58f' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>{t('部分冲突文件：')}</Text>
            <ul style={{ margin: '8px 0 0', paddingLeft: '20px', maxHeight: '100px', overflowY: 'auto' }}>
              {conflictingFiles.map((f, i) => (
                <li key={i}><Text code>{f}.txt</Text></li>
              ))}
              {conflictingFiles.length >= 10 && <li><Text type="secondary">{t('... 等更多文件')}</Text></li>}
            </ul>
          </div>
          <div style={{ marginTop: 16 }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              • <Text strong>{t('覆盖')}</Text>：{t('直接替换已存在的文件')}<br />
              • <Text strong>{t('创建副本')}</Text>：{t('在冲突文件名后添加时间戳标识')}<br />
              • <Text strong>{t('取消')}</Text>：{t('中断本次生成操作')}
            </Text>
          </div>
        </div>
      </Modal>

      {/* New Mapping Modal */}
      <Modal
        title={newMapping.id ? t('编辑对应关系') : t('新建对应关系')}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setModalStep(0);
          setNewMapping({
            name: '',
            excelPath: '',
            headerRow: 1,
            options: ['仅第一个工作表', '仅可见行'],
            processFirstSheetOnly: true,
            processVisibleRowsOnly: true,
            filenameGenerationType: 'column',
            filenameColumnIndex: 1,
            fileNameFormat: '',
            mapping: {}
          });
        }}
        width={800}
        footer={[
          modalStep === 1 && (
            <Button key="prev" onClick={() => setModalStep(0)}>
              {t('上一步，选择数据文件')}
            </Button>
          ),
          <Button key="cancel" onClick={() => setIsModalVisible(false)}>
            {t('取消')}
          </Button>,
          <Button key="submit" type="primary" onClick={handleNextInModal}>
            {modalStep === 0 ? t('下一步，设置具体字段对应关系') : t('保存')}
          </Button>
        ]}
      >
        <Steps 
          current={modalStep} 
          items={[
            { title: t('选择数据文件') },
            { title: t('设置具体字段的对应关系') }
          ]}
          style={{ marginBottom: 24 }}
        />

        {modalStep === 0 && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div style={{ background: '#f0f5ff', padding: '12px', borderRadius: '4px' }}>
              <div style={{ marginBottom: 8 }}><Text type="danger">*</Text> {t('名称')}</div>
              <Input 
                value={newMapping.name} 
                onChange={e => setNewMapping(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t('输入对应关系名称')}
              />
            </div>
            
            <div style={{ background: '#f0f5ff', padding: '12px', borderRadius: '4px' }}>
              <div style={{ marginBottom: 8 }}><Text type="danger">*</Text> {t('Excel 数据文件')}</div>
              <Input 
                value={newMapping.excelPath} 
                readOnly
                placeholder={t('选择 Excel 文件')}
                suffix={<FolderOpenOutlined onClick={handleSelectExcelForModal} style={{ cursor: 'pointer' }} />}
              />
            </div>

            <div style={{ background: '#f0f5ff', padding: '12px', borderRadius: '4px' }}>
              <div style={{ marginBottom: 8 }}><Text type="danger">*</Text> {t('标题所在行号（最靠近数据正文的那一行）')}</div>
              <Input 
                type="number" 
                value={newMapping.headerRow} 
                onChange={e => setNewMapping(prev => ({ ...prev, headerRow: parseInt(e.target.value) || 1 }))}
              />
            </div>
          </Space>
        )}

        {modalStep === 1 && (
          <div style={{ padding: '0 20px' }}>
            <div style={{ background: '#f0f5ff', padding: '12px', borderRadius: '4px', marginBottom: 16 }}>
              <div style={{ marginBottom: 8, fontWeight: 'bold' }}>{t('处理选项')}</div>
              <Space>
                <Checkbox 
                  checked={newMapping.processFirstSheetOnly}
                  onChange={e => setNewMapping(prev => ({ ...prev, processFirstSheetOnly: e.target.checked }))}
                >
                  {t('只处理第一个工作表')}
                </Checkbox>
                <Checkbox 
                  checked={newMapping.processVisibleRowsOnly}
                  onChange={e => setNewMapping(prev => ({ ...prev, processVisibleRowsOnly: e.target.checked }))}
                >
                  {t('只处理可见的行')}
                </Checkbox>
              </Space>
            </div>

            <div style={{ background: '#f0f5ff', padding: '12px', borderRadius: '4px', marginBottom: 16 }}>
              <div style={{ marginBottom: 8, fontWeight: 'bold' }}>{t('最终生成的文件名类型')}</div>
              <Radio.Group 
                value={newMapping.filenameGenerationType}
                onChange={e => setNewMapping(prev => ({ ...prev, filenameGenerationType: e.target.value }))}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Radio value="column">
                    {t('将指定列的内容作为文件名')}
                  </Radio>
                  {newMapping.filenameGenerationType === 'column' && (
                    <div style={{ marginLeft: 24, marginTop: 4, marginBottom: 8 }}>
                      <Space align="center">
                        <Text type="danger">*</Text>
                        <span>
                          {t('文件名所在列')} (<Text type="danger">{t('请确保该列的内容唯一！')}</Text>)
                        </span>
                        <InputNumber 
                          min={1} 
                          max={newMapping.headers?.length || 100}
                          value={newMapping.filenameColumnIndex}
                          onChange={val => setNewMapping(prev => ({ ...prev, filenameColumnIndex: val || 1 }))}
                          style={{ width: 80 }}
                        />
                      </Space>
                    </div>
                  )}
                  
                  <Radio value="custom">
                    {t('自定义文件名规则')}
                  </Radio>
                  {newMapping.filenameGenerationType === 'custom' && (
                    <div style={{ marginLeft: 24, marginTop: 4 }}>
                      <div style={{ marginBottom: 4, fontSize: '12px', color: '#666' }}>
                        {t('请输入文件名规则，使用 [列名] 作为占位符，例如:')}{' '}
                        <Tag style={{ fontSize: 12 }}>[姓名]_通知书</Tag>
                      </div>
                      <Input 
                        style={{ width: '100%' }}
                        value={newMapping.fileNameFormat}
                        onChange={e => setNewMapping(prev => ({ ...prev, fileNameFormat: e.target.value }))}
                        placeholder={t('输入规则，如: [姓名]_[日期]')}
                      />
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>{t('点击下方列名快速插入：')}</Text>
                        <div style={{ marginTop: 4, maxHeight: '60px', overflowY: 'auto', border: '1px solid #eee', padding: '4px', borderRadius: '4px' }}>
                          <Space wrap size={[4, 4]}>
                            {newMapping.headers?.map((h) => (
                              <Tag 
                                key={h} 
                                onClick={() => {
                                  const current = newMapping.fileNameFormat || '';
                                  setNewMapping(prev => ({ ...prev, fileNameFormat: current + `[${h}]` }));
                                }}
                                style={{ cursor: 'pointer' }}
                              >
                                {h}
                              </Tag>
                            ))}
                          </Space>
                        </div>
                      </div>
                    </div>
                  )}
                </Space>
              </Radio.Group>
            </div>

            <div style={{ marginBottom: 8 }}>
              {t('填写数据表与模板的对应关系')}
            </div>
            
            <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
              <Collapse defaultActiveKey={['1']} ghost>
                <Collapse.Panel header={`1、${newMapping.excelPath?.split(/[\\/]/).pop()?.split('.')[0] || 'Sheet1'}`} key="1">
                  <Table 
                    dataSource={newMapping.headers?.map((h, i) => ({
                      index: i + 1, 
                      name: h,
                      key: h
                    })) || []}
                    pagination={false}
                    size="small"
                    bordered
                    columns={[
                      {
                        title: t('序号'),
                        dataIndex: 'index',
                        width: 80,
                        render: (val) => val
                      },
                      {
                        title: t('名称'),
                        dataIndex: 'name',
                        width: 150
                      },
                      {
                        title: t('类型'),
                        key: 'type',
                        width: 100,
                        render: () => (
                          <Select defaultValue="default" style={{ width: '100%' }} size="small">
                            <Select.Option value="default">{t('默认')}</Select.Option>
                            <Select.Option value="image">{t('图片')}</Select.Option>
                          </Select>
                        )
                      },
                      {
            title: (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{t('将模板中的以下文本关键字替换成数据表的内容')}</span>
                <Button type="primary" size="small" onClick={handleBatchReplace}>{t('批量替换')}</Button>
              </div>
            ),
            key: 'mapping',
            render: (_, record) => {
              // Find which placeholder maps to this column
              // Logic: Find entries where value === record.name (Excel Header)
              // This returns the placeholder key (e.g. "[姓名]")
              const placeholder = Object.entries(newMapping.mapping || {}).find(([p, col]) => col === record.name)?.[0] || '';
              return (
                <Input 
                  style={{ width: '100%' }}
                  placeholder={t('输入模板中的关键字，如 [姓名]')}
                  value={placeholder}
                  onChange={(e) => {
                    const val = e.target.value;
                    const updatedMapping = { ...(newMapping.mapping || {}) };
                    
                    // First, remove any existing mapping for this column (record.name)
                    // Because we are setting a NEW placeholder for THIS column.
                    // Wait, if I change the input for "Column A" from "[A]" to "[B]", 
                    // I should delete the entry for "[A]" and create one for "[B]".
                    
                    // 1. Find if this column was already mapped to something
                    const oldPlaceholder = Object.entries(updatedMapping).find(([p, col]) => col === record.name)?.[0];
                    if (oldPlaceholder) {
                      delete updatedMapping[oldPlaceholder];
                    }
                    
                    // 2. If new value is not empty, set it
                    if (val && val.trim()) {
                      // Also ensure this placeholder isn't already mapped to another column?
                      // If user types "[Name]" for Column A, but "[Name]" was mapped to Column B, 
                      // we should probably override it (last win).
                      updatedMapping[val] = record.name;
                    }
                    
                    setNewMapping(prev => ({ ...prev, mapping: updatedMapping }));
                  }}
                />
              );
            }
          }
                    ]}
                  />
                </Collapse.Panel>
              </Collapse>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
