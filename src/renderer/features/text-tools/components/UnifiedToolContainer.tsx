import React, { ReactNode } from 'react';
import { 
  Card, 
  Button, 
  Upload, 
  Table, 
  Space, 
  Typography, 
  Tooltip, 
  Popconfirm, 
  Empty 
} from 'antd';
import { 
  InboxOutlined, 
  DeleteOutlined, 
  FileTextOutlined, 
  ClearOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { BaseFileItem } from '../types/tool-common';
import type { ColumnsType } from 'antd/es/table';
import { useT } from '../../../i18n';

const { Dragger } = Upload;
const { Title, Text } = Typography;

interface UnifiedToolContainerProps<T extends BaseFileItem> {
  // 文件管理状态 (来自 useFileManager)
  fileList: T[];
  selectedFileKeys: React.Key[];
  onSelectionChange: (keys: React.Key[]) => void;
  onFilesAdd: (files: any[]) => void;
  onFileRemove: (uid: string) => void;
  onFilesRemoveBatch: () => void;
  onFilesClear: () => void;
  
  // 列表配置
  columns: ColumnsType<T>;
  rowKey?: string;
  
  // 区域渲染
  settingsContent: ReactNode; // 中间设置区
  actionsContent: ReactNode;  // 底部操作区
  
  // 其他
  title?: string;
  processing?: boolean;
  extraHeaderActions?: ReactNode;
  uploadHint?: string;
  accept?: string;
}

export function UnifiedToolContainer<T extends BaseFileItem>({
  fileList,
  selectedFileKeys,
  onSelectionChange,
  onFilesAdd,
  onFileRemove,
  onFilesRemoveBatch,
  onFilesClear,
  columns,
  rowKey = 'uid',
  settingsContent,
  actionsContent,
  title,
  processing = false,
  extraHeaderActions,
  uploadHint,
  accept
}: UnifiedToolContainerProps<T>) {
  const t = useT();
  // 默认的上传属性
  const uploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: false,
    accept,
    beforeUpload: (file: any, fileList: any[]) => {
      const nextFiles = Array.isArray(fileList) && fileList.length > 0 ? fileList : [file];
      onFilesAdd(nextFiles);
      return false; // 阻止自动上传
    },
    directory: false,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .unified-tool-dragger {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .unified-tool-dragger .ant-upload.ant-upload-drag {
          height: 100% !important;
          background-color: #ffffff;
          border: 1px dashed #1677ff !important;
          border-radius: 8px !important;
          transition: all 0.3s;
        }
        .unified-tool-dragger .ant-upload-wrapper {
          height: 100%;
          display: flex;
        }
        .unified-tool-dragger .ant-upload.ant-upload-drag:hover {
          border-color: #4096ff !important;
        }
        .unified-tool-dragger .ant-upload-btn {
          height: 100% !important;
          padding: 0 !important;
          display: flex !important;
          flex-direction: column;
          justify-content: center;
        }
        .unified-tool-dragger .ant-upload-drag-container {
          height: 100% !important;
          width: 100%;
          display: flex !important;
          flex-direction: column;
        }
      `}</style>
      <div style={{ paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* 1. 文件导入与列表区 */}
        <Card 
          title={
            <Space>
              <span>{t('文件列表')}</span>
              <Text type="secondary" style={{ fontSize: '14px', fontWeight: 'normal' }}>
                {t('(共 {{count}} 个文件)', { count: fileList.length })}
              </Text>
            </Space>
          }
          size="small"
          extra={
            <Space>
              {extraHeaderActions}
              <Button 
                danger 
                icon={<DeleteOutlined />} 
                disabled={selectedFileKeys.length === 0 || processing}
                onClick={onFilesRemoveBatch}
              >
                {t('删除选中')}
              </Button>
              <Popconfirm 
                title={t('确定清空列表吗？')} 
                onConfirm={onFilesClear}
                disabled={fileList.length === 0 || processing}
              >
                <Button 
                  icon={<ClearOutlined />} 
                  disabled={fileList.length === 0 || processing}
                >
                  {t('清空')}
                </Button>
              </Popconfirm>
            </Space>
          }
          styles={{ body: { padding: '16px', display: 'flex', flexDirection: 'column', height: '400px' } }}
        >
          <div className="unified-tool-dragger">
            <Dragger 
              {...uploadProps} 
              style={{ 
                height: '100%', 
              }}
              disabled={processing}
              showUploadList={false}
              openFileDialogOnClick={fileList.length === 0}
            >
              {fileList.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined style={{ color: '#1677ff', fontSize: '48px' }} />
                  </p>
                  <p className="ant-upload-text" style={{ fontSize: '16px', fontWeight: 500 }}>{t('点击或拖拽文件到此区域')}</p>
                  <p className="ant-upload-hint" style={{ color: '#8c8c8c' }}>
                    {uploadHint || t('支持单个或批量文件导入')}
                  </p>
                </div>
              ) : (
                <div 
                  style={{ height: '100%', overflow: 'hidden', padding: '12px' }}
                  onClick={(e) => e.stopPropagation()} // 阻止点击表格触发文件选择
                >
                  <Table
                    rowSelection={{
                      selectedRowKeys: selectedFileKeys,
                      onChange: onSelectionChange,
                    }}
                    columns={columns}
                    dataSource={fileList}
                    rowKey={rowKey}
                    size="small"
                    pagination={false}
                    scroll={{ y: 280 }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('暂无文件')} /> }}
                    style={{ height: '100%', backgroundColor: 'transparent' }}
                  />
                </div>
              )}
            </Dragger>
          </div>
        </Card>

        {/* 2. 参数设置区 */}
        <Card title={t('参数设置')} size="small">
          {settingsContent}
        </Card>
        
        {/* 3. 底部操作区 */}
        <div style={{ 
          padding: '16px 0 32px 0',
        }}>
          {actionsContent}
        </div>
      </div>
    </div>
  );
}
