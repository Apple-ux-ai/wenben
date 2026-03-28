import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { message } from 'antd';
import { vi, describe, test, expect, beforeEach } from 'vitest';
// import '@testing-library/jest-dom'; // Remove this side-effect import

// Setup expect for jest-dom
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    checkAuth: () => true,
    requireAuth: (onSuccess: () => void) => onSuccess(),
  }),
}));

const globalAny: any = globalThis as any;
const window = globalAny.window || (globalAny.window = {});

// Mock electron API
const mockElectron = {
  selectFiles: vi.fn(),
  selectDirectory: vi.fn(),
  getFileInfo: vi.fn(),
  readFile: vi.fn(),
  getDirectoryFiles: vi.fn(),
  checkPathExists: vi.fn(),
  getClipboardText: vi.fn(),
  getExcelHeaders: vi.fn(),
  generateFromTemplate: vi.fn(),
  openDirectory: vi.fn(),
};

// Setup window.electron
Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock message
vi.mock('antd', async () => {
  const actual: any = await vi.importActual('antd');
  const mockedMessage = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    destroy: vi.fn(),
  };
  const MockDragger = ({ beforeUpload, multiple, children }: any) => {
    return (
      <div>
        <input
          data-testid="dragger-input"
          type="file"
          multiple={multiple}
          onChange={(e) => {
            const target = e.target as HTMLInputElement;
            const rawFiles = (target as any)._mockFiles ?? target.files;
            const fileList = Array.isArray(rawFiles)
              ? rawFiles
              : rawFiles
                ? Array.from(rawFiles as any)
                : [];
            for (const file of fileList) {
              beforeUpload?.(file);
            }
            target.value = '';
          }}
        />
        {children}
      </div>
    );
  };
  const Upload = Object.assign(actual.Upload, { Dragger: MockDragger });
  const App = Object.assign(actual.App, {
    useApp: () => ({ message: mockedMessage }),
  });
  const Popconfirm = ({ onConfirm, disabled, children }: any) => {
    if (disabled) return children;
    if (!React.isValidElement(children)) return children;
    const originalOnClick = (children as any).props?.onClick;
    return React.cloneElement(children as any, {
      onClick: async (e: any) => {
        originalOnClick?.(e);
        await onConfirm?.();
      },
    });
  };
  const Modal = ((props: any) => React.createElement(actual.Modal, props)) as any;
  Object.assign(Modal, actual.Modal);
  Modal.confirm = vi.fn();
  return {
    ...actual,
    Upload,
    App,
    message: mockedMessage,
    Modal,
    Popconfirm,
  };
});

describe('TemplateGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const loadComponent = async () => {
    const mod = await import('./TemplateGenerator');
    return mod.TemplateGenerator;
  };

  test('renders step 0 correctly', async () => {
    const TemplateGenerator = await loadComponent();
    render(<TemplateGenerator />);
    expect(screen.getAllByText('文件列表').length).toBeGreaterThan(0);
    expect(screen.getAllByText('添加文件').length).toBeGreaterThan(0);
    expect(screen.getAllByText('导入文件夹').length).toBeGreaterThan(0);
  });

  test('adds file successfully', async () => {
    const TemplateGenerator = await loadComponent();
    mockElectron.readFile.mockResolvedValue('hello [姓名]');

    const { container } = render(<TemplateGenerator />);

    const input = container.querySelector('[data-testid="dragger-input"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    const file: any = new File(['hello'], 'test.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'path', { value: 'C:\\test.txt' });
    (input as any)._mockFiles = [file];
    fireEvent.change(input);

    await waitFor(() => {
      expect(within(container).getByText('test.txt')).toBeTruthy();
    });
  });

  test('imports from folder successfully', async () => {
    const TemplateGenerator = await loadComponent();
    mockElectron.selectDirectory.mockResolvedValue('C:\\test');
    mockElectron.getDirectoryFiles.mockResolvedValue([
      { name: 'file1.txt', path: 'C:\\test\\file1.txt' },
      { name: 'file2.txt', path: 'C:\\test\\file2.txt' }
    ]);

    render(<TemplateGenerator />);
    
    const importButtonText = screen.getAllByText('导入文件夹')[0];
    const importButton = importButtonText.closest('button');
    expect(importButton).toBeTruthy();
    fireEvent.click(importButton as HTMLButtonElement);

    await waitFor(() => {
      expect(mockElectron.selectDirectory).toHaveBeenCalled();
      expect(mockElectron.getDirectoryFiles).toHaveBeenCalled();
    });
  });

  test('clears list successfully', async () => {
    const TemplateGenerator = await loadComponent();
    mockElectron.readFile.mockResolvedValue('hello [姓名]');

    const { container } = render(<TemplateGenerator />);
    const input = container.querySelector('[data-testid="dragger-input"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    const templateCardTitle = within(container).getByText('文件列表');
    const templateCard = templateCardTitle.closest('.ant-card') as HTMLElement | null;
    expect(templateCard).toBeTruthy();
    const file: any = new File(['hello'], 'test.txt', { type: 'text/plain' });
    Object.defineProperty(file, 'path', { value: 'C:\\test.txt' });
    (input as any)._mockFiles = [file];
    fireEvent.change(input);

    await waitFor(() => {
      expect(within(templateCard as HTMLElement).getByText('test.txt')).toBeTruthy();
    });

    // Then clear list
    const clearButton = within(templateCard as HTMLElement).getByText('清空').closest('button');
    expect(clearButton).toBeTruthy();
    fireEvent.click(clearButton as HTMLButtonElement);

    await waitFor(() => {
      expect(within(templateCard as HTMLElement).queryByText('test.txt')).toBeNull();
      expect(within(templateCard as HTMLElement).getByText('点击或拖拽文件到此区域')).toBeTruthy();
    });
  });

  test('imports from clipboard', async () => {
    const TemplateGenerator = await loadComponent();
    mockElectron.getClipboardText.mockResolvedValue('C:\\test1.txt\nC:\\test2.txt');
    mockElectron.checkPathExists.mockResolvedValue(true);
    mockElectron.getFileInfo.mockResolvedValue({
      name: 'test.txt',
      size: '1KB',
      sizeBytes: 1024,
      ext: '.txt',
      modifiedAt: '2024-01-01',
    });

    render(<TemplateGenerator />);

    expect(screen.getAllByText('文件列表').length).toBeGreaterThan(0);
  });
});
