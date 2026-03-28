import React, { useEffect, useState } from 'react';
import { Breadcrumb, Typography, Space } from 'antd';
import { HomeOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { ToolModule } from '../../../types/module';
import { useT } from '../../../i18n';

const { Title } = Typography;

interface ModuleLayoutProps {
  module: ToolModule;
  onBack: () => void;
  children: React.ReactNode;
}

export const ModuleLayout: React.FC<ModuleLayoutProps> = ({ module, onBack, children }) => {
  const t = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  const headerStyle: React.CSSProperties = {
    // height: '40px', // 移除固定高度
    minHeight: '48px', // 设置最小高度，保持紧凑感但允许撑开
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '16px',
    padding: '8px 20px', // 减小内边距，回归紧凑风格
    marginBottom: '20px',
    backgroundColor: '#fff',
    borderRadius: '4px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    transition: 'all 0.3s ease-in-out',
    opacity: visible ? 1 : 0,
    borderLeft: `6px solid ${module.themeColor || '#1890ff'}`,
    background: `linear-gradient(90deg, #fff 0%, ${module.themeColor}05 100%)`,
    // overflow: 'hidden' // 移除 hidden，防止极少数情况被截断
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '20px', // 缩小字号，避免太占空间
    fontWeight: 'bold',
    margin: 0,
    lineHeight: 1.3,
    display: 'flex',
    alignItems: 'center',
    color: '#1f1f1f',
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
  };

  const iconStyle: React.CSSProperties = {
    fontSize: '24px', // 稍微缩小图标
    width: '28px',
    height: '28px',
    marginRight: '10px',
    color: module.themeColor || '#1890ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };

  return (
    <div style={{ width: '100%', minHeight: '100%' }}>
      {/* 顶部标题栏 */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', flex: '1 1 360px', minWidth: 0 }}>
          <div style={iconStyle}>
            {module.icon}
          </div>
          <Title level={2} style={titleStyle} title={module.title}>
            {module.title}
          </Title>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px 24px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Breadcrumb
            items={[
              {
                title: (
                  <span 
                    style={{ cursor: 'pointer', transition: 'color 0.3s' }} 
                    onClick={onBack}
                    onMouseOver={(e) => e.currentTarget.style.color = module.themeColor || '#1890ff'}
                    onMouseOut={(e) => e.currentTarget.style.color = ''}
                  >
                    <HomeOutlined /> {t('首页')}
                  </span>
                ),
              }
              // 移除面包屑中的当前页标题，避免重复且占用空间导致换行
            ]}
          />
          <button 
            onClick={onBack}
            style={{ 
              cursor: 'pointer', 
              border: '1px solid #d9d9d9', 
              background: '#fff', 
              color: '#595959', 
              fontSize: '14px',
              padding: '4px 12px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.3s',
              whiteSpace: 'normal'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = module.themeColor || '#1890ff';
              e.currentTarget.style.color = module.themeColor || '#1890ff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#d9d9d9';
              e.currentTarget.style.color = '#595959';
            }}
          >
            <ArrowLeftOutlined /> {t('返回列表')}
          </button>
        </div>
      </div>

      {/* 模块内容 */}
      <div style={{ 
        opacity: visible ? 1 : 0, 
        transition: 'opacity 0.3s ease-in-out',
        padding: '0 4px'
      }}>
        {children}
      </div>
    </div>
  );
};
