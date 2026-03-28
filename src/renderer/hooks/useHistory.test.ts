/**
 * 功能：历史记录管理 Hook 单元测试
 * 作者：FullStack-Guardian
 * 更新时间：2026-03-05
 */
import { renderHook, act } from '@testing-library/react';
import { useHistory } from './useHistory';
import { describe, it, expect, beforeEach } from 'vitest';

describe('useHistory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should initialize with empty history', () => {
    const { result } = renderHook(() => useHistory());
    expect(result.current.history).toEqual([]);
  });

  it('should add item to history', () => {
    const { result } = renderHook(() => useHistory());
    
    act(() => {
      result.current.addToHistory({ key: 'test', title: 'Test Feature' });
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].key).toBe('test');
    expect(result.current.history[0].title).toBe('Test Feature');
  });

  it('should limit history to 5 items', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      for (let i = 0; i < 10; i++) {
        result.current.addToHistory({ key: `key-${i}`, title: `Title ${i}` });
      }
    });

    expect(result.current.history).toHaveLength(5);
    // The last added item should be at the top (index 0)
    expect(result.current.history[0].key).toBe('key-9');
    // The oldest item in the list should be key-5 (since 0-4 were pushed out)
    expect(result.current.history[4].key).toBe('key-5');
  });

  it('should move existing item to top when re-added', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.addToHistory({ key: '1', title: '1' });
      result.current.addToHistory({ key: '2', title: '2' });
    });

    expect(result.current.history[0].key).toBe('2');

    act(() => {
      result.current.addToHistory({ key: '1', title: '1' });
    });

    expect(result.current.history[0].key).toBe('1');
    expect(result.current.history[1].key).toBe('2');
    expect(result.current.history).toHaveLength(2);
  });

  it('should clear history', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.addToHistory({ key: 'test', title: 'Test' });
      result.current.clearHistory();
    });

    expect(result.current.history).toEqual([]);
    expect(localStorage.getItem('app_usage_history')).toBeNull();
  });

  it('should persist history in localStorage', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.addToHistory({ key: 'test', title: 'Test' });
    });

    const stored = JSON.parse(localStorage.getItem('app_usage_history') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].key).toBe('test');
  });
});
