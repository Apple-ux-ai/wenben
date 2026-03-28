import { ReactNode } from 'react';
import type { TFunction } from '../i18n';

export type ToolCategory = 'content' | 'convert' | 'split-merge';

export interface ToolModule {
  id: string;
  title: string;
  description: string;
  category: ToolCategory;
  icon: ReactNode;
  component: React.ComponentType<any>;
  tag?: string; // 如 'HOT'
  themeColor?: string; // 模块主题色，用于视觉区分
}

export interface CategoryInfo {
  key: ToolCategory | 'all';
  label: string;
}

export const getCategories = (t: TFunction): CategoryInfo[] => [
  { key: 'all', label: t('全部') },
  { key: 'content', label: t('文件内容') },
  { key: 'convert', label: t('格式转换') },
  { key: 'split-merge', label: t('合并拆分') },
];
