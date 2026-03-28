import { ReactNode } from 'react';

export interface BaseFileItem {
  uid: string;
  name: string;
  path: string;
  size?: number;
  status: 'pending' | 'processing' | 'success' | 'error' | 'detecting' | 'paused';
  error?: string;
  outputPath?: string;
  // 允许扩展其他属性
  [key: string]: any;
}

export interface ToolModuleProps {
  // 可以定义通用的 Props
}
