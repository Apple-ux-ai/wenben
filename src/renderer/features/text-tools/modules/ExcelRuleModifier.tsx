import React, { useState } from 'react';
import { 
  FileExcelOutlined,
  CloudUploadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  SettingOutlined,
  FolderOpenOutlined,
  CheckCircleOutlined,
  EditOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { 
  Card, 
  Button, 
  Table, 
  Typography, 
  Space, 
  Alert, 
  message,
  Switch,
  Radio,
  Input,
  Tooltip,
  Tag,
  Modal,
  Checkbox,
  Divider
} from 'antd';
import { useAuth } from '../../../context/AuthContext';
import { UnifiedToolContainer } from '../components/UnifiedToolContainer';
import { useT } from '../../../i18n';

import { DirectoryListExtractor } from './DirectoryListExtractor';

const { Title, Text, Paragraph } = Typography;

interface ExcelRule {
  path: string;
  find: string;
  replace: string;
  isRegex: boolean;
  isMultiline: boolean;
  ignoreCase: boolean;
  wholeWord: boolean;
}

interface FileWithRules {
  uid: string;
  name: string;
  path: string;
  size: number;
  status: 'pending' | 'processing' | 'success' | 'error';
  rules: ExcelRule[];
}

export const ExcelRuleModifier: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { requireAuth } = useAuth();
  const t = useT();
  const [dataList, setDataList] = useState<FileWithRules[]>([]);
  const [keepWhitespace, setKeepWhitespace] = useState(false);
  const [outputType, setOutputType] = useState<'overwrite' | 'new_folder'>('new_folder');
  const [outputPath, setOutputPath] = useState('');
  const [maintainDirStructure, setMaintainDirStructure] = useState(false);
  const [singleTaskMode, setSingleTaskMode] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [isExtractorModalVisible, setIsExtractorModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FileWithRules | null>(null);
  const [editFormRules, setEditFormRules] = useState<ExcelRule[]>([]);

  const [pptConfig, setPptConfig] = useState({
    range: ['text'] as string[]
  });

  const hasPpt = React.useMemo(
    () => dataList.some(item => item.path.toLowerCase().endsWith('.pptx')),
    [dataList]
  );

  // ... (中间的逻辑函数保持不变，跳过到 return 部分进行布局重构)

  // 编辑规则
  const handleEdit = (record: FileWithRules) => {
    setEditingRecord(record);
    setEditFormRules([...record.rules]);
    setIsEditModalVisible(true);
  };

  // 保存编辑
  const handleSaveEdit = () => {
    if (!editingRecord) return;
    
    // 检查是否有空的“替换为”内容
    const hasEmptyReplace = editFormRules.some(rule => !rule.replace);
    
    if (hasEmptyReplace) {
      Modal.confirm({
        title: t('替换内容为空'),
        content: t('检测到部分规则的“替换为”内容为空。这意味着匹配到的内容将被直接删除，输出结果可能与原结果相同。是否确认保存？'),
        okText: t('确认保存'),
        cancelText: t('返回修改'),
        onOk: () => {
          performSave();
        }
      });
    } else {
      performSave();
    }
  };

  // 真正执行保存的逻辑
  const performSave = () => {
    if (!editingRecord) return;
    const newDataList = dataList.map(item => {
      if (item.uid === editingRecord.uid) {
        return { ...item, rules: editFormRules };
      }
      return item;
    });
    
    setDataList(newDataList);
    setIsEditModalVisible(false);
    message.success(t('规则更新成功'));
  };

  // 添加新规则行
  const handleAddRuleRow = () => {
    const newRule: ExcelRule = {
      path: editingRecord?.path || '',
      find: '',
      replace: '',
      isRegex: false,
      isMultiline: false,
      ignoreCase: true,
      wholeWord: false
    };
    setEditFormRules([...editFormRules, newRule]);
  };

  // 移除规则行
  const handleRemoveRuleRow = (index: number) => {
    const newRules = [...editFormRules];
    newRules.splice(index, 1);
    setEditFormRules(newRules);
  };

  // 更新规则字段
  const updateRuleField = (index: number, field: keyof ExcelRule, value: any) => {
    const newRules = [...editFormRules];
    newRules[index] = { ...newRules[index], [field]: value };
    setEditFormRules(newRules);
  };

  // 从 Excel 导入
  const handleImportExcel = async (path?: string) => {
    if (!window.electron) return;
    try {
      let filePath = path;
      if (!filePath) {
        const filePaths = await window.electron.selectFiles({
          title: t('选择 Excel 规则文件'),
          filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }]
        });
        if (filePaths && filePaths.length > 0) {
          filePath = filePaths[0];
        }
      }

      if (filePath) {
        const fileExt = filePath.split('.').pop()?.toLowerCase();
        if (!['xlsx', 'xls'].includes(fileExt || '')) {
          message.error(t('请导入合法的 Excel 文件，或点击‘下载模板’查看规则，也可以点击‘提取路径清单’自动生成。'));
          return;
        }

        const msgKey = 'importing';
        message.loading({ content: t('正在解析 Excel...'), key: msgKey });
        
        const rawData = await window.electron.parseExcelRules(filePath);
        
        console.log('Renderer: Received raw data from excel:', rawData);

        // 确保 rawData 是数组
        let rows: any[] = [];
        if (Array.isArray(rawData)) {
          rows = rawData;
        } else if (rawData && typeof rawData === 'object' && Array.isArray((rawData as any).data)) {
          rows = (rawData as any).data;
        }

        if (rows.length === 0 || !rows[0].hasOwnProperty('path') || !rows[0].hasOwnProperty('find')) {
          message.error({ content: t('请导入合法的 Excel 文件，或点击‘下载模板’查看规则，也可以点击‘提取路径清单’自动生成。'), key: msgKey, duration: 5 });
          return;
        }
        
        // 按路径合并规则
        const groupedMap = new Map<string, ExcelRule[]>();
        rows.forEach((item: any) => {
          if (!item.path) return;
          if (!groupedMap.has(item.path)) {
            groupedMap.set(item.path, []);
          }
          groupedMap.get(item.path)!.push(item);
        });

        const formattedData: FileWithRules[] = Array.from(groupedMap.entries()).map(([path, rules], index) => {
          const fileName = path.split(/[\\/]/).pop() || 'unknown';
          return {
            uid: String(index + 1),
            name: fileName,
            path,
            size: 0,
            status: 'success' as const,
            rules
          };
        });

        setDataList(formattedData);
        message.success({ content: t('成功导入 {{count}} 个文件的规则', { count: formattedData.length }), key: msgKey });
        setIsExtractorModalVisible(false); // 如果是从弹窗导入的，关闭弹窗
      }
    } catch (error: any) {
      console.error('Import error:', error);
      message.error(t('导入失败：{{msg}}', { msg: error?.message || t('请检查 Excel 格式是否正确') }));
    }
  };

  // 下载模板
  const handleDownloadTemplate = async () => {
    if (!window.electron) return;
    try {
      const filePath = await window.electron.showSaveDialog({
        title: t('保存 Excel 模板'),
        defaultPath: t('文本修改规则模板.xlsx'),
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
      });
      if (filePath) {
        await window.electron.generateExcelTemplate(filePath);
        message.success(t('模板下载成功'));
      }
    } catch (error) {
      console.error('Download template error:', error);
      message.error(t('下载失败'));
    }
  };

  // 提取路径清单
  const handleExtractPaths = () => {
    setIsExtractorModalVisible(true);
  };

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) return;
    
    Modal.confirm({
      title: t('确认删除'),
      content: t('确定要删除选中的 {{count}} 项吗？', { count: selectedRowKeys.length }),
      okText: t('确认'),
      cancelText: t('取消'),
      onOk: () => {
        const newDataList = dataList.filter(item => !selectedRowKeys.includes(item.uid));
        setDataList(newDataList);
        setSelectedRowKeys([]);
        message.success(t('批量删除成功'));
      }
    });
  };

  // 执行处理
  const handleProcess = async () => {
    requireAuth(async () => {
      if (!window.electron || dataList.length === 0) return;
      
      setProcessing(true);
      try {
        const options = {
          outputType,
          outputDir: outputPath,
          keepWhitespace,
          maintainDirStructure,
          singleTaskMode,
          pptConfig
        };
        
        const res = await window.electron.processExcelBatch(dataList, options);
        
        if (res.results) {
          const successCount = res.results.filter((r: any) => r.success).length;
          const failCount = res.results.length - successCount;
          
          if (failCount === 0) {
            message.success(t('处理完成！共成功处理 {{count}} 个文件。', { count: successCount }));
            setIsCompleted(true);
          } else {
            message.warning(t('处理完成。成功: {{success}}, 失败: {{fail}}', { success: successCount, fail: failCount }));
            setIsCompleted(true);
          }
        }
      } catch (error: any) {
        message.error(t('处理失败: {{msg}}', { msg: error.message }));
      } finally {
        setProcessing(false);
      }
    });
  };

  const handleOpenOutputDir = () => {
    // 1. 优先打开手动设置的输出目录
    if (outputType === 'new_folder' && outputPath) {
      // @ts-ignore
      window.electron.openDirectory(outputPath);
      return;
    }
    
    // 2. 尝试打开第一个文件所在的目录
    if (dataList.length > 0) {
      const firstFile = dataList[0].path;
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
    { title: t('序号'), dataIndex: 'uid', key: 'uid', width: 80 },
    { title: t('路径'), dataIndex: 'path', key: 'path' },
    { 
      title: t('规则'), 
      dataIndex: 'rules', 
      key: 'rules',
      render: (rules: ExcelRule[]) => (
        <Space direction="vertical" size={0}>
          {rules.map((r, i) => (
            <div key={i}>
              <Tag color="blue">{r.isRegex ? t('正则') : t('精确')}</Tag>
              {r.find ? (
                <Text code>{r.find}</Text>
              ) : (
                <Tooltip title={t('查找内容为空，此规则无效')}>
                  <Text type="danger" style={{ fontStyle: 'italic', fontSize: '12px' }}>[无搜索内容]</Text>
                </Tooltip>
              )}
               {' -> '} 
              {r.replace ? (
                <Text code>{r.replace}</Text>
              ) : (
                <Tooltip title={t('替换内容为空，匹配项将被删除')}>
                  <Text type="warning" style={{ fontStyle: 'italic', fontSize: '12px' }}>[空]</Text>
                </Tooltip>
              )}
            </div>
          ))}
        </Space>
      )
    },
    {
      title: t('操作'),
      key: 'action',
      width: 180,
      render: (_: any, record: FileWithRules) => (
        <Space>
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          >
            {t('编辑')}
          </Button>
          <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />} 
            onClick={() => setDataList(dataList.filter(item => item.uid !== record.uid))}
          >
            {t('移除')}
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 32px 24px' }}>
      <UnifiedToolContainer
        fileList={dataList}
        selectedFileKeys={selectedRowKeys}
        onSelectionChange={(keys) => setSelectedRowKeys(keys)}
        onFilesAdd={(files) => {
          if (files && files.length > 0) {
            const path = files[0].path || (files[0].originFileObj && files[0].originFileObj.path);
            if (path) handleImportExcel(path);
          }
        }}
        onFileRemove={(uid) => {
          setDataList(dataList.filter(f => f.uid !== uid));
          setSelectedRowKeys(prevKeys => prevKeys.filter(key => key !== uid));
        }}
        onFilesRemoveBatch={handleBatchDelete}
        onFilesClear={() => {
          setDataList([]);
          setSelectedRowKeys([]);
        }}
        uploadHint={t('暂无数据，请先上传 Excel 规则文件')}
        accept=".xlsx,.xls"
        extraHeaderActions={
          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
              {t('下载模板')}
            </Button>
            <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => handleImportExcel()}>
              {t('上传 Excel 规则')}
            </Button>
            <Button icon={<PlusOutlined />} onClick={handleExtractPaths}>
              {t('提取路径清单')}
            </Button>
          </Space>
        }
        columns={columns}
        settingsContent={
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
            {/* 左侧：参数设置 */}
            <div>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <SettingOutlined style={{ color: '#faad14' }} />
                <Typography.Text strong>{t('处理选项')}</Typography.Text>
              </div>
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13 }}>{t('保留规则前后空白')}</Text>
                  <Switch size="small" checked={keepWhitespace} onChange={setKeepWhitespace} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13 }}>{t('保持目录结构')}</Text>
                  <Switch size="small" checked={maintainDirStructure} onChange={setMaintainDirStructure} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13 }}>{t('单任务稳定模式')}</Text>
                  <Switch size="small" checked={singleTaskMode} onChange={setSingleTaskMode} />
                </div>
                {hasPpt && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13 }}>{t('PPT母版处理')}</Text>
                    <Checkbox 
                      checked={pptConfig.range.includes('master')} 
                      onChange={e => {
                        const newRange = e.target.checked 
                          ? [...pptConfig.range, 'master', 'layout'] 
                          : pptConfig.range.filter(r => r !== 'master' && r !== 'layout');
                        setPptConfig({ ...pptConfig, range: newRange });
                      }}
                    />
                  </div>
                )}
              </Space>
            </div>

            {/* 右侧：输出设置 */}
            <div>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <DownloadOutlined style={{ color: '#52c41a' }} />
                <Typography.Text strong>{t('输出设置')}</Typography.Text>
              </div>
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                <div style={{ background: '#f5f7fa', padding: '12px', borderRadius: 8 }}>
                  <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>{t('保存方式')}</Typography.Text>
                  <Radio.Group 
                    value={outputType} 
                    onChange={e => setOutputType(e.target.value)}
                  >
                    <Space size={24}>
                      <Radio value="new_folder">{t('指定目录')}</Radio>
                      <Radio value="overwrite">{t('覆盖原文件')}</Radio>
                    </Space>
                  </Radio.Group>
                </div>

                {outputType === 'new_folder' && (
                  <Space.Compact style={{ width: '100%' }}>
                    <Input 
                      value={outputPath} 
                      placeholder={t('选择保存位置...')}
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
                )}
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
              disabled={dataList.length === 0 && (outputType === 'overwrite' || !outputPath)}
              style={{ height: 50, borderRadius: 25, padding: '0 24px' }}
            >
              {t('打开结果目录')}
            </Button>
            <Button 
              type="primary" 
              size="large" 
              icon={processing ? <SettingOutlined spin /> : <CheckCircleOutlined />} 
              loading={processing}
              disabled={dataList.length === 0}
              style={{ height: 50, borderRadius: 25, padding: '0 40px', fontSize: 16, fontWeight: 600, boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)' }}
              onClick={handleProcess}
            >
              {processing ? t('正在处理...') : t('开始执行批量修改')}
            </Button>
          </div>
        }
      />

      <Modal
        title={t('提取文件夹路径名称清单')}
        open={isExtractorModalVisible}
        onCancel={() => setIsExtractorModalVisible(false)}
        footer={null}
        width={1000}
        destroyOnHidden
      >
        <DirectoryListExtractor 
          isModal 
          onImport={(path) => handleImportExcel(path)} 
          onClose={() => setIsExtractorModalVisible(false)}
        />
      </Modal>

      <Modal
        title={t('编辑修改规则')}
        open={isEditModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => setIsEditModalVisible(false)}
        width={800}
        destroyOnHidden
        okText={t('保存修改')}
        cancelText={t('取消')}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>{t('文件路径:')} </Text>
          <Text type="secondary">{editingRecord?.path}</Text>
        </div>
        
        <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '8px' }}>
          {editFormRules.map((rule, index) => (
            <Card 
              key={index} 
              size="small" 
              style={{ marginBottom: 12, background: '#fafafa' }}
              title={t('规则 {{index}}', { index: index + 1 })}
              extra={
                <Button 
                  type="text" 
                  danger 
                  icon={<DeleteOutlined />} 
                  onClick={() => handleRemoveRuleRow(index)}
                  disabled={editFormRules.length <= 1}
                />
              }
            >
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                 <div style={{ flex: 1 }}>
                   <div style={{ marginBottom: 4 }}>
                     <Text type="secondary" style={{ fontSize: '12px' }}>{t('查找内容')}</Text>
                     {!rule.find && (
                       <Text type="danger" style={{ fontSize: '12px', marginLeft: '8px' }}>
                         {t('(必须填写查找内容)')}
                       </Text>
                     )}
                   </div>
                   <Input.TextArea 
                     rows={2}
                     value={rule.find} 
                     onChange={e => updateRuleField(index, 'find', e.target.value)} 
                     placeholder={t('请输入要查找的文本')}
                   />
                 </div>
                 <div style={{ flex: 1 }}>
                   <div style={{ marginBottom: 4 }}>
                     <Text type="secondary" style={{ fontSize: '12px' }}>{t('替换为')}</Text>
                     {!rule.replace && (
                       <Text type="warning" style={{ fontSize: '12px', marginLeft: '8px' }}>
                         {t('(为空则删除匹配内容)')}
                       </Text>
                     )}
                   </div>
                   <Input.TextArea 
                     rows={2}
                     value={rule.replace} 
                     onChange={e => updateRuleField(index, 'replace', e.target.value)} 
                     placeholder={t('请输入替换后的文本（留空则为删除）')}
                   />
                 </div>
               </div>
              
              <Space wrap>
                <Checkbox 
                  checked={rule.isRegex} 
                  onChange={e => updateRuleField(index, 'isRegex', e.target.checked)}
                >
                  {t('正则表达式')}
                </Checkbox>
                <Checkbox 
                  checked={rule.ignoreCase} 
                  onChange={e => updateRuleField(index, 'ignoreCase', e.target.checked)}
                >
                  {t('忽略大小写')}
                </Checkbox>
                <Checkbox 
                  checked={rule.wholeWord} 
                  onChange={e => updateRuleField(index, 'wholeWord', e.target.checked)}
                >
                  {t('整词匹配')}
                </Checkbox>
                <Checkbox 
                  checked={rule.isMultiline} 
                  onChange={e => updateRuleField(index, 'isMultiline', e.target.checked)}
                >
                  {t('多行模式')}
                </Checkbox>
              </Space>
            </Card>
          ))}
        </div>
        
        <Button 
          type="dashed" 
          block 
          icon={<PlusOutlined />} 
          onClick={handleAddRuleRow}
          style={{ marginTop: 8 }}
        >
          {t('添加新规则')}
        </Button>
      </Modal>
    </div>
  );
};
