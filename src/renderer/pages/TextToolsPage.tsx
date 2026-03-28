import React, { useState } from 'react';
import { Row, Col, Tabs, Empty } from 'antd';
import { FunctionCard } from '../components/shared/FunctionCard';
import { TutorialModal, TutorialData } from '../components/shared/TutorialModal';
import { getTextToolModules } from '../features/text-tools/config';
import { ToolCategory } from '../types/module';
import { ModuleLayout } from '../features/text-tools/components/ModuleLayout';
import { useHistory } from '../hooks/useHistory';
import { useT } from '../i18n';

// 教程数据
const MODULE_TUTORIALS: Record<string, TutorialData> = {
  'rule-editor': {
    title: '按规则修改文本文件内容',
    steps: [
      { 
        title: '添加待处理文件', 
        description: '点击“添加文件”按钮或直接将文件/文件夹拖拽至软件界面。支持批量导入多种格式的文本文件。'
      },
      { 
        title: '设置修改规则', 
        description: '您可以选择“精确查找”或“正则查找”。在查找框输入需要定位的内容，在替换框输入新内容（若为空则表示删除查找到的内容）。'
      },
      { 
        title: '执行批量处理', 
        description: '点击“开始批量修改”按钮，系统将根据您设定的规则顺序，依次对所有文件进行内容替换或删除。' 
      },
      { 
        title: '查看处理结果', 
        description: '处理完成后，您可以直接在软件中预览修改后的文件内容，或打开输出目录查看文件。' 
      }
    ],
    notes: [
      '支持多条规则组合使用，系统将按从上到下的顺序依次执行。',
      '正则查找支持标准的 JavaScript 正则表达式语法。'
    ]
  },
  'excel-rule-editor': {
    title: '导入 Excel 规则修改文本文件内容',
    steps: [
      {
        title: '准备 Excel 规则表',
        description: '创建一个 Excel 文件，第一列填写“查找内容”，第二列填写“替换内容”。'
      },
      {
        title: '导入规则与文件',
        description: '在软件中导入准备好的 Excel 规则文件，以及需要处理的文本文件。'
      },
      {
        title: '执行批量替换',
        description: '点击开始处理，软件将根据 Excel 中的每一行规则，对所有文本文件进行批量替换操作。'
      }
    ],
    notes: [
      'Excel 文件建议使用 .xlsx 格式。',
      '如果替换内容为空，则表示删除查找到的内容。'
    ]
  },
  'encoding-converter': {
    title: '修改文本文件编码',
    steps: [
      {
        title: '导入文件',
        description: '将需要转换编码的文本文件添加到列表中，软件会自动检测当前的编码格式。'
      },
      {
        title: '选择目标编码',
        description: '在设置区域选择您希望转换成的目标编码（如 UTF-8, GBK 等）。'
      },
      {
        title: '开始转换',
        description: '点击转换按钮，文件将被重新编码并保存到指定目录。'
      }
    ],
    notes: [
      '建议在转换前备份重要文件，以防编码识别错误导致乱码。',
      '支持批量处理大量文件。'
    ]
  },
  'template-generator': {
    title: '根据模板生成文本文件',
    steps: [
      {
        title: '准备模板文件',
        description: '创建一个 .txt 模板文件，在需要替换的地方使用 {{变量名}} 进行标记。'
      },
      {
        title: '准备数据源',
        description: '准备一个 Excel 文件，表头名称需要与模板中的 {{变量名}} 保持一致。'
      },
      {
        title: '生成文件',
        description: '导入模板和 Excel 数据，软件将为 Excel 中的每一行数据生成一个对应的文本文件。'
      }
    ],
    notes: [
      '生成的每一行数据都会对应一个新的文件。',
      '文件名也可以通过模板变量来动态命名。'
    ]
  },
  'empty-line-remover': {
    title: '删除文本文件空白行',
    steps: [
      {
        title: '添加文件',
        description: '导入包含大量空白行的文本文件。'
      },
      {
        title: '选择清理模式',
        description: '您可以选择删除所有空白行，或者仅删除连续的空白行（保留一行）。'
      },
      {
        title: '执行清理',
        description: '点击开始，软件将快速移除文件中的多余空行。'
      }
    ],
    notes: [
      '此操作不可逆，建议勾选“保存到新目录”以保留原文件。'
    ]
  },
  'duplicate-remover': {
    title: '删除文本文件重复行',
    steps: [
      {
        title: '导入文件',
        description: '支持 txt, csv, log 等多种文本格式。'
      },
      {
        title: '设置去重规则',
        description: '选择是完全匹配去重，还是忽略大小写去重。'
      },
      {
        title: '开始去重',
        description: '软件将扫描文件内容，自动移除重复出现的行，仅保留一份。'
      }
    ],
    notes: [
      '去重是基于“行”进行的，行内内容必须完全一致才会被视为重复。'
    ]
  },
  'line-remover-replacer': {
    title: '删除或替换文本文件的行',
    steps: [
      {
        title: '添加文件',
        description: '导入需要处理的文本文件。'
      },
      {
        title: '设置行操作',
        description: '选择“删除行”或“替换行”。可以指定行号（如第 1, 3, 5 行）或包含特定内容的行。'
      },
      {
        title: '执行操作',
        description: '点击开始，软件将按照您的设置批量修改文件内容。'
      }
    ],
    notes: [
      '行号从 1 开始计数。',
      '支持输入行号范围，例如 1-10。'
    ]
  },
  'line-inserter': {
    title: '在文本文件的指定位置插入行',
    steps: [
      {
        title: '选择文件',
        description: '导入目标文件。'
      },
      {
        title: '设置插入位置',
        description: '指定在第几行之前或之后插入内容，也可以选择在文件开头或结尾插入。'
      },
      {
        title: '输入插入内容',
        description: '在输入框中填写需要插入的文本内容。'
      },
      {
        title: '执行插入',
        description: '批量将内容插入到所有选定文件的指定位置。'
      }
    ],
    notes: [
      '支持插入多行文本。'
    ]
  },
  'text-convert': {
    title: '文本文件转换为其它格式',
    steps: [
      {
        title: '导入文本文件',
        description: '选择需要转换的 .txt 或其他纯文本文件。'
      },
      {
        title: '选择目标格式',
        description: '支持转换为 Word (.docx), PDF, Excel (.xlsx), 图片等格式。'
      },
      {
        title: '配置转换选项',
        description: '根据目标格式，您可以设置字体、页面大小或排版样式。'
      },
      {
        title: '开始转换',
        description: '点击转换，等待处理完成。'
      }
    ],
    notes: [
      '转换为 PDF 可能需要较长时间，请耐心等待。'
    ]
  },
  'html-convert': {
    title: 'HTML 转换为其它格式',
    steps: [
      {
        title: '添加 HTML 文件',
        description: '导入 .html 或 .htm 文件。'
      },
      {
        title: '选择输出格式',
        description: '通常用于将网页保存为 Word 文档、PDF 或纯文本。'
      },
      {
        title: '执行转换',
        description: '软件将解析 HTML 结构并尽可能保留原有的排版样式。'
      }
    ],
    notes: [
      '复杂的 CSS 样式在转换过程中可能会有部分丢失，属于正常现象。'
    ]
  },
  'json-convert': {
    title: 'JSON 转换为其它格式',
    steps: [
      {
        title: '导入 JSON 数据',
        description: '选择标准的 .json 文件。'
      },
      {
        title: '选择转换模式',
        description: '可以将 JSON 转换为 Excel 表格（扁平化处理）或思维导图结构。'
      },
      {
        title: '生成文件',
        description: '点击开始，获取转换后的文件。'
      }
    ],
    notes: [
      '转换为 Excel 时，嵌套过深的 JSON 对象可能会被展平或忽略。'
    ]
  },
  'markdown-convert': {
    title: 'Markdown 转换为其它格式',
    steps: [
      {
        title: '添加 Markdown 文件',
        description: '导入 .md 文件。'
      },
      {
        title: '选择目标格式',
        description: '支持转换为带样式的 Word 文档、PDF 或 HTML。'
      },
      {
        title: '执行转换',
        description: 'Markdown 语法将被解析并渲染为对应的富文本格式。'
      }
    ],
    notes: [
      '支持标准的 CommonMark 语法。'
    ]
  },
  'text-split': {
    title: '文本文件拆分成多个文件',
    steps: [
      {
        title: '选择源文件',
        description: '导入一个较大的文本文件。'
      },
      {
        title: '选择拆分方式',
        description: '按行数拆分（例如每 1000 行一个文件）或按文件数量拆分（例如平均拆分为 5 个文件）。'
      },
      {
        title: '执行拆分',
        description: '软件将生成多个小文件，文件名通常会附带序号后缀。'
      }
    ],
    notes: [
      '拆分过程不会修改源文件内容。'
    ]
  },
  'text-merge': {
    title: '文本文件合并成单个文件',
    steps: [
      {
        title: '添加多个文件',
        description: '导入需要合并的一系列文本文件。'
      },
      {
        title: '调整顺序',
        description: '在列表中拖动文件或使用排序功能，确定合并的先后顺序。'
      },
      {
        title: '执行合并',
        description: '点击合并，所有文件内容将按顺序拼接成一个新的文本文件。'
      }
    ],
    notes: [
      '可以设置是否在合并的文件之间添加分隔符或换行符。'
    ]
  }
};

export interface TextToolsPageProps {
  searchValue?: string;
  activeCategory?: ToolCategory | 'all';
  onModuleSelectChange?: (isSelected: boolean) => void;
  initialModuleId?: string | null;
  onModuleSelected?: () => void;
  menuClickTick?: number;
}

export const TextToolsPage: React.FC<TextToolsPageProps> = ({ 
  searchValue = '', 
  activeCategory = 'all',
  onModuleSelectChange,
  initialModuleId = null,
  onModuleSelected,
  menuClickTick = 0
}) => {
  const t = useT();
  const textToolModules = React.useMemo(() => getTextToolModules(t), [t]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const isJumpingRef = React.useRef(false);
  const { addToHistory } = useHistory();
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [currentTutorial, setCurrentTutorial] = useState<TutorialData | null>(null);

  // 处理初始模块 ID 跳转
  React.useEffect(() => {
    if (initialModuleId) {
      isJumpingRef.current = true;
      setSelectedModuleId(initialModuleId);
      // 如果当前分类不匹配，可能需要父组件协调，但这里假设父组件已经切换到了正确的 category
      // 消费一次性跳转
      onModuleSelected?.();
    }
  }, [initialModuleId, onModuleSelected]);

  // 通知父组件模块选择状态
  React.useEffect(() => {
    onModuleSelectChange?.(!!selectedModuleId);
  }, [selectedModuleId, onModuleSelectChange]);

  // 当分类切换时，自动回到列表页
  React.useEffect(() => {
    if (isJumpingRef.current) {
      // 如果正在进行历史记录跳转，则不重置，并消耗掉这个锁定状态
      isJumpingRef.current = false;
      return;
    }
    setSelectedModuleId(null);
  }, [activeCategory, menuClickTick]);

  const filteredModules = React.useMemo(() => {
    const searchLower = searchValue.toLowerCase().trim();
    if (!searchLower) return textToolModules;
    
    return textToolModules.filter(module => 
      module.title.toLowerCase().includes(searchLower) || 
      module.description.toLowerCase().includes(searchLower)
    );
  }, [searchValue, textToolModules]);

  const handleViewTutorial = (moduleId: string) => {
    const raw = MODULE_TUTORIALS[moduleId];
    const tutorial: TutorialData = raw
      ? {
          title: t(raw.title),
          steps: raw.steps.map((step) => ({
            ...step,
            title: t(step.title),
            description: t(step.description),
          })),
          notes: raw.notes.map((note) => t(note)),
        }
      : {
          title: t('功能教程'),
          steps: [{ title: t('快速上手'), description: t('该功能的使用步骤正在完善中，请参考界面指引进行操作。') }],
          notes: [t('通用提示：操作前请确保文件未被锁定。')],
        };
    setCurrentTutorial(tutorial);
    setTutorialVisible(true);
  };

  // 获取当前选中的模块
  const selectedModule = textToolModules.find(m => m.id === selectedModuleId);
  const SelectedModuleComponent = selectedModule?.component;

  if (selectedModuleId && SelectedModuleComponent && selectedModule) {
    return (      <ModuleLayout 
        module={selectedModule} 
        onBack={() => setSelectedModuleId(null)}
      >
        <SelectedModuleComponent />
      </ModuleLayout>
    );
  }

  const renderCategorySection = (categoryKey: ToolCategory, label: string) => {
    const modules = filteredModules.filter(m => m.category === categoryKey);
    
    if (modules.length === 0) return null;

    return (
      <div style={{ marginBottom: 48 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: 24,
          paddingBottom: 12,
          borderBottom: '1px solid #f0f0f0'
        }}>
          <div style={{ 
            width: 4, 
            height: 20, 
            background: '#1890ff', 
            borderRadius: 2,
            marginRight: 12 
          }} />
          <span style={{ 
            fontSize: 18, 
            fontWeight: 600, 
            color: '#262626' 
          }}>
            {label}
          </span>
          <span style={{ 
            marginLeft: 12, 
            fontSize: 14, 
            color: '#8c8c8c',
            fontWeight: 'normal'
          }}>
            {t('({{count}} 个工具)', { count: modules.length })}
          </span>
        </div>
        <Row gutter={[24, 24]} style={{ display: 'flex', flexWrap: 'wrap' }}>
          {modules.map(module => (
            <Col key={module.id} xs={24} sm={12} md={8} lg={8} xl={8} style={{ display: 'flex' }}>
              <FunctionCard 
                title={module.title} 
                description={module.description}
                icon={module.icon}
                tag={module.tag}
                onClick={() => {
                  addToHistory({ key: module.id });
                  setSelectedModuleId(module.id);
                }}
                onViewTutorial={() => handleViewTutorial(module.id)}
              />
            </Col>
          ))}
        </Row>
      </div>
    );
  };

  return (
    <div>
      <div style={{ padding: '0' }}>
        {(activeCategory === 'all' || activeCategory === 'content') && renderCategorySection('content', t('文件内容处理'))}
        {(activeCategory === 'all' || activeCategory === 'convert') && renderCategorySection('convert', t('格式转换'))}
        {(activeCategory === 'all' || activeCategory === 'split-merge') && renderCategorySection('split-merge', t('合并拆分'))}
        
        {filteredModules.length === 0 ? (
          <Empty description={t('未找到匹配的功能模块')} style={{ marginTop: 60 }} />
        ) : (
          activeCategory !== 'all' && filteredModules.filter(m => m.category === activeCategory).length === 0 && (
            <Empty description={t('该分类下暂无匹配工具')} style={{ marginTop: 60 }} />
          )
        )}
      </div>

      <TutorialModal 
        visible={tutorialVisible} 
        onClose={() => setTutorialVisible(false)} 
        data={currentTutorial}
      />
    </div>
  );
};
