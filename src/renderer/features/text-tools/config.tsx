import React from 'react';
import { ToolModule } from '../../types/module';
import type { TFunction } from '../../i18n';
import { 
  EditOutlined, 
  DeleteOutlined, 
  FileAddOutlined, 
  SwapOutlined,
  MergeCellsOutlined,
  SplitCellsOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  LayoutOutlined,
  BgColorsOutlined,
  FileMarkdownOutlined,
  Html5Outlined,
  DeploymentUnitOutlined,
  RetweetOutlined
} from '@ant-design/icons';

import { EncodingConverter } from './modules/EncodingConverter';
import { RuleBasedModifier } from './modules/RuleBasedModifier';
import { ExcelRuleModifier } from './modules/ExcelRuleModifier';
import { TemplateGenerator } from './modules/TemplateGenerator';
import { EmptyLineRemover } from './modules/EmptyLineRemover';
import { DuplicateRemover } from './modules/DuplicateRemover';
import { LineModifier } from './modules/LineModifier';
import { LineInserter } from './modules/LineInserter';
import { TextToFormatConverter } from './modules/TextToFormatConverter';
import { HtmlToFormatConverter } from './modules/HtmlToFormatConverter';
import { DirectoryListExtractor } from './modules/DirectoryListExtractor';
import { JsonConverter } from './modules/JsonConverter';
import { MarkdownConverter } from './modules/MarkdownConverter';
import { TextFileSplitter } from './modules/TextFileSplitter';
import { TextFileMerger } from './modules/TextFileMerger';

export const getTextToolModules = (t: TFunction): ToolModule[] => [
  // --- 文件内容处理 ---
  {
    id: 'encoding-converter',
    title: t('修改文本文件编码'),
    description: t('批量修改文本文件的编码格式，支持：UTF-8、BIG5、GBK、GB2312、GB18030等相互转换。'),
    category: 'content',
    icon: <BgColorsOutlined />,
    component: EncodingConverter,
    themeColor: '#531dab' // Purple 7
  },
  {
    id: 'template-generator',
    title: t('根据模板生成文本文件'),
    description: t('根据 Txt 模板和 Excel 数据，批量生成个性化文本文件。'),
    category: 'content',
    icon: <LayoutOutlined />,
    component: TemplateGenerator,
    themeColor: '#d46b08' // Orange 7
  },
  {
    id: 'empty-line-remover',
    title: t('删除文本文件空白行'),
    description: t('批量删除文本文件中的空白行。'),
    category: 'content',
    icon: <DeleteOutlined />,
    component: EmptyLineRemover,
    themeColor: '#c41d7f' // Pink 7
  },
  {
    id: 'duplicate-remover',
    title: t('删除文本文件重复行'),
    description: t('批量删除 txt、html、xml 等文本文件中的重复行。'),
    category: 'content',
    icon: <DeploymentUnitOutlined />,
    component: DuplicateRemover,
    themeColor: '#1d39c4' // Indigo 7
  },
  {
    id: 'line-remover-replacer',
    title: t('删除或替换文本文件的行'),
    description: t('批量删除文本文件中的指定行或将文本文件中的行进行替换。'),
    category: 'content',
    icon: <SwapOutlined />,
    component: LineModifier,
    themeColor: '#08979c' // Cyan 7
  },
  {
    id: 'line-inserter',
    title: t('在文本文件的指定位置插入行'),
    description: t('批量在文本文件中的指定位置插入行。'),
    category: 'content',
    icon: <FileAddOutlined />,
    component: LineInserter
  },
  {
    id: 'rule-editor',
    title: t('按规则修改文本文件内容'),
    description: t('用于批量在文本文件中查找并替换/删除相关内容。'),
    category: 'content',
    icon: <EditOutlined />,
    component: RuleBasedModifier,
    themeColor: '#096dd9' // Blue 7
  },
  {
    id: 'excel-rule-editor',
    title: t('导入 Excel 规则修改文本文件内容'),
    description: t('当不同的文本文件有不同的修改规则的时候，可以导入 Excel。'),
    category: 'content',
    icon: <FileExcelOutlined />,
    component: ExcelRuleModifier,
    themeColor: '#389e0d' // Green 7
  },

  // --- 格式转换 ---
  {
    id: 'text-convert',
    title: t('文本文件转换为其它格式'),
    description: t('批量将文本文件转换为 docx、pdf、xlsx、html、图片等格式。'),
    category: 'convert',
    icon: <RetweetOutlined />,
    component: TextToFormatConverter,
    themeColor: '#13c2c2' // Cyan 7
  },
  {
    id: 'html-convert',
    title: t('HTML 转换为其它格式'),
    description: t('批量将 html 转换为 txt、docx、pdf 等格式。'),
    category: 'convert',
    icon: <Html5Outlined />,
    component: HtmlToFormatConverter,
    themeColor: '#ff4d4f' // Red 5
  },
  {
    id: 'json-convert',
    title: t('JSON 转换为其它格式'),
    description: t('批量将 JSON 文件转换为可视化的思维导图、Excel 等。'),
    category: 'convert',
    icon: <DeploymentUnitOutlined />,
    component: JsonConverter,
    themeColor: '#13c2c2' // Cyan 7
  },
  {
    id: 'markdown-convert',
    title: t('Markdown 转换为其它格式'),
    description: t('批量将 Markdown 转换为 docx、pdf 等格式。'),
    category: 'convert',
    icon: <FileMarkdownOutlined />,
    component: MarkdownConverter,
    themeColor: '#eb2f96' // Pink 6
  },

  // --- 合并拆分 ---
  {
    id: 'text-split',
    title: t('文本文件拆分成多个文件'),
    description: t('将文本文件按指定行数或文件数量拆分成多个文本文件。'),
    category: 'split-merge',
    icon: <SplitCellsOutlined />,
    component: TextFileSplitter,
    themeColor: '#eb2f96' // Magenta 7
  },
  {
    id: 'text-merge',
    title: t('文本文件合并成单个文件'),
    description: t('将所有文本文件合并成一个文件，也可以按指定规则合并。'),
    category: 'split-merge',
    icon: <MergeCellsOutlined />,
    component: TextFileMerger,
    themeColor: '#13c2c2'
  }
];
