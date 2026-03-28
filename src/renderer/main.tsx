import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import App from './App';
import 'antd/dist/reset.css';
import './index.css';
import { I18nProvider, isRtlLocale, useI18n } from './i18n';

declare global {
  interface Window {
    electron: {
      processEncoding: (options: { 
        files: { path: string; sourceEncoding?: string; outputPath?: string }[], 
        targetEncoding: string, 
        outputDir?: string, 
        maintainDirStructure?: boolean 
      }) => Promise<any>;
      detectEncoding: (filePaths: string[]) => Promise<any>;
      selectDirectory: () => Promise<string | undefined>;
      openDirectory: (dirPath: string) => Promise<void>;
      ensureDir: (dirPath: string) => Promise<any>;
      processRules: (filePaths: string[], rules: any[], options: any) => Promise<any>;
      getFileInfo: (filePath: string) => Promise<any>;
      selectFiles: (options?: any) => Promise<string[]>;
      getDirectoryFiles: (dirPath: string) => Promise<{ name: string; path: string; relDir?: string; size?: number }[]>;
      getFileDetails: (filePaths: string[]) => Promise<any[]>;
      getClipboardText: () => Promise<string>;
      checkPathExists: (filePath: string) => Promise<boolean>;
      readFile: (filePath: string) => Promise<string>;
      writeFile: (filePath: string, content: string) => Promise<void>;
      writeBinaryFile: (filePath: string, content: Uint8Array) => Promise<boolean>;
      deleteFile: (filePath: string) => Promise<boolean>;
      showSaveDialog: (options: any) => Promise<string | undefined>;
      parseExcelRules: (filePath: string) => Promise<any[]>;
      generateExcelTemplate: (filePath: string) => Promise<boolean>;
      processExcelBatch: (dataList: any[], options: any) => Promise<any>;
      scanFoldersForImport: (dirPath: string, mode: string) => Promise<any[]>;
      extractDirectoryList: (folderPaths: string[], options: any) => Promise<string>;
      generateFromTemplate: (options: any) => Promise<any>;
      checkTemplateConflicts: (options: any) => Promise<any>;
      getExcelHeaders: (filePath: string, headerRow?: number) => Promise<string[] | { headers: string[]; sheetName: string }>;
      removeEmptyLines: (filePath: string, targetPath?: string) => Promise<any>;
      removeDuplicateLines: (filePath: string, targetPath?: string) => Promise<any>;
      modifyLines: (filePath: string, targetPath: string | undefined, options: any) => Promise<any>;
      insertLines: (filePath: string, targetPath: string | undefined, options: any) => Promise<any>;
      convertToDocx: (content: string) => Promise<Uint8Array>;
      convertToPdf: (content: string) => Promise<Uint8Array>;
      convertToXlsx: (content: string) => Promise<Uint8Array>;
      convertImageToPdf: (image: Uint8Array) => Promise<Uint8Array>;
      convertHtmlToFormat: (filePath: string, format: string, outputDir: string) => Promise<boolean>;
      splitFile: (filePath: string, options: any) => Promise<any>;
      checkSplitConflict: (filePath: string, options: any) => Promise<any>;
      mergeTextFiles: (filePaths: string[], options: any) => Promise<any>;
      auth: {
        getLoginUrl: () => Promise<string>;
        generateNonce: () => Promise<{ signedNonce: any; encodedNonce: string }>;
        pollToken: (encodedNonce: string) => Promise<string | null>;
        checkLogin: (token: string) => Promise<boolean>;
        getUserInfo: (token: string) => Promise<any>;
        logout: (token: string) => Promise<boolean>;
        openExternal: (url: string) => Promise<void>;
        getMachineCode: () => Promise<string>;
        checkNeedAuth: (machineCode: string) => Promise<{ isNeed: boolean; authCodeUrl?: string }>;
        validAuth: (machineCode: string, authCode: string) => Promise<{ valid: boolean; msg: string }>;
        getCustomUrl: () => Promise<string>;
      };
      adv: {
        getAdv: (position: string) => Promise<any>;
      };
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
    };
  }
}

const AntdLocaleProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { locale } = useI18n();
  const antdLocale = locale.toLowerCase().startsWith('en') ? enUS : zhCN;
  return (
    <ConfigProvider locale={antdLocale} direction={isRtlLocale(locale) ? 'rtl' : 'ltr'}>
      {children}
    </ConfigProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      <AntdLocaleProvider>
        <App />
      </AntdLocaleProvider>
    </I18nProvider>
  </React.StrictMode>
);
