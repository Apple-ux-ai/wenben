import React, { useState } from 'react';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  SaveOutlined,
  PlayCircleOutlined,
  InboxOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  SettingOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  EllipsisOutlined,
  CopyOutlined,
  ExportOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  QuestionCircleOutlined,
  FileSearchOutlined,
  FileAddOutlined,
  FolderAddOutlined,
  ClearOutlined
} from '@ant-design/icons';
import { 
  Card, 
  Button, 
  Input, 
  Radio, 
  Space, 
  List, 
  Typography, 
  Divider, 
  Upload, 
  Table, 
  Tag, 
  message,
  Checkbox,
  Tooltip,
  Alert,
  Modal,
  Select,
  Switch,
  ColorPicker,
  Dropdown,
  MenuProps,
  Tabs,
  Popconfirm
} from 'antd';
import { useT } from '../../../i18n';
import { useAuth } from '../../../context/AuthContext';
import { UnifiedToolContainer } from '../components/UnifiedToolContainer';

const { Dragger } = Upload;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface Rule {
  id: string;
  source: 'quick' | 'manager';
  type: 'exact' | 'regex' | 'batch_exact' | 'batch_regex';
  find: string;
  replace: string;
  name?: string;
  description?: string;
  tags?: string[];
  caseSensitive?: boolean;
  wholeWord?: boolean;
  localGeneralRules?: Rule[]; // 每个槽位独立的规则库
}

const getDefaultGeneralRules = (t: (key: string, params?: Record<string, string | number>) => string): Rule[] => [
  {
    id: 'gen-1',
    source: 'manager',
    name: t('删除所有数字'),
    type: 'regex',
    find: '\\d+',
    replace: '',
    description: t('查找并替换文本，查找类型：模糊文本，描述：删除正则表达式【\\d+】匹配的内容'),
    tags: [t('默认')]
  },
  {
    id: 'gen-2',
    source: 'manager',
    name: t('文字替换'),
    type: 'exact',
    find: t('我们'),
    replace: t('你们'),
    description: t('查找并替换文本，查找类型：精确文本，描述：将内容【我们】替换为【你们】'),
    tags: [t('默认')]
  },
  {
    id: 'gen-3',
    source: 'manager',
    name: t('英文单词替换'),
    type: 'exact',
    find: 'this',
    replace: 'that',
    description: t('查找并替换文本，查找类型：精确文本，描述：将内容【this】替换为【that】，附加选项：【忽略大小写】【全字匹配】'),
    tags: [t('默认')],
    caseSensitive: false,
    wholeWord: true
  },
  {
    id: 'gen-4',
    source: 'manager',
    name: t('手机号替换'),
    type: 'regex',
    find: '\\d{11}',
    replace: '13000000000',
    description: t('查找并替换文本，查找类型：模糊文本，描述：使用正则表达式【\\d{11}】匹配内容，并替换为【13000000000】'),
    tags: [t('默认')]
  },
  {
    id: 'gen-5',
    source: 'manager',
    name: t('去掉中文'),
    type: 'regex',
    find: '[\\u4e00-\\u9fa5]',
    replace: '',
    description: t('查找并替换文本，查找类型：模糊文本，描述：删除正则表达式【[\\u4e00-\\u9fa5]】匹配的内容'),
    tags: [t('默认')]
  }
];

export const RuleBasedModifier: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const t = useT();
  const { requireAuth } = useAuth();
  const [fileList, setFileList] = useState<any[]>([]);
  const [rules, setRules] = useState<Rule[]>([{
    id: '1',
    source: 'quick',
    type: 'exact',
    find: '',
    replace: '',
    localGeneralRules: [...getDefaultGeneralRules(t)]
  }]);
  const [outputPath, setOutputPath] = useState<string>('');
  const [outputType, setOutputType] = useState<'overwrite' | 'new_folder'>('new_folder');
  const [processing, setProcessing] = useState(false);
  const [resultOutputPath, setResultOutputPath] = useState<string>('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 每个规则槽位独立的管理器选中项映射 { ruleId: selectedKeys[] }
  const [selectedManagerKeysMap, setSelectedManagerKeysMap] = useState<Record<string, React.Key[]>>({});
  
  const [backupBeforeModify, setBackupBeforeModify] = useState(false);
  const [skipHiddenFiles, setSkipHiddenFiles] = useState(true);
  const [continueOnError, setContinueOnError] = useState(true);
  const [targetEncoding, setTargetEncoding] = useState('auto'); // 'auto', 'utf-8', 'gbk'

  const [isRulesModalVisible, setIsRulesModalVisible] = useState(false);
  const [isFormatModalVisible, setIsFormatModalVisible] = useState(false);
  const [isOutputModalVisible, setIsOutputModalVisible] = useState(false);
  const [isFolderModalVisible, setIsFolderModalVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    field: 'path', // 默认按路径排序
    order: 'ascend' as 'ascend' | 'descend'
  });
  const [filterConfig, setFilterConfig] = useState({
    nameKeyword: '',
    extensions: [] as string[]
  });
  
  const displayFileList = React.useMemo(() => {
    let list = [...fileList];

    // 1. 过滤
    if (filterConfig.nameKeyword) {
      const keyword = filterConfig.nameKeyword.toLowerCase();
      list = list.filter(f => f.name.toLowerCase().includes(keyword));
    }
    if (filterConfig.extensions.length > 0) {
      list = list.filter(f => {
        const ext = (f.ext || '').toLowerCase();
        return filterConfig.extensions.includes(ext);
      });
    }

    // 2. 排序 (模拟 Windows 资源管理器自然排序)
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    
    list.sort((a, b) => {
      let valA, valB;
      
      switch (sortConfig.field) {
        case 'name':
          valA = a.name || '';
          valB = b.name || '';
          break;
        case 'path':
          valA = a.path || '';
          valB = b.path || '';
          break;
        case 'ext':
          valA = a.ext || '';
          valB = b.ext || '';
          break;
        case 'birthtime':
          valA = a.birthtimeTimestamp || 0;
          valB = b.birthtimeTimestamp || 0;
          break;
        case 'modifiedAt':
          valA = a.modifiedTimestamp || 0;
          valB = b.modifiedTimestamp || 0;
          break;
        default:
          valA = a.path || '';
          valB = b.path || '';
      }

      let comparison = 0;
      if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = collator.compare(valA, valB);
      } else {
        comparison = (valA as number) - (valB as number);
      }

      return sortConfig.order === 'ascend' ? comparison : -comparison;
    });

    return list;
  }, [fileList, sortConfig, filterConfig]);

  const [wordConfig, setWordConfig] = useState({
    highlight: false,
    highlightColor: '#ffff00'
  });
  const [excelConfig, setExcelConfig] = useState({
    range: ['cell', 'sheetName'],
    formulaType: 'no_limit',
    formulaProcess: 'calculated',
    dataTypes: ['text', 'number', 'logic', 'datetime'],
    numberTarget: 'display',
    dateTarget: 'display',
    failedConversion: 'to_text',
    highlight: false,
    highlightColor: '#ffff00'
  });
  const [pptConfig, setPptConfig] = useState({
    range: ['text'],
    highlight: false,
    highlightColor: '#ffff00'
  });
  const [otherConfig, setOtherConfig] = useState({
    keepWhitespace: true
  });

  const [previewPaths, setPreviewPaths] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const showImportPreview = (paths: string[]) => {
    if (paths.length === 0) {
      message.warning(t('未检测到有效的文件路径'));
      return;
    }
    setPreviewPaths(paths);
    setPreviewVisible(true);
  };

  const COLOR_PRESETS = [
    { label: t('常用颜色'), colors: ['#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#0000ff', '#ff0000', '#000080', '#008080', '#008000', '#800080', '#800000', '#808000', '#808080', '#c0c0c0', '#000000'] }
  ];

  const [regexHistory, setRegexHistory] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('ruleModifierRegexHistory');
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return [];
  });

  const COMMON_REGEX = [
    { label: t('11位手机号'), value: '\\d{11}' },
    { label: t('邮箱地址'), value: '[\\w.-]+@[\\w.-]+' },
    { label: t('所有数字'), value: '\\d+' },
    { label: t('中文字符'), value: '[\\u4e00-\\u9fa5]+' }
  ];

  const detectedTypes = {
    hasWord: fileList.some(f => /\.(docx|doc)$/i.test(f.name)),
    hasExcel: fileList.some(f => /\.(xlsx|xls|csv)$/i.test(f.name)),
    hasPpt: fileList.some(f => /\.(pptx|ppt)$/i.test(f.name)),
    hasOther: fileList.some(f => !/\.(docx|doc|xlsx|xls|csv|pptx|ppt)$/i.test(f.name))
  };

  const defaultFormatTabKey = detectedTypes.hasWord
    ? 'word'
    : detectedTypes.hasExcel
    ? 'excel'
    : detectedTypes.hasPpt
    ? 'ppt'
    : 'other';

  const [folderFiles, setFolderFiles] = useState<any[]>([]);
  const [selectedFolderKeys, setSelectedFolderKeys] = useState<React.Key[]>([]);
  const [folderScanning, setFolderScanning] = useState(false);
  const [showAllFolderFiles, setShowAllFolderFiles] = useState(false);
  const [folderSearchKeyword, setFolderSearchKeyword] = useState('');

  // 批量添加路径到列表
  const addPathsToFileList = async (paths: string[], isBatch: boolean = false) => {
    if (!window.electron) return;
    
    // 扩展支持的格式
    const validExtensions = [
      '.txt', '.html', '.json', '.xml', '.csv', '.docx'
    ];
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB 限制
    
    let addedCount = 0;
    let skipCount = 0;
    
    const currentPaths = new Set(fileList.map(f => f.path));
    const newFiles: any[] = [];
    
    // 递归处理所有路径
    const processPaths = async (targetPaths: any[]) => {
      // 使用并行处理提高效率
      const tasks = targetPaths.map(async (p) => {
        try {
          const rawPath = typeof p === 'string' ? p : p?.path;
          if (!rawPath || typeof rawPath !== 'string') return;
          
          const cleanPath = rawPath.trim().replace(/^["']|["']$/g, '');
          if (!cleanPath || currentPaths.has(cleanPath)) return;
          
          const info = await window.electron.getFileInfo(cleanPath);
          
          if (info.isDirectory) {
            const subPaths = await window.electron.getDirectoryFiles(cleanPath);
            if (subPaths && subPaths.length > 0) {
              await processPaths(subPaths);
            }
            return;
          }
          
          const ext = (info.ext || '').toLowerCase();
          // 容错处理：支持带点和不带点的后缀比较
          const isSupported = validExtensions.includes(ext) || 
                             validExtensions.includes(`.${ext}`) ||
                             validExtensions.map(e => e.replace('.', '')).includes(ext);

          if (validExtensions.length > 0 && !isSupported) {
            if (!isBatch) console.warn(`跳过不支持的格式: ${cleanPath} (后缀: ${ext})`);
            skipCount++;
            return;
          }
          
          if (info.sizeBytes > MAX_FILE_SIZE) {
            if (!isBatch) console.warn(`跳过超大文件: ${cleanPath} (大小: ${info.size})`);
            skipCount++;
            return;
          }
          
          newFiles.push({
            uid: Math.random().toString(36).substr(2, 9),
            name: cleanPath.split(/[\\/]/).pop(),
            size: info.size,
            sizeBytes: info.sizeBytes,
            path: cleanPath,
            ext: info.ext,
            modifiedAt: info.modifiedAt
          });
          currentPaths.add(cleanPath);
          addedCount++;
        } catch (err) {
          console.error(`处理路径出错:`, err);
          skipCount++;
        }
      });
      
      await Promise.all(tasks);
    };
    
    await processPaths(paths);
    
    if (newFiles.length > 0) {
      setFileList(prev => [...prev, ...newFiles]);
    }
    
    if (addedCount > 0) {
      message.success(t('成功导入 {{count}} 个文件', { count: addedCount }));
    }
    if (skipCount > 0 && !isBatch) {
      message.warning(t('{{count}} 个路径因格式不支持、文件过大或不存在而被跳过', { count: skipCount }));
    }
  };

  // 从文件中读取路径并导入
  const handleImportFromPathsFile = async () => {
    if (!window.electron) return;
    try {
      const filePaths = await window.electron.selectFiles({
        title: t('选择包含路径的文本文件'),
        filters: [{ name: t('路径列表文件'), extensions: ['txt', 'csv', 'log'] }]
      });
      
      if (filePaths && filePaths.length > 0) {
        const content = await window.electron.readFile(filePaths[0]);
        let paths: string[] = [];
        
        if (filePaths[0].toLowerCase().endsWith('.csv')) {
          // 简单的 CSV 解析逻辑：支持逗号分隔或换行符分隔
          // 移除引号并处理可能的转义
          paths = content
            .split(/[\r\n,]+/)
            .map(p => p.trim().replace(/^["']|["']$/g, ''))
            .filter(p => p !== '');
        } else {
          paths = content.split(/\r?\n/).map(line => line.trim().replace(/^["']|["']$/g, '')).filter(line => line !== '');
        }
        
        showImportPreview(paths);
      }
    } catch (error) {
      console.error('Import from file error:', error);
      message.error(t('从文件导入路径失败'));
    }
  };

  // 从系统剪切板中自动导入路径
  const handleImportFromClipboard = async () => {
    if (!window.electron) return;
    try {
      const text = await window.electron.getClipboardText();
      if (!text || !text.trim()) {
        message.warning(t('剪切板内容为空，请先复制文件或文件夹路径'));
        return;
      }
      
      // 增强的路径提取逻辑
      // 1. 尝试按行分割，并清理引号
      const lines = text.split(/\r?\n/).map(l => l.trim().replace(/^["']|["']$/g, '')).filter(l => l !== '');
      
      // 2. 如果看起来像路径，直接使用
      const pathLikeRegex = /^([a-zA-Z]:[\\\/]|\/)/;
      const potentialPaths = lines.filter(l => pathLikeRegex.test(l));
      
      let candidatePaths: string[] = [];
      if (potentialPaths.length > 0) {
        candidatePaths = potentialPaths;
      } else {
        // 3. 否则使用全局正则提取
        const pathRegex = /([a-zA-Z]:[\\\\\/][^:?*\"<>|\r\n]+)|(\/[^:?*\"<>|\r\n]+)/g;
        const matches = text.match(pathRegex);
        candidatePaths = matches ? matches.map(p => p.trim().replace(/^["']|["']$/g, '')).filter(p => p !== '') : [];
      }
      
      if (candidatePaths.length === 0) {
        message.warning(t('未在剪切板中检测到有效的路径信息'));
        return;
      }

      // 4. 实时校验路径是否存在
      const validPaths: string[] = [];
      for (const p of candidatePaths) {
        const exists = await window.electron.checkPathExists(p);
        if (exists) {
          validPaths.push(p);
        }
      }

      if (validPaths.length === 0) {
        message.error(t('剪切板中的路径在系统中不存在，请确认已复制正确的路径'));
        return;
      }
      
      // 5. 显示预览，让用户确认
      showImportPreview(validPaths);
    } catch (error) {
      console.error('Import from clipboard error:', error);
      message.error(t('从剪切板导入失败'));
    }
  };

  // 导入整个文件夹
  const handleImportFromFolder = async () => {
    if (!window.electron) return;
    try {
      // 1. 获取目录路径
      const dirPath = await window.electron.selectDirectory();
      if (!dirPath) return;

      setIsFolderModalVisible(true);
      setFolderScanning(true);
      setFolderFiles([]);
      
      // 2. 递归获取所有文件路径
      const paths = await window.electron.getDirectoryFiles(dirPath);
      
      if (paths && Array.isArray(paths)) {
        const commonTextExtensions = [
          'txt', 'csv', 'json', 'md', 'xml', 'log', 'sql', 'html', 'css', 'js', 'ts', 'yaml', 'yml',
          'ini', 'conf', 'bat', 'sh', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'php', 'rb',
          'prop', 'properties', 'env', 'gitignore', 'editorconfig', 'reg', 'srt', 'vtt',
          'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'
        ];

        const processedFiles = paths.filter((f: any) => f && f.name).map((f: any) => {
          const fileName = f.name || '';
          const ext = fileName.split('.').pop()?.toLowerCase() || '';
          const hasDot = fileName.includes('.');
          const isLikelyText = commonTextExtensions.includes(ext) || !hasDot;
          
          return {
            name: fileName,
            path: f.path || '',
            relDir: f.relDir || '',
            size: f.size || 0,
            key: f.path || Math.random().toString(36).substring(7),
            isLikelyText
          };
        });

        setFolderFiles(processedFiles);
        // 默认选中可能的文本文件
        setSelectedFolderKeys(processedFiles.filter((f: any) => f.isLikelyText).map((f: any) => f.path));
      } else {
        message.info(t('该文件夹下没有发现文件'));
      }
      setFolderScanning(false);
    } catch (error) {
      console.error('Import from folder error:', error);
      message.error(t('导入文件夹失败'));
      setFolderScanning(false);
    }
  };

  const confirmFolderImport = async () => {
    const selectedFiles = folderFiles.filter(f => selectedFolderKeys.includes(f.path));
    if (selectedFiles.length === 0) {
      setIsFolderModalVisible(false);
      return;
    }

    // 转换为 addPathsToFileList 需要的格式 (path 数组)
    const pathsToImport = selectedFiles.map(f => f.path);
    
    setIsFolderModalVisible(false);
    setFolderFiles([]);
    setSelectedFolderKeys([]);
    
    // 使用现有的导入逻辑进行处理（包含格式验证和去重）
    await addPathsToFileList(pathsToImport, true);
  };

  const pushRegexHistory = (pattern: string) => {
    if (!pattern) return;
    setRegexHistory(prev => {
      const next = [pattern, ...prev.filter(p => p !== pattern)].slice(0, 10);
      localStorage.setItem('ruleModifierRegexHistory', JSON.stringify(next));
      return next;
    });
  };

  const getDefaultOutputDir = () => {
    if (!fileList.length) return '';
    const p = (fileList[0] as any).path as string | undefined;
    if (!p) return '';
    return p.replace(/[/\\][^/\\]+$/, '');
  };

  const handleSelectOutputPath = async () => {
    console.log('Renderer: handleSelectOutputPath called');
    if (!window.electron) {
      console.error('window.electron is undefined. Make sure preload script is loaded correctly.');
      message.error(t('系统组件未就绪，请尝试刷新页面或重启软件 (window.electron is missing)'));
      return;
    }
    try {
      const path = await window.electron.selectDirectory();
      if (path) {
        setOutputPath(path);
      }
    } catch (error) {
      console.error('Select directory error:', error);
      message.error(t('选择目录失败: {{msg}}', { msg: error instanceof Error ? error.message : t('未知错误') }));
    }
  };

  const handleOpenOutputDir = () => {
    // 1. 优先打开处理后的实际输出目录
    if (resultOutputPath) {
      // @ts-ignore
      window.electron.openDirectory(resultOutputPath);
      return;
    }
    // 2. 其次打开手动设置的输出目录
    if (outputPath) {
      // @ts-ignore
      window.electron.openDirectory(outputPath);
      return;
    }
    // 3. 尝试打开第一个待处理文件所在的目录
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

  // 添加新规则
  const addRule = () => {
    const newRule: Rule = {
      id: Math.random().toString(36).substr(2, 9),
      source: 'quick',
      type: 'exact',
      find: '',
      replace: '',
      caseSensitive: false,
      wholeWord: false,
      localGeneralRules: [...getDefaultGeneralRules(t)]
    };
    setRules([...rules, newRule]);
  };

  const updateRule = (id: string, field: keyof Rule, value: any) => {
    setRules(rules.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeRule = (id: string) => {
    if (rules.length === 1) {
      return message.info(t('至少需要保留一条规则'));
    }
    setRules(rules.filter(r => r.id !== id));
  };

  const handleManagerRuleSelect = (ruleId: string, targetRuleId: string) => {
    const targetRule = rules.find(r => r.id === targetRuleId);
    if (!targetRule || !targetRule.localGeneralRules) return;

    const selectedGenRule = targetRule.localGeneralRules.find(r => r.id === ruleId);
    if (selectedGenRule) {
      setRules(rules.map(r => r.id === targetRuleId ? {
        ...r,
        source: 'quick', // 自动切换回快速填写
        name: selectedGenRule.name,
        type: selectedGenRule.type,
        find: selectedGenRule.find,
        replace: selectedGenRule.replace,
        description: selectedGenRule.description,
        caseSensitive: selectedGenRule.caseSensitive,
        wholeWord: selectedGenRule.wholeWord
      } : r));
      message.success(t('已应用规则：{{name}}', { name: selectedGenRule.name }));
    }
  };

  const handleSelectAllGeneralRules = (ruleId: string) => {
    const targetRule = rules.find(r => r.id === ruleId);
    if (!targetRule || !targetRule.localGeneralRules) return;

    const currentKeys = selectedManagerKeysMap[ruleId] || [];
    if (currentKeys.length === targetRule.localGeneralRules.length) {
      setSelectedManagerKeysMap({ ...selectedManagerKeysMap, [ruleId]: [] });
    } else {
      setSelectedManagerKeysMap({ ...selectedManagerKeysMap, [ruleId]: targetRule.localGeneralRules.map(r => r.id) });
    }
  };

  const handleDeleteSelectedGeneralRules = (ruleId: string) => {
    const targetRule = rules.find(r => r.id === ruleId);
    if (!targetRule || !targetRule.localGeneralRules) return;

    const currentKeys = selectedManagerKeysMap[ruleId] || [];
    if (currentKeys.length === 0) return message.warning(t('请先选择要删除的规则'));
    
    Modal.confirm({
      title: t('确认删除'),
      content: t('确定要删除选中的 {{count}} 条规则吗？', { count: currentKeys.length }),
      onOk: () => {
        setRules(rules.map(r => r.id === ruleId ? {
          ...r,
          localGeneralRules: r.localGeneralRules?.filter(gr => !currentKeys.includes(gr.id))
        } : r));
        setSelectedManagerKeysMap({ ...selectedManagerKeysMap, [ruleId]: [] });
        message.success(t('已删除选中的规则'));
      }
    });
  };

  const handleDeleteAllGeneralRules = (ruleId: string) => {
    const targetRule = rules.find(r => r.id === ruleId);
    if (!targetRule || !targetRule.localGeneralRules) return;

    if (targetRule.localGeneralRules.length === 0) return message.info(t('没有可删除的规则'));
    Modal.confirm({
      title: t('确认清空所有规则'),
      content: t('此操作将删除当前槽位规则库中的所有规则。确定吗？'),
      onOk: () => {
        setRules(rules.map(r => r.id === ruleId ? {
          ...r,
          localGeneralRules: []
        } : r));
        setSelectedManagerKeysMap({ ...selectedManagerKeysMap, [ruleId]: [] });
        message.success(t('已清空当前槽位的所有规则'));
      }
    });
  };

  const handleRestoreSystemRules = (ruleId: string) => {
    Modal.confirm({
      title: t('恢复默认规则'),
      content: t('确定要为当前槽位恢复默认规则吗？现有的同名规则将被重置。'),
      onOk: () => {
        setRules(rules.map(r => r.id === ruleId ? {
          ...r,
          localGeneralRules: [...getDefaultGeneralRules(t)]
        } : r));
        message.success(t('默认规则已恢复'));
      }
    });
  };

  const handleCreateGeneralRule = (ruleId: string) => {
    const newId = `gen-${Date.now()}`;
    const newRule: Rule = {
      id: newId,
      source: 'manager',
      name: t('新建规则'),
      type: 'exact',
      find: '',
      replace: '',
      description: t('新创建的规则描述'),
      tags: []
    };
    
    setRules(rules.map(r => r.id === ruleId ? {
      ...r,
      localGeneralRules: [...(r.localGeneralRules || []), newRule]
    } : r));
    message.success(t('已创建新规则'));
  };

  const managerColumns = (targetRuleId: string) => [
    {
      title: t('序号'),
      dataIndex: 'index',
      key: 'index',
      width: 70,
      render: (_: any, __: any, index: number) => index + 1
    },
    {
      title: t('名称'),
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: t('标签'),
      dataIndex: 'tags',
      key: 'tags',
      width: 100,
      render: (tags: string[]) => (
        <Space size={0} wrap>
          {tags?.map(tag => <Tag key={tag} style={{ fontSize: 12 }}>{tag}</Tag>)}
        </Space>
      )
    },
    {
      title: t('规则类型'),
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => {
        const types: Record<string, string> = {
          exact: t('查找并替换文本'),
          regex: t('查找并替换文本'),
          batch_exact: t('批量查找替换'),
          batch_regex: t('批量正则替换')
        };
        return types[type] || type;
      }
    },
    {
      title: t('描述'),
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: t('操作'),
      key: 'action',
      width: 100,
      align: 'center' as const,
      render: (_: any, record: Rule) => (
        <Space size="middle">
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => handleManagerRuleSelect(record.id, targetRuleId)}>{t('应用')}</Button>
          <Button 
            type="text" 
            size="small" 
            icon={<DeleteOutlined />} 
            danger 
            onClick={() => {
              setRules(rules.map(r => r.id === targetRuleId ? {
                ...r,
                localGeneralRules: r.localGeneralRules?.filter(gr => gr.id !== record.id)
              } : r));
              message.success(t('已删除规则'));
            }}
          ></Button>
        </Space>
      )
    }
  ];

  const handleProcess = async () => {
    requireAuth(async () => {
      if (fileList.length === 0) return message.warning(t('请先添加文件'));
      const validRules = rules.filter(r => r.find.trim() !== '');
      if (validRules.length === 0) return message.warning(t('请至少设置一条有效的查找规则'));
      if (outputType === 'new_folder' && !outputPath) {
        message.warning(t('请选择保存目录'));
        return;
      }

      const resolvedOutputPath = outputType === 'new_folder' 
        ? outputPath 
        : getDefaultOutputDir() || t('原文件所在目录');

      const doProcess = async () => {
        try {
          setProcessing(true);
          if (!window.electron) {
            throw new Error(t('系统组件未就绪 (window.electron is missing)'));
          }
          const res = await window.electron.processRules(
            fileList.map(f => f.path),
            validRules,
            {
                outputType,
                outputDir: resolvedOutputPath,
                backupBeforeModify,
                skipHiddenFiles,
                continueOnError,
                targetEncoding,
                wordConfig,
                excelConfig,
                pptConfig,
                otherConfig
              }
            );
          setProcessing(false);
          setResultOutputPath(resolvedOutputPath);
          setResults(res.results || []);
          validRules
            .filter(r => r.type === 'regex')
            .forEach(r => pushRegexHistory(r.find));
          message.success(t('成功处理 {{count}} 个文件！', { count: fileList.length }));
        } catch (error: any) {
          setProcessing(false);
          message.error(error?.message || t('处理失败'));
        }
      };

      if (outputType === 'overwrite') {
        Modal.confirm({
          title: t('确认覆盖原文件？'),
          content: t('此操作会直接修改原始文件内容，建议先备份。是否继续？'),
          okText: t('继续覆盖'),
          cancelText: t('取消'),
          onOk: doProcess
        });
      } else {
        doProcess();
      }
    });
  };

  const commonFileFilters = [
    { name: t('所有支持的格式'), extensions: ['txt', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'html', 'json', 'xml', 'md', 'log', 'pptx', 'ppt'] },
    { name: t('Office文档'), extensions: ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'] },
    { name: t('文本文件'), extensions: ['txt', 'csv', 'html', 'json', 'xml', 'md', 'log'] }
  ];

  const handleSelectFilesDirectly = async () => {
    if (!window.electron) return;
    try {
      const paths = await window.electron.selectFiles({
        title: t('选择待处理文件'),
        properties: ['openFile', 'multiSelections'],
        filters: commonFileFilters
      });
      if (paths && paths.length > 0) {
        await addPathsToFileList(paths);
      }
    } catch (error) {
      console.error('Select files error:', error);
    }
  };

  const handleSelectFolderDirectly = async () => {
    if (!window.electron) return;
    try {
      const path = await window.electron.selectDirectory();
      if (path) {
        await addPathsToFileList([path]);
      }
    } catch (error) {
      console.error('Select folder error:', error);
    }
  };

  const handleClickDropArea = () => {
    handleSelectFilesDirectly();
  };

  const moreImportMenu: MenuProps['items'] = [
    {
      key: 'folder',
      label: t('导入整个文件夹'),
      icon: <FolderOpenOutlined />,
      onClick: handleImportFromFolder
    },
    {
      key: 'file_list',
      label: t('从路径文件导入'),
      icon: <FileTextOutlined />,
      onClick: handleImportFromPathsFile
    },
    {
      key: 'clipboard',
      label: t('从剪切板导入'),
      icon: <CopyOutlined />,
      onClick: handleImportFromClipboard
    }
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 32px 24px' }}>
      <UnifiedToolContainer
        fileList={fileList}
        selectedFileKeys={selectedRowKeys}
        onSelectionChange={(keys) => setSelectedRowKeys(keys)}
        onFilesAdd={(files) => {
          const paths = files.map(f => f.path || (f.originFileObj && f.originFileObj.path)).filter(Boolean);
          addPathsToFileList(paths);
        }}
        onFileRemove={(uid) => {
          setFileList(fileList.filter(f => f.uid !== uid));
          setSelectedRowKeys(selectedRowKeys.filter(key => key !== uid));
        }}
        onFilesRemoveBatch={() => {
          setFileList(fileList.filter(f => !selectedRowKeys.includes(f.uid)));
          setSelectedRowKeys([]);
        }}
        onFilesClear={() => {
          setFileList([]);
          setSelectedRowKeys([]);
        }}
        uploadHint={t('仅支持 .txt, .html, .json, .xml, .csv, .docx 格式的文件')}
        extraHeaderActions={
          <Space>
            <Upload
              name="file"
              multiple
              showUploadList={false}
              beforeUpload={(_: any, fileList: any[]) => {
                const paths = fileList.map(f => f.path || (f.originFileObj && f.originFileObj.path)).filter(Boolean);
                addPathsToFileList(paths);
                return false;
              }}
              directory={false}
            >
              <Button icon={<FileAddOutlined />}>{t('添加文件')}</Button>
            </Upload>
            <Button icon={<FolderAddOutlined />} onClick={handleImportFromFolder}>{t('添加文件夹')}</Button>
          </Space>
        }
        columns={[
          { 
            title: t('文件名'), 
            dataIndex: 'name', 
            key: 'name',
            ellipsis: { showTitle: true },
            render: (text: string) => <><FileTextOutlined style={{ marginRight: 8, color: '#1890ff' }} />{text}</>
          },
          { 
            title: t('大小'), 
            dataIndex: 'size', 
            key: 'size',
            width: 100,
          },
          {
            title: t('类型'),
            dataIndex: 'ext',
            key: 'ext',
            width: 80,
            render: (ext: string) => <Tag color="default">{ext || '-'}</Tag>
          },
          {
            title: t('修改时间'),
            dataIndex: 'modifiedAt',
            key: 'modifiedAt',
            width: 160,
          },
          {
            title: (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{t('操作')}</span>
                <Space size={8}>
                  <Tooltip title={t('按条件过滤列表')}>
                    <Button 
                      type="primary" 
                      size="small" 
                      ghost
                      icon={<FilterOutlined />}
                      onClick={() => setFilterModalVisible(true)}
                    >
                      {t('过滤')}
                    </Button>
                  </Tooltip>
                  <Tooltip title={t('调整列表显示顺序')}>
                    <Button 
                      type="primary" 
                      size="small" 
                      ghost
                      icon={<SortAscendingOutlined />}
                      onClick={() => setSortModalVisible(true)}
                    >
                      {t('排序')}
                    </Button>
                  </Tooltip>
                </Space>
              </div>
            ),
            key: 'action',
            width: 180,
            align: 'center',
            render: (_: any, record: any) => (
              <Button 
                type="text" 
                danger 
                size="small"
                icon={<DeleteOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setFileList(fileList.filter(f => f.uid !== record.uid));
                  setSelectedRowKeys(selectedRowKeys.filter(key => key !== record.uid));
                }}
              >
                {t('移除')}
              </Button>
            )
          }
        ]}
        settingsContent={
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
            {/* 左侧：参数设置 */}
            <div>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileTextOutlined style={{ color: '#1890ff' }} />
                <Text strong>{t('参数设置')}</Text>
              </div>
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                <Button 
                  block 
                  size="large" 
                  icon={<FileTextOutlined />} 
                  onClick={() => setIsRulesModalVisible(true)}
                  disabled={fileList.length === 0}
                  style={{ height: 45, borderRadius: 8 }}
                >
                  {t('设置内容修改规则')}
                </Button>
                <Button 
                  block 
                  size="large" 
                  icon={<FileSearchOutlined />} 
                  onClick={() => setIsFormatModalVisible(true)}
                  disabled={!detectedTypes.hasWord && !detectedTypes.hasExcel && !detectedTypes.hasPpt}
                  style={{ height: 45, borderRadius: 8 }}
                >
                  {t('设置 Office 文档处理范围')}
                </Button>
                <Button 
                  block 
                  size="large" 
                  icon={<SettingOutlined />} 
                  onClick={() => setSettingsVisible(true)}
                  style={{ height: 45, borderRadius: 8 }}
                >
                  {t('其它全局处理选项')}
                </Button>
              </Space>
            </div>

            {/* 右侧：输出设置 */}
            <div>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FolderOpenOutlined style={{ color: '#1890ff' }} />
                <Text strong>{t('输出设置')}</Text>
              </div>
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                <div style={{ background: '#f5f7fa', padding: '12px', borderRadius: 8 }}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>{t('输出方式')}</Text>
                  <Radio.Group 
                    value={outputType} 
                    onChange={e => setOutputType(e.target.value)}
                  >
                    <Space size={24}>
                      <Radio value="new_folder">{t('保存到新目录')}</Radio>
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
                      onClick={handleSelectOutputPath}
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
              disabled={fileList.length === 0 && !outputPath && !resultOutputPath}
              style={{ height: 50, borderRadius: 25, padding: '0 24px' }}
              title={t('打开结果目录')}
            >
              {t('打开结果目录')}
            </Button>
            <Button 
              type="primary" 
              size="large" 
              icon={<PlayCircleOutlined />} 
              loading={processing} 
              disabled={fileList.length === 0}
              onClick={handleProcess}
              style={{ height: 50, borderRadius: 25, padding: '0 40px', fontSize: 16, fontWeight: 600, boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)' }}
            >
              {t('立即开始批量处理')}
            </Button>
          </div>
        }
      />

      {results.length > 0 && (
        <Card 
          title={<Space size="middle"><PlayCircleOutlined style={{ color: '#52c41a' }} /><span>{t('处理结果报告')}</span></Space>}
          styles={{ body: { padding: '24px' } }}
          style={{ borderRadius: 12, marginTop: 16 }}
        >
          <div style={{ textAlign: 'center', marginBottom: 24, padding: '16px', background: '#f6ffed', borderRadius: 12, border: '1px solid #b7eb8f' }}>
            <Title level={4} style={{ marginBottom: 8 }}>{t('批量修改任务已完成')}</Title>
            <Paragraph style={{ marginBottom: 8 }}>
              {t('成功处理了')} <Text strong type="success">{results.filter(r => r.success).length}</Text> {t('个文件')}，
              {results.some(r => !r.success) && <Text type="danger">{t('其中 {{count}} 个文件处理失败', { count: results.filter(r => !r.success).length })}</Text>}
            </Paragraph>
            <div>
              <Text>{t('输出目录：')}</Text>
              <Text code style={{ fontSize: 12, background: '#fff', padding: '2px 6px', borderRadius: 4 }}>{resultOutputPath || t('原文件所在目录')}</Text>
            </div>
          </div>

          <Table
            dataSource={results.length ? results : fileList}
            size="middle"
            pagination={{ pageSize: 10 }}
            columns={[
              { 
                title: t('文件名'), 
                dataIndex: 'name', 
                key: 'name', 
                render: (_: any, record: any) => (
                  <Space>
                    <FileTextOutlined style={{ color: '#1890ff' }} />
                    <Text>{record.name || record.filePath?.split(/[\\/]/).pop()}</Text>
                  </Space>
                )
              },
              { 
                title: t('状态'), 
                dataIndex: 'success', 
                key: 'status', 
                width: 120,
                align: 'center',
                render: (success: boolean, record: any) => (
                  success ? 
                    <Tag color="success" style={{ padding: '2px 10px', borderRadius: 4 }}>{t('成功')}</Tag> : 
                    <Tooltip title={record.error || t('未知错误')}>
                      <Tag color="error" style={{ cursor: 'help', padding: '2px 10px', borderRadius: 4 }}>{t('失败')}</Tag>
                    </Tooltip>
                ) 
              },
              { 
                title: t('修改处'), 
                dataIndex: 'changed', 
                key: 'changes', 
                width: 120,
                align: 'center',
                render: (c: number) => <Text strong type="secondary">{c ?? 0} {t('处')}</Text> 
              }
            ]}
            rowKey={(record) => record.uid || record.filePath || Math.random().toString()}
            bordered
            style={{ background: '#fff' }}
          />
        </Card>
      )}

      <Modal
        title={
          <Space>
            <FolderOpenOutlined style={{ color: '#1890ff' }} />
            <span>{t('选择要导入的文件')}</span>
          </Space>
        }
        open={isFolderModalVisible}
        onOk={confirmFolderImport}
        onCancel={() => {
          setIsFolderModalVisible(false);
          setFolderSearchKeyword('');
        }}
        width={900}
        okText={t('导入选中的文件 ({{count}})', { count: selectedFolderKeys.length })}
        cancelText={t('取消')}
        confirmLoading={folderScanning}
        styles={{ body: { padding: '12px 24px' } }}
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <Space size="large">
            <Checkbox 
              checked={showAllFolderFiles} 
              onChange={e => setShowAllFolderFiles(e.target.checked)}
            >
              {t('显示所有文件')}
            </Checkbox>
            <span style={{ color: '#999', fontSize: 13 }}>
              {t('已发现 {{total}} 个文件，其中 {{suggest}} 个建议导入', { total: folderFiles.length, suggest: folderFiles.filter(f => f.isLikelyText).length })}
            </span>
          </Space>
          <Input 
            placeholder={t('搜索文件名...')} 
            prefix={<FilterOutlined style={{ color: '#bfbfbf' }} />}
            style={{ width: 250 }}
            allowClear
            value={folderSearchKeyword}
            onChange={e => setFolderSearchKeyword(e.target.value)}
          />
        </div>
        
        <Table
          dataSource={folderFiles.filter(f => {
            const matchesSearch = f.name.toLowerCase().includes(folderSearchKeyword.toLowerCase());
            const matchesType = showAllFolderFiles || f.isLikelyText;
            return matchesSearch && matchesType;
          })}
          rowKey="path"
          size="small"
          scroll={{ y: 400 }}
          pagination={false}
          rowSelection={{
            selectedRowKeys: selectedFolderKeys,
            onChange: (keys) => setSelectedFolderKeys(keys),
            selections: [
              Table.SELECTION_ALL,
              Table.SELECTION_INVERT,
              Table.SELECTION_NONE,
              {
                key: 'likely_text',
                text: t('选择建议文件'),
                onSelect: (changableRowKeys) => {
                  const keys = folderFiles
                    .filter(f => f.isLikelyText)
                    .map(f => f.path);
                  setSelectedFolderKeys(keys);
                },
              },
            ],
          }}
          onRow={(record) => ({
            onClick: () => {
              const key = record.path;
              const newSelectedKeys = [...selectedFolderKeys];
              const index = newSelectedKeys.indexOf(key);
              if (index >= 0) {
                newSelectedKeys.splice(index, 1);
              } else {
                newSelectedKeys.push(key);
              }
              setSelectedFolderKeys(newSelectedKeys);
            },
            style: { cursor: 'pointer' }
          })}
          columns={[
            { 
              title: t('文件名'), 
              dataIndex: 'name', 
              width: 300,
              render: (text, record) => (
                <Space>
                  <FileTextOutlined style={{ color: record.isLikelyText ? '#1890ff' : '#bfbfbf' }} />
                  <Text ellipsis={{ tooltip: text }}>{text}</Text>
                </Space>
              )
            },
            { 
              title: t('相对路径'), 
              dataIndex: 'relDir', 
              render: (text) => <Text type="secondary" style={{ fontSize: 12 }}>{text || '/'}</Text>,
              ellipsis: true 
            },
            { 
              title: t('大小'), 
              dataIndex: 'size', 
              width: 100,
              align: 'right',
              render: (v) => <Text type="secondary">{v < 1024 ? `${v} B` : `${(v/1024).toFixed(1)} KB`}</Text>
            }
          ]}
          locale={{ emptyText: folderScanning ? t('正在扫描文件夹...') : t('未找到匹配的文件') }}
        />
        
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('提示：支持 Word、Excel、PPT 及纯文本等多种格式。')}
          </Text>
        </div>
      </Modal>

      <Modal
        title={
          <Space size="middle">
            <PlusOutlined style={{ color: '#1890ff' }} />
            <span>{t('内容修改/删除规则')}</span>
          </Space>
        }
        open={isRulesModalVisible}
        onCancel={() => setIsRulesModalVisible(false)}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => setIsRulesModalVisible(false)}
          >
            {t('关闭')}
          </Button>,
        ]}
        width={1000}
        styles={{ body: { padding: '24px' } }}
      >
        <Alert
          message={t('使用提示')}
          description={t('查找内容为空时规则无效；替换内容为空时则执行“删除”操作。支持正则表达式匹配。')}
          type="info"
          showIcon
          style={{ marginBottom: 24, borderRadius: '8px' }}
        />
        <List
          dataSource={rules}
          renderItem={(rule, index) => (
            <div
              style={{
                padding: '24px',
                border: '1px solid #e8e8e8',
                borderRadius: '12px',
                marginBottom: 24,
                background: '#fff',
                transition: 'all 0.3s',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              }}
            >
              <div
                style={{
                  marginBottom: 20,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Space>
                  <Tag
                    color="blue"
                    style={{
                      fontSize: '14px',
                      padding: '4px 12px',
                      borderRadius: '4px',
                    }}
                  >
                    {t('规则 #{{index}}', { index: index + 1 })}
                  </Tag>
                  {rule.type === 'regex' && (
                    <Tag color="orange" style={{ borderRadius: '4px' }}>
                      {t('正则模式')}
                    </Tag>
                  )}
                </Space>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  style={{ borderRadius: '6px' }}
                  onClick={() => removeRule(rule.id)}
                >
                  {t('移除此规则')}
                </Button>
              </div>

              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div
                  style={{
                    background: '#f5f7fa',
                    padding: '16px',
                    borderRadius: '8px',
                  }}
                >
                  <div
                    style={{
                      marginBottom: rule.source === 'manager' ? '16px' : '0',
                    }}
                  >
                    <Text
                      strong
                      style={{
                        display: 'block',
                        marginBottom: '12px',
                        fontSize: '14px',
                        color: '#333',
                      }}
                    >
                      {t('规则来源')}
                    </Text>
                    <Radio.Group
                      value={rule.source}
                      onChange={e =>
                        updateRule(rule.id, 'source', e.target.value)
                      }
                    >
                      <Space size={24}>
                        <Radio value="quick">{t('快速填写规则')}</Radio>
                        <Radio value="manager">{t('从通用的规则管理器中选择')}</Radio>
                      </Space>
                    </Radio.Group>
                  </div>

                  {rule.source === 'quick' ? (
                    <div style={{ marginTop: '16px' }}>
                      <Text
                        strong
                        style={{
                          display: 'block',
                          marginBottom: '12px',
                          fontSize: '14px',
                          color: '#333',
                        }}
                      >
                        {t('查找类型')}
                      </Text>
                      <Radio.Group
                        value={rule.type}
                        onChange={e =>
                          updateRule(rule.id, 'type', e.target.value)
                        }
                      >
                        <Space size={24}>
                          <Radio value="exact">{t('精确文本')}</Radio>
                          <Radio value="regex">{t('模糊文本')}</Radio>
                          <Radio value="batch_exact">{t('批量精确文本')}</Radio>
                          <Radio value="batch_regex">{t('批量模糊文本')}</Radio>
                        </Space>
                      </Radio.Group>
                    </div>
                  ) : (
                    <div
                      style={{
                        marginTop: '16px',
                        borderTop: '1px solid #e8e8e8',
                        paddingTop: '16px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 16,
                        }}
                      >
                        <Text strong>{t('规则管理器')}</Text>
                        <Space>
                          <Tag color="blue">
                            {t('已勾选 {{count}} 条规则', { count: (selectedManagerKeysMap[rule.id] || []).length })}
                          </Tag>
                          <Button
                            size="small"
                            type="primary"
                            onClick={() => handleSelectAllGeneralRules(rule.id)}
                          >
                            {(selectedManagerKeysMap[rule.id] || []).length ===
                            (rule.localGeneralRules || []).length
                              ? t('取消全选')
                              : t('全选所有')}
                          </Button>
                          <Button
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={() => handleCreateGeneralRule(rule.id)}
                          >
                            {t('新建规则')}
                          </Button>
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() =>
                              handleDeleteSelectedGeneralRules(rule.id)
                            }
                          >
                            {t('删除已选')}
                          </Button>
                          <Button
                            size="small"
                            danger
                            onClick={() => handleDeleteAllGeneralRules(rule.id)}
                          >
                            {t('删除所有')}
                          </Button>
                          <Button
                            size="small"
                            onClick={() => handleRestoreSystemRules(rule.id)}
                          >
                            {t('恢复默认规则')}
                          </Button>
                        </Space>
                      </div>
                      <Table
                        dataSource={rule.localGeneralRules || []}
                        columns={managerColumns(rule.id)}
                        rowKey="id"
                        size="small"
                        pagination={false}
                        rowSelection={{
                          selectedRowKeys: selectedManagerKeysMap[rule.id] || [],
                          onChange: keys =>
                            setSelectedManagerKeysMap({
                              ...selectedManagerKeysMap,
                              [rule.id]: keys,
                            }),
                        }}
                        bordered
                      />
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary">
                          {t('汇总 记录数：{{count}}', { count: (rule.localGeneralRules || []).length })}
                        </Text>
                      </div>
                    </div>
                  )}
                </div>

                {rule.source === 'quick' && (
                  <div style={{ display: 'flex', gap: '20px' }}>
                    <div style={{ flex: 1 }}>
                      <Text
                        strong
                        style={{
                          display: 'block',
                          marginBottom: 8,
                          color: '#444',
                        }}
                      >
                        {rule.type.startsWith('batch_')
                          ? t('待查找内容 (每行一个)：')
                          : t('查找内容：')}
                      </Text>
                      <Input.TextArea
                        placeholder={
                          rule.type === 'exact'
                            ? t('例如：旧公司名')
                            : rule.type === 'regex'
                            ? t('例如：\\d{11} (匹配手机号)')
                            : rule.type === 'batch_exact'
                            ? t('输入多个关键字，每行一个')
                            : t('输入多个正则表达式，每行一个')
                        }
                        value={rule.find}
                        autoSize={{
                          minRows: rule.type.startsWith('batch_') ? 4 : 2,
                          maxRows: 10,
                        }}
                        style={{ borderRadius: '8px', padding: '10px' }}
                        onChange={e => updateRule(rule.id, 'find', e.target.value)}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <Text
                        strong
                        style={{
                          display: 'block',
                          marginBottom: 8,
                          color: '#444',
                        }}
                      >
                        {rule.type.startsWith('batch_')
                          ? t('对应替换为 (每行一个，需与查找行数一致)：')
                          : t('替换为：')}
                      </Text>
                      <Input.TextArea
                        placeholder={
                          rule.type.startsWith('batch_')
                            ? t('如果不填，则全部执行“删除”操作')
                            : t('不填则执行“删除”操作')
                        }
                        value={rule.replace}
                        autoSize={{
                          minRows: rule.type.startsWith('batch_') ? 4 : 2,
                          maxRows: 10,
                        }}
                        style={{ borderRadius: '8px', padding: '10px' }}
                        onChange={e =>
                          updateRule(rule.id, 'replace', e.target.value)
                        }
                      />
                    </div>
                  </div>
                )}
              </Space>
            </div>
          )}
        />
        <div style={{ marginTop: 8, textAlign: 'right' }}>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={addRule}
            size="small"
          >
            {t('追加新规则')}
          </Button>
        </div>
      </Modal>

      <Modal
        title={
          <Space size="middle">
            <FileSearchOutlined style={{ color: '#1890ff' }} />
            <span>{t('Office 文档处理范围')}</span>
          </Space>
        }
        open={isFormatModalVisible}
        onCancel={() => setIsFormatModalVisible(false)}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => setIsFormatModalVisible(false)}
          >
            {t('关闭')}
          </Button>,
        ]}
        width={960}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Tabs defaultActiveKey={defaultFormatTabKey}>
          <Tabs.TabPane
            tab="Word"
            key="word"
            disabled={!detectedTypes.hasWord}
          >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div
                style={{
                  background: '#f5f7fa',
                  padding: '20px',
                  borderRadius: '8px',
                }}
              >
                <Text strong style={{ display: 'block', marginBottom: 12 }}>
                  {t('将替换后的内容高亮')}
                </Text>
                <Switch
                  checked={wordConfig.highlight}
                  onChange={val =>
                    setWordConfig({ ...wordConfig, highlight: val })
                  }
                />
              </div>

              {wordConfig.highlight && (
                <div
                  style={{
                    background: '#f5f7fa',
                    padding: '20px',
                    borderRadius: '8px',
                  }}
                >
                  <Text strong style={{ display: 'block', marginBottom: 12 }}>
                    {t('高亮颜色')}
                  </Text>
                  <ColorPicker
                    value={wordConfig.highlightColor}
                    showText
                    onChange={color =>
                      setWordConfig({
                        ...wordConfig,
                        highlightColor: color.toHexString(),
                      })
                    }
                    presets={COLOR_PRESETS}
                  />
                </div>
              )}
            </Space>
          </Tabs.TabPane>

          <Tabs.TabPane
            tab="Excel"
            key="excel"
            disabled={!detectedTypes.hasExcel}
          >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div
                style={{
                  background: '#f5f7fa',
                  padding: '20px',
                  borderRadius: '8px',
                }}
              >
                <Text strong style={{ display: 'block', marginBottom: 12 }}>
                  <span style={{ color: 'red', marginRight: 4 }}>*</span>
                  {t('Excel 处理范围')}
                </Text>
                <Checkbox.Group
                  value={excelConfig.range}
                  onChange={val =>
                    setExcelConfig({ ...excelConfig, range: val as string[] })
                  }
                >
                  <Space direction="horizontal" size="large">
<Checkbox value="cell">{t('单元格文本')}</Checkbox>
                  <Checkbox value="sheetName">{t('工作表Sheet的名称')}</Checkbox>
                  </Space>
                </Checkbox.Group>
              </div>

              <div
                style={{
                  background: '#f5f7fa',
                  padding: '20px',
                  borderRadius: '8px',
                }}
              >
                <Text strong style={{ display: 'block', marginBottom: 12 }}>
                  <span style={{ color: 'red', marginRight: 4 }}>*</span>
                  {t('需要处理的单元格公式类型')}
                </Text>
                <Radio.Group
                  value={excelConfig.formulaType}
                  onChange={e =>
                    setExcelConfig({
                      ...excelConfig,
                      formulaType: e.target.value,
                    })
                  }
                >
                  <Space direction="horizontal" size="large">
                    <Radio value="no_limit">{t('不限制')}</Radio>
                    <Radio value="only_formula">{t('只处理包含公式的单元格')}</Radio>
                    <Radio value="no_formula">{t('只处理不包含公式的单元格')}</Radio>
                  </Space>
                </Radio.Group>
              </div>

              <div
                style={{
                  background: '#f5f7fa',
                  padding: '20px',
                  borderRadius: '8px',
                }}
              >
                <Text strong style={{ display: 'block', marginBottom: 12 }}>
                  {t('包含公式的单元格处理方式')}{' '}
                  <Tooltip title={t('公式单元格的处理策略')}>
                    <Text type="warning">{t('说明?')}</Text>
                  </Tooltip>
                </Text>
                <Radio.Group
                  value={excelConfig.formulaProcess}
                  onChange={e =>
                    setExcelConfig({
                      ...excelConfig,
                      formulaProcess: e.target.value,
                    })
                  }
                >
                  <Space direction="horizontal" size="large">
                    <Radio value="calculated">{t('公式计算后的值')}</Radio>
                    <Radio value="expression">{t('公式表达式')}</Radio>
                  </Space>
                </Radio.Group>
              </div>

              <div
                style={{
                  background: '#f5f7fa',
                  padding: '20px',
                  borderRadius: '8px',
                }}
              >
                <Text strong style={{ display: 'block', marginBottom: 12 }}>
                  <span style={{ color: 'red', marginRight: 4 }}>*</span>
                  {t('需要处理的单元格数据类型')}
                </Text>
                <Checkbox.Group
                  value={excelConfig.dataTypes}
                  onChange={val =>
                    setExcelConfig({
                      ...excelConfig,
                      dataTypes: val as string[],
                    })
                  }
                >
                  <Space direction="horizontal" size="large">
                    <Checkbox value="text">{t('文本')}</Checkbox>
                    <Checkbox value="number">{t('数字')}</Checkbox>
                    <Checkbox value="logic">{t('逻辑')}</Checkbox>
                    <Checkbox value="datetime">{t('日期时间')}</Checkbox>
                  </Space>
                </Checkbox.Group>
              </div>

              <div
                style={{
                  background: '#f5f7fa',
                  padding: '20px',
                  borderRadius: '8px',
                }}
              >
                <Text strong style={{ display: 'block', marginBottom: 12 }}>
                  {t('数字类型的单元格处理目标')}
                </Text>
                <Radio.Group
                  value={excelConfig.numberTarget}
                  onChange={e =>
                    setExcelConfig({
                      ...excelConfig,
                      numberTarget: e.target.value,
                    })
                  }
                >
                  <Space direction="horizontal" size="large">
                    <Radio value="display">{t('显示值 (看到的内容)')}</Radio>
                    <Radio value="original">{t('原始值 (存储的内容)')}</Radio>
                  </Space>
                </Radio.Group>
              </div>

              <div
                style={{
                  background: '#f5f7fa',
                  padding: '20px',
                  borderRadius: '8px',
                }}
              >
                <Text strong style={{ display: 'block', marginBottom: 12 }}>
                  {t('日期类型的单元格处理目标')}
                </Text>
                <Radio.Group
                  value={excelConfig.dateTarget}
                  onChange={e =>
                    setExcelConfig({
                      ...excelConfig,
                      dateTarget: e.target.value,
                    })
                  }
                >
                  <Space direction="horizontal" size="large">
                    <Radio value="display">{t('显示值 (看到的内容)')}</Radio>
                    <Radio value="original">{t('原始值 (存储的内容)')}</Radio>
                  </Space>
                </Radio.Group>
              </div>

              <div
                style={{
                  background: '#f5f7fa',
                  padding: '20px',
                  borderRadius: '8px',
                }}
              >
                <Text strong style={{ display: 'block', marginBottom: 12 }}>
                  {t('单元格数据类型转换')}
                </Text>
                <Space size="middle">
                  <Text>
                    {t('自动转换为处理前的数据类型，如果转换失败，则')}
                  </Text>
                  <Select
                    value={excelConfig.failedConversion}
                    onChange={val =>
                      setExcelConfig({
                        ...excelConfig,
                        failedConversion: val,
                      })
                    }
                    style={{ width: 220 }}
                    size="middle"
                  >
                    <Option value="to_text">{t('将此单元格转换为文本')}</Option>
                    <Option value="keep_original">{t('保持处理后的内容')}</Option>
                  </Select>
                </Space>
              </div>

              <div
                style={{
                  background: '#f5f7fa',
                  padding: '20px',
                  borderRadius: '8px',
                }}
              >
                <Text strong style={{ display: 'block', marginBottom: 12 }}>
                  {t('将替换后的单元格高亮')}
                </Text>
                <Switch
                  checked={excelConfig.highlight}
                  onChange={val =>
                    setExcelConfig({
                      ...excelConfig,
                      highlight: val,
                    })
                  }
                />
              </div>

              {excelConfig.highlight && (
                <div
                  style={{
                    background: '#f5f7fa',
                    padding: '20px',
                    borderRadius: '8px',
                  }}
                >
                  <Text strong style={{ display: 'block', marginBottom: 12 }}>
                    {t('高亮颜色')}
                  </Text>
                  <ColorPicker
                    value={excelConfig.highlightColor}
                    showText
                    onChange={color =>
                      setExcelConfig({
                        ...excelConfig,
                        highlightColor: color.toHexString(),
                      })
                    }
                    presets={COLOR_PRESETS}
                  />
                </div>
              )}
            </Space>
          </Tabs.TabPane>

          <Tabs.TabPane
            tab="PPT"
            key="ppt"
            disabled={!detectedTypes.hasPpt}
          >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div
                style={{
                  background: '#f5f7fa',
                  padding: '20px',
                  borderRadius: '8px',
                }}
              >
                <Text strong style={{ display: 'block', marginBottom: 12 }}>
                  {t('PPT 处理范围')}
                </Text>
                <Checkbox.Group
                  value={pptConfig.range}
                  onChange={val =>
                    setPptConfig({ ...pptConfig, range: val as string[] })
                  }
                >
                  <Space direction="horizontal" size="large">
                    <Checkbox value="text">{t('普通文本')}</Checkbox>
                    <Checkbox value="master">{t('母版名称')}</Checkbox>
                    <Checkbox value="layout">{t('版式名称')}</Checkbox>
                  </Space>
                </Checkbox.Group>
              </div>

              <div
                style={{
                  background: '#f5f7fa',
                  padding: '20px',
                  borderRadius: '8px',
                }}
              >
                <Text strong style={{ display: 'block', marginBottom: 12 }}>
                  {t('将替换后的内容高亮')}
                </Text>
                <Switch
                  checked={pptConfig.highlight}
                  onChange={val =>
                    setPptConfig({ ...pptConfig, highlight: val })
                  }
                />
              </div>

              {pptConfig.highlight && (
                <div
                  style={{
                    background: '#f5f7fa',
                    padding: '20px',
                    borderRadius: '8px',
                  }}
                >
                  <Text strong style={{ display: 'block', marginBottom: 12 }}>
                    {t('高亮颜色')}
                  </Text>
                  <ColorPicker
                    value={pptConfig.highlightColor}
                    showText
                    onChange={color =>
                      setPptConfig({
                        ...pptConfig,
                        highlightColor: color.toHexString(),
                      })
                    }
                    presets={COLOR_PRESETS}
                  />
                </div>
              )}
            </Space>
          </Tabs.TabPane>

          <Tabs.TabPane tab={t('其它设置')} key="other">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div
                style={{
                  background: '#f5f7fa',
                  padding: '20px',
                  borderRadius: '8px',
                }}
              >
                <Text strong style={{ display: 'block', marginBottom: 12 }}>
                  {t('保留规则前后的空白文本')}{' '}
                  <Tooltip title={t('如果开启，系统将尽量保留查找到的文本前后的空格和换行')}>
                    <Text type="warning" style={{ cursor: 'help' }}>
                      {t('[说明]')}
                    </Text>
                  </Tooltip>
                </Text>
                <Switch
                  checked={otherConfig.keepWhitespace}
                  onChange={val =>
                    setOtherConfig({
                      ...otherConfig,
                      keepWhitespace: val,
                    })
                  }
                />
              </div>
            </Space>
          </Tabs.TabPane>
        </Tabs>
      </Modal>

      <Modal
        title={
          <Space size="middle">
            <FolderOpenOutlined style={{ color: '#1890ff' }} />
            <span>{t('保存与输出目录')}</span>
          </Space>
        }
        open={isOutputModalVisible}
        onCancel={() => setIsOutputModalVisible(false)}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => setIsOutputModalVisible(false)}
          >
            {t('关闭')}
          </Button>,
        ]}
        width={700}
        styles={{ body: { padding: '24px' } }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text
              strong
              style={{ display: 'block', marginBottom: 16, fontSize: '16px' }}
            >
              {t('输出路径选择：')}
            </Text>
            <Radio.Group
              value={outputType}
              onChange={e => setOutputType(e.target.value)}
            >
              <Space direction="vertical" size="middle">
                <Radio value="new_folder">{t('保存到新目录 (推荐)')}</Radio>
                <Radio value="overwrite">{t('覆盖原文件 (谨慎操作)')}</Radio>
              </Space>
            </Radio.Group>
          </div>

          {outputType === 'new_folder' && (
            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={outputPath}
                placeholder={t('点击右侧按钮选择保存位置...')}
                readOnly
                size="middle"
              />
              <Button
                icon={<FolderOpenOutlined />}
                onClick={handleSelectOutputPath}
                size="middle"
              />
            </Space.Compact>
          )}
        </Space>
      </Modal>

      {/* 列表排序设置弹窗 */}
      <Modal
        title={<Space><SortAscendingOutlined style={{ color: '#1890ff' }} /><span>{t('列表排序设置')}</span></Space>}
        open={sortModalVisible}
        onOk={() => setSortModalVisible(false)}
        onCancel={() => setSortModalVisible(false)}
        okText={t('确定')}
        cancelText={t('取消')}
        width={540}
        styles={{ body: { padding: '24px 0' } }}
        footer={[
          <Button key="back" onClick={() => setSortModalVisible(false)} style={{ height: 40, borderRadius: '6px', padding: '0 24px' }}>
            {t('取消')}
          </Button>,
          <Button key="submit" type="primary" onClick={() => setSortModalVisible(false)} style={{ height: 40, borderRadius: '6px', padding: '0 32px' }}>
            {t('确定')}
          </Button>,
        ]}
      >
        <div style={{ padding: '0 24px' }}>
          <Alert 
            message={t('这里的排序效果与 Windows 资源管理器一致，采用自然排序算法。')} 
            type="info" 
            showIcon 
            style={{ marginBottom: 24, borderRadius: '8px' }}
          />
          
          <div style={{ marginBottom: 24 }}>
            <Text strong style={{ display: 'block', marginBottom: 12, fontSize: '15px' }}>
              {t('排序字段')}
            </Text>
            <div style={{ background: '#f9f9f9', padding: '16px', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
              <Radio.Group 
                value={sortConfig.field} 
                onChange={e => setSortConfig({ ...sortConfig, field: e.target.value })}
                style={{ width: '100%' }}
              >
                <Space size={[24, 16]} wrap>
                  <Radio value="name">{t('名称')}</Radio>
                  <Radio value="path">{t('路径')}</Radio>
                  <Radio value="ext">{t('扩展名')}</Radio>
                  <Radio value="birthtime">{t('创建时间')}</Radio>
                  <Radio value="modifiedAt">{t('修改时间')}</Radio>
                </Space>
              </Radio.Group>
            </div>
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 12, fontSize: '15px' }}>
              {t('排序方式')}
            </Text>
            <div style={{ background: '#f9f9f9', padding: '16px', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
              <Radio.Group 
                value={sortConfig.order} 
                onChange={e => setSortConfig({ ...sortConfig, order: e.target.value })}
              >
                <Space size={40}>
                  <Radio value="ascend">{t('升序 (从小到大)')}</Radio>
                  <Radio value="descend">{t('降序 (从大到小)')}</Radio>
                </Space>
              </Radio.Group>
            </div>
          </div>
        </div>
      </Modal>

      {/* 列表过滤设置弹窗 */}
      <Modal
        title={<Space><FilterOutlined style={{ color: '#1890ff' }} /><span>{t('列表过滤设置')}</span></Space>}
        open={filterModalVisible}
        onOk={() => setFilterModalVisible(false)}
        onCancel={() => setFilterModalVisible(false)}
        okText={t('确定')}
        cancelText={t('取消')}
        width={540}
        styles={{ body: { padding: '24px 0' } }}
        footer={[
          <Button key="back" onClick={() => setFilterModalVisible(false)} style={{ height: 40, borderRadius: '6px', padding: '0 24px' }}>
            {t('取消')}
          </Button>,
          <Button key="submit" type="primary" onClick={() => setFilterModalVisible(false)} style={{ height: 40, borderRadius: '6px', padding: '0 32px' }}>
            {t('确定')}
          </Button>,
        ]}
      >
        <div style={{ padding: '0 24px' }}>
          <div style={{ marginBottom: 24 }}>
            <Text strong style={{ display: 'block', marginBottom: 12, fontSize: '15px' }}>{t('按文件名关键词过滤')}</Text>
            <Input 
              placeholder={t('输入关键词，留空显示全部')} 
              value={filterConfig.nameKeyword}
              onChange={e => setFilterConfig({ ...filterConfig, nameKeyword: e.target.value })}
              allowClear
              size="large"
              style={{ borderRadius: '8px' }}
              prefix={<FilterOutlined style={{ color: '#bfbfbf' }} />}
            />
          </div>
          
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text strong style={{ fontSize: '15px' }}>{t('按文件类型过滤')}</Text>
              <Button type="link" size="small" onClick={() => setFilterConfig({ ...filterConfig, extensions: [] })} style={{ padding: 0 }}>
                {t('重置选择')}
              </Button>
            </div>
            <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
              <Checkbox.Group 
                value={filterConfig.extensions}
                onChange={checkedValues => setFilterConfig({ ...filterConfig, extensions: checkedValues as string[] })}
                style={{ width: '100%' }}
              >
                <Space size={[20, 12]} wrap>
                  {[
                    { label: t('文本 (.txt)'), value: '.txt' },
                    { label: t('Word (.docx)'), value: '.docx' },
                    { label: t('Excel (.xlsx)'), value: '.xlsx' },
                    { label: t('PPT (.pptx)'), value: '.pptx' },
                    { label: t('PDF (.pdf)'), value: '.pdf' },
                    { label: t('CSV (.csv)'), value: '.csv' },
                    { label: t('HTML (.html)'), value: '.html' },
                    { label: t('JSON (.json)'), value: '.json' },
                    { label: t('XML (.xml)'), value: '.xml' },
                  ].map(opt => (
                    <Checkbox key={opt.value} value={opt.value}>{opt.label}</Checkbox>
                  ))}
                </Space>
              </Checkbox.Group>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        title={<Space><SettingOutlined style={{ color: '#1890ff' }} /><span>{t('其它全局设置')}</span></Space>}
        open={settingsVisible}
        onOk={() => setSettingsVisible(false)}
        onCancel={() => setSettingsVisible(false)}
        okText={t('确定')}
        cancelText={t('取消')}
        width={560}
        styles={{ body: { padding: '24px 0' } }}
        footer={[
          <Button key="back" onClick={() => setSettingsVisible(false)} style={{ height: 40, borderRadius: '6px', padding: '0 24px' }}>
            {t('取消')}
          </Button>,
          <Button key="submit" type="primary" onClick={() => setSettingsVisible(false)} style={{ height: 40, borderRadius: '6px', padding: '0 32px' }}>
            {t('确定')}
          </Button>,
        ]}
      >
        <div style={{ padding: '0 24px' }}>
          <Space direction="vertical" style={{ width: '100%' }} size={32}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 16, fontSize: '15px' }}>{t('处理设置')}</Text>
              <div style={{ background: '#f9f9f9', padding: '16px', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
                <Space direction="vertical" size="middle">
                  <Checkbox checked={backupBeforeModify} onChange={e => setBackupBeforeModify(e.target.checked)}>
                    {t('修改前自动备份 (仅覆盖模式下生效)')}
                  </Checkbox>
                  <Checkbox checked={skipHiddenFiles} onChange={e => setSkipHiddenFiles(e.target.checked)}>
                    {t('跳过隐藏文件/文件夹')}
                  </Checkbox>
                  <Checkbox checked={continueOnError} onChange={e => setContinueOnError(e.target.checked)}>
                    {t('遇到错误时继续处理下一个文件')}
                  </Checkbox>
                </Space>
              </div>
            </div>
            
            <div>
              <Text strong style={{ display: 'block', marginBottom: 16, fontSize: '15px' }}>{t('输出编码设置 (仅针对纯文本文件)')}</Text>
              <div style={{ background: '#f9f9f9', padding: '16px', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
                <Radio.Group value={targetEncoding} onChange={e => setTargetEncoding(e.target.value)}>
                  <Space size="large">
                    <Radio value="auto">{t('自动识别 (保持原编码)')}</Radio>
                    <Radio value="utf-8">{t('强制 UTF-8')}</Radio>
                    <Radio value="gbk">{t('强制 GBK (适合旧版 Excel)')}</Radio>
                  </Space>
                </Radio.Group>
                <Alert 
                  message={t('提示：Excel/Word/PPT 等 Office 文件不受此编码设置影响，将始终保存为标准格式。')} 
                  type="info" 
                  showIcon
                  style={{ marginTop: 16, borderRadius: '6px' }}
                />
              </div>
            </div>
          </Space>
        </div>
      </Modal>
      {/* 导入预览弹窗 */}
      <Modal
        title={
          <Space>
            <UploadOutlined />
            <span>{t('确认导入文件路径')}</span>
            <Tag color="blue">{t('{{count}} 个项目', { count: previewPaths.length })}</Tag>
          </Space>
        }
        open={previewVisible}
        onOk={async () => {
          setPreviewLoading(true);
          await addPathsToFileList(previewPaths);
          setPreviewLoading(false);
          setPreviewVisible(false);
          setPreviewPaths([]);
        }}
        onCancel={() => {
          setPreviewVisible(false);
          setPreviewPaths([]);
        }}
        confirmLoading={previewLoading}
        width={700}
        okText={t('全部导入')}
        cancelText={t('取消')}
      >
        <Paragraph>
          {t('以下是检测到的文件路径，点击“全部导入”将其添加到待处理列表中。')}
        </Paragraph>
        <div style={{ 
          maxHeight: '400px', 
          overflowY: 'auto', 
          background: '#f5f5f5', 
          padding: '12px', 
          borderRadius: '8px',
          border: '1px solid #d9d9d9'
        }}>
          <List
            size="small"
            dataSource={previewPaths.slice(0, 500)} // 限制预览数量防止卡顿
            renderItem={(item, index) => (
              <List.Item key={index} style={{ padding: '4px 0', borderBottom: '1px dashed #e8e8e8' }}>
                <Text ellipsis style={{ width: '100%', fontSize: '12px' }}>
                  <span style={{ color: '#999', marginRight: 8 }}>{index + 1}.</span>
                  {item}
                </Text>
              </List.Item>
            )}
          />
          {previewPaths.length > 500 && (
            <div style={{ textAlign: 'center', padding: '12px 0', color: '#999' }}>
              {t('更多 {{count}} 个项目未显示...', { count: previewPaths.length - 500 })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
