import { useState, useCallback, useRef } from 'react';
import { message } from 'antd';
import { useT } from '../../../i18n';
import { BaseFileItem } from '../types/tool-common';

// 模拟文件扫描 (实际项目中可能需要调用 Electron API)
// 这里假设传入的 file 对象有 path 属性
const scanFolder = async (path: string): Promise<any[]> => {
  // 在实际 Electron 环境中，这里应该调用 main process 的方法
  // 由于我无法直接修改 main process，这里假设用户已经有相关实现或使用简单的 file list
  return []; 
};

export const useFileManager = <T extends BaseFileItem = BaseFileItem>(initialFiles: T[] = []) => {
  const t = useT();
  const [fileList, setFileList] = useState<T[]>(initialFiles);
  const [selectedFileKeys, setSelectedFileKeys] = useState<React.Key[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // 添加文件
  const addFiles = useCallback((files: any[]) => {
    const existingPaths = new Set(fileList.map(f => f.path));
    const newFiles: T[] = [];
    
    files.forEach(file => {
      // 简单去重
      const path = file.path || (file.originFileObj && file.originFileObj.path);
      if (path && !existingPaths.has(path)) {
         // 构建基础 FileItem
         const newItem: any = {
           uid: file.uid || Math.random().toString(36).substr(2, 9),
           name: file.name,
           path: path,
           size: file.size,
           status: 'pending',
           ...file // 保留其他属性
         };
         newFiles.push(newItem);
         existingPaths.add(path);
      }
    });
    
    if (newFiles.length > 0) {
      setFileList(prev => [...prev, ...newFiles]);
      message.success(t('已添加 {{count}} 个文件', { count: newFiles.length }));
    }
  }, [fileList, t]);

  // 移除文件
  const removeFile = useCallback((uid: string) => {
    setFileList(prev => prev.filter(f => f.uid !== uid));
    setSelectedFileKeys(prev => prev.filter(k => k !== uid));
  }, []);

  // 批量移除
  const removeSelectedFiles = useCallback(() => {
    if (selectedFileKeys.length === 0) return;
    
    setFileList(prev => prev.filter(f => !selectedFileKeys.includes(f.uid)));
    setSelectedFileKeys([]);
    message.success(t('已移除选中文件'));
  }, [selectedFileKeys, t]);

  // 清空列表
  const clearAllFiles = useCallback(() => {
    setFileList([]);
    setSelectedFileKeys([]);
  }, []);

  // 更新文件状态
  const updateFile = useCallback((uid: string, updates: Partial<T>) => {
    setFileList(prev => prev.map(f => f.uid === uid ? { ...f, ...updates } : f));
  }, []);

  // 更新所有文件状态
  const updateAllFiles = useCallback((updates: Partial<T> | ((f: T) => Partial<T>)) => {
    setFileList(prev => prev.map(f => {
      const newValues = typeof updates === 'function' ? updates(f) : updates;
      return { ...f, ...newValues };
    }));
  }, []);

  return {
    fileList,
    setFileList,
    selectedFileKeys,
    setSelectedFileKeys,
    addFiles,
    removeFile,
    removeSelectedFiles,
    clearAllFiles,
    updateFile,
    updateAllFiles,
    isProcessing,
    setIsProcessing
  };
};
