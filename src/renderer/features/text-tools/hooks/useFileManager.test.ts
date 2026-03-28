import { renderHook, act } from '@testing-library/react';
import { useFileManager } from './useFileManager';
import { message } from 'antd';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock antd message
vi.mock('antd', () => ({
  message: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('useFileManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useFileManager());
    expect(result.current.fileList).toEqual([]);
    expect(result.current.selectedFileKeys).toEqual([]);
    expect(result.current.isProcessing).toBe(false);
  });

  it('should add files correctly', () => {
    const { result } = renderHook(() => useFileManager());
    const file1 = { uid: '1', name: 'test1.txt', path: '/path/test1.txt', size: 100 };
    
    act(() => {
      result.current.addFiles([file1]);
    });

    expect(result.current.fileList).toHaveLength(1);
    expect(result.current.fileList[0]).toMatchObject({
      name: 'test1.txt',
      path: '/path/test1.txt',
      status: 'pending'
    });
    expect(message.success).toHaveBeenCalledWith(expect.stringContaining('已添加 1 个文件'));
  });

  it('should prevent duplicate files', () => {
    const { result } = renderHook(() => useFileManager());
    const file1 = { uid: '1', name: 'test1.txt', path: '/path/test1.txt' };
    
    act(() => {
      result.current.addFiles([file1]);
    });
    
    act(() => {
      result.current.addFiles([file1]); // Try adding again
    });

    expect(result.current.fileList).toHaveLength(1);
    // message.success should only be called once
    expect(message.success).toHaveBeenCalledTimes(1);
  });

  it('should remove file by uid', () => {
    const { result } = renderHook(() => useFileManager());
    const file1 = { uid: '1', name: 'test1.txt', path: '/path/test1.txt' };
    
    act(() => {
      result.current.addFiles([file1]);
    });
    
    const addedFileUid = result.current.fileList[0].uid;
    
    act(() => {
      result.current.removeFile(addedFileUid);
    });

    expect(result.current.fileList).toHaveLength(0);
  });

  it('should handle batch removal', () => {
    const { result } = renderHook(() => useFileManager());
    const file1 = { uid: '1', name: 'test1.txt', path: '/path/test1.txt' };
    const file2 = { uid: '2', name: 'test2.txt', path: '/path/test2.txt' };
    
    act(() => {
      result.current.addFiles([file1, file2]);
    });
    
    // Select file1
    act(() => {
      result.current.setSelectedFileKeys(['1']);
    });
    
    act(() => {
      result.current.removeSelectedFiles();
    });

    expect(result.current.fileList).toHaveLength(1);
    expect(result.current.fileList[0].uid).toBe('2');
    expect(result.current.selectedFileKeys).toEqual([]);
    expect(message.success).toHaveBeenCalledWith('已移除选中文件');
  });

  it('should clear all files', () => {
    const { result } = renderHook(() => useFileManager());
    const file1 = { uid: '1', name: 'test1.txt', path: '/path/test1.txt' };
    
    act(() => {
      result.current.addFiles([file1]);
      result.current.setSelectedFileKeys(['1']);
    });
    
    act(() => {
      result.current.clearAllFiles();
    });

    expect(result.current.fileList).toHaveLength(0);
    expect(result.current.selectedFileKeys).toEqual([]);
  });

  it('should update file status', () => {
    const { result } = renderHook(() => useFileManager());
    const file1 = { uid: '1', name: 'test1.txt', path: '/path/test1.txt', status: 'pending' };
    
    act(() => {
      result.current.addFiles([file1]);
    });
    
    act(() => {
      result.current.updateFile('1', { status: 'success' });
    });

    expect(result.current.fileList[0].status).toBe('success');
  });
});
