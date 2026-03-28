/**
 * 功能：历史记录管理 Hook，负责记录用户点击的功能并持久化到 localStorage
 * 作者：FullStack-Guardian
 * 更新时间：2026-03-05
 */
import { useState, useEffect } from 'react';

export interface HistoryItem {
  key: string;
  title?: string;
  timestamp: number;
}

const MAX_HISTORY_COUNT = 5;
const HISTORY_STORAGE_KEY = 'app_usage_history';

export const useHistory = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load history', e);
    }
  }, []);

  const addToHistory = (item: { key: string; title?: string }) => {
    try {
      // 1. 同步读取最新数据 (防止依赖的 state 是旧的或未加载完成)
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      const currentHistory: HistoryItem[] = stored ? JSON.parse(stored) : [];

      // 2. 处理数据逻辑：去重、置顶、限制数量
      const filtered = currentHistory.filter((i) => i.key !== item.key);
      const newItem: HistoryItem = {
        key: item.key,
        title: item.title,
        timestamp: Date.now(),
      };
      const newHistory = [newItem, ...filtered].slice(0, MAX_HISTORY_COUNT);

      // 3. 同步写入 localStorage (确保在组件卸载前完成)
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));

      // 4. 更新 React 状态 (如果组件还挂载着，UI 会更新)
      setHistory(newHistory);
    } catch (e) {
      console.error('Failed to save history', e);
    }
  };

  const removeFromHistory = (key: string) => {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      const currentHistory: HistoryItem[] = stored ? JSON.parse(stored) : [];
      
      const newHistory = currentHistory.filter((i) => i.key !== key);
      
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
      setHistory(newHistory);
    } catch (e) {
      console.error('Failed to remove from history', e);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  };

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
  };
};
