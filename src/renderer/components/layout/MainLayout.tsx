import React, { useState } from 'react';
import { Layout, Menu, Input, ConfigProvider, App } from 'antd';
import type { MenuProps } from 'antd';
import { 
  SearchOutlined,
  HomeOutlined,
  AppstoreOutlined,
  SwapOutlined,
  MergeCellsOutlined,
  FileSearchOutlined,
  MinusOutlined,
  BorderOutlined,
  CloseOutlined,
  AppstoreAddOutlined,
  MessageOutlined
} from '@ant-design/icons';
import { TextToolsPage } from '../../pages/TextToolsPage';
import { HomePage } from '../../pages/HomePage';
import { UserPanel } from './UserPanel';
import { AdvDisplay } from '../common/AdvDisplay';
import { AdvCarousel } from '../common/AdvCarousel';
import { AuthProvider } from '../../context/AuthContext';
import logo from '../../assets/logo.png';
import { useT } from '../../i18n';

const { Header, Sider, Content } = Layout;

export const MainLayout: React.FC = () => {
  const [searchValue, setSearchValue] = useState('');
  const [activeKey, setActiveKey] = useState('home');
  const [isModuleSelected, setIsModuleSelected] = useState(false);
  const [targetModuleId, setTargetModuleId] = useState<string | null>(null);
  const [menuClickTick, setMenuClickTick] = useState(0);

  const { message: antdMessage } = App.useApp();
  const t = useT();

  const handleMenuClick = async (key: string) => {
    // 增加点击信号，用于通知子组件在重复点击同一菜单项时进行重置
    setMenuClickTick(prev => prev + 1);
    if (key === 'custom-software') {
      try {
        const customUrl = await window.electron.auth.getCustomUrl();
        if (customUrl) {
          window.electron.auth.openExternal(customUrl);
        }
      } catch (error) {
        console.error('MainLayout: handleGetCustomUrl error:', error);
        antdMessage.error(t('无法获取定制链接，请检查网络连接'));
      }
      return;
    }
    if (key === 'feedback') {
      try {
        const feedbackUrl = 'https://support.qq.com/product/123456';
        if (feedbackUrl) {
          window.electron.auth.openExternal(feedbackUrl);
        }
      } catch (error) {
        console.error('MainLayout: handleGetFeedbackUrl error:', error);
        antdMessage.error(t('无法获取反馈链接，请检查网络连接'));
      }
      return;
    }
    setActiveKey(key);
    setSearchValue(''); // 切换菜单时清空搜索
    if (key === 'home') {
      setTargetModuleId(null);
    }
  };

  const handleMinimize = () => window.electron.minimizeWindow();
  const handleMaximize = () => window.electron.maximizeWindow();
  const handleClose = () => window.electron.closeWindow();

  const menuItems: MenuProps['items'] = [
    {
      key: 'home',
      icon: <HomeOutlined />,
      label: t('首页'),
    },
    {
      type: 'divider',
    },
    {
      key: 'text-tools-group',
      label: t('文本文件处理工具'),
      type: 'group',
      children: [
        {
          key: 'all',
          icon: <AppstoreOutlined />,
          label: t('全部功能'),
        },
        {
          key: 'content',
          icon: <FileSearchOutlined />,
          label: t('文件内容'),
        },
        {
          key: 'convert',
          icon: <SwapOutlined />,
          label: t('格式转换'),
        },
        {
          key: 'split-merge',
          icon: <MergeCellsOutlined />,
          label: t('合并拆分'),
        },
      ],
    },
    {
      type: 'divider',
    },
    {
      key: 'custom-software',
      icon: <AppstoreAddOutlined />,
      label: t('我要软件定制'),
    },
    {
      key: 'feedback',
      icon: <MessageOutlined />,
      label: t('用户反馈'),
    },
  ];

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 8,
        },
      }}
    >
      <App>
        <AuthProvider>
          <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }} className="i18n-wrap">
        {/* 左侧侧边栏 */}
        <Sider 
          theme="light" 
          width={240} 
          style={{ 
            borderRight: '1px solid #e8e8e8', 
            position: 'fixed', 
            height: '100vh', 
            left: 0,
            zIndex: 100,
            boxShadow: '2px 0 8px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={({ 
              minHeight: 88,
              display: 'flex', 
              alignItems: 'flex-start', 
              padding: '14px 20px 12px',
              borderBottom: '1px solid #f0f0f0',
              WebkitAppRegion: 'drag' 
            } as any)}>
              <img 
                src={logo} 
                alt={t('Logo')} 
                style={{ 
                  width: 36, 
                  height: 36, 
                  marginRight: 12,
                  borderRadius: '8px',
                  objectFit: 'contain'
                }} 
              />
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, flex: 1 }}>
                <span style={{ fontWeight: 'bold', fontSize: 15, color: '#1a1a1a', letterSpacing: '0.2px', lineHeight: '1.25', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {t('文本文件处理工具')}
                </span>
                <span style={{ 
                  fontSize: 10, 
                  color: '#1890ff', 
                  background: '#e6f7ff', 
                  padding: '0 8px', 
                  borderRadius: '10px',
                  border: '1px solid #91d5ff',
                  fontWeight: 500,
                  display: 'inline-block',
                  width: 'fit-content',
                  maxWidth: '100%',
                  marginTop: 6,
                  lineHeight: '14px',
                  whiteSpace: 'normal',
                  overflowWrap: 'anywhere'
                }}>
                  {t('鲲穹AI旗下产品')}
                </span>
              </div>
            </div>
            <Menu
              className="app-sidebar-menu"
              mode="inline"
              selectedKeys={[activeKey]}
              style={{ borderRight: 0, padding: '0 8px' }}
              items={menuItems}
              onClick={({ key }) => {
                handleMenuClick(key);
              }}
            />
          </div>

          {/* 侧边栏底部广告 轮播 */}
          <div style={{ 
            padding: '16px', 
            borderTop: '1px solid #f0f0f0',
            background: '#fff',
            display: 'flex',
            justifyContent: 'center'
          }}>
            <AdvCarousel 
              positions={['adv_position_04', 'adv_position_05']} 
              width={200}
              height={300}
              style={{ 
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                border: '1px solid rgba(0,0,0,0.03)'
              }} 
            />
          </div>
        </Sider>

        {/* 右侧主体区域 */}
        <Layout style={{ marginLeft: 240, transition: 'all 0.2s', minWidth: 0 }}>
          <Header style={({ 
            background: '#fff', 
            padding: '0 16px 0 32px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            position: 'sticky',
            top: 0,
            zIndex: 99,
            minHeight: 64, 
            height: 'auto', 
            WebkitAppRegion: 'drag' 
          } as any)}>
            <Input 
              placeholder={t('搜索功能模块...')} 
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              style={({ 
                width: 220,
                maxWidth: '100%', 
                borderRadius: '20px', 
                background: '#f5f5f5', 
                border: '1px solid transparent',
                padding: '4px 12px', 
                fontSize: '13px', 
                WebkitAppRegion: 'no-drag'
              } as any)}
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                if (e.target.value && activeKey === 'home') {
                  setActiveKey('all');
                }
              }}
              allowClear
              className="search-input"
            />

            {/* 最上面广告 4:1 小图 */}
              <div className="app-hide-on-tight" style={({ 
                display: 'flex', 
                alignItems: 'center', 
                height: '100%', 
              WebkitAppRegion: 'no-drag' 
            } as any)}>
              <AdvDisplay 
                position="adv_position_01" 
                width={168} // 精调宽度
                height={42} // 严格保持 4:1 比例 (168:42)
                style={{ 
                  marginLeft: '24px', 
                  borderRadius: '8px', 
                  background: '#fff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)', // 为顶部广告增加轻微投影
                  border: '1px solid rgba(0,0,0,0.03)'
                }} 
              />
            </div>
            
              <div style={({ 
                display: 'flex', 
                alignItems: 'center', 
                height: '100%', 
                gap: '16px',
                flexWrap: 'wrap',
                WebkitAppRegion: 'no-drag' 
              } as any)}>
                <UserPanel />
              
              {/* 窗口控制按钮 */}
              <div style={{ 
                display: 'flex', 
                height: '100%',
                alignItems: 'flex-start' // 窗口控制按钮靠上
              }}>
              <div 
                className="window-control-btn"
                onClick={handleMinimize}
                style={{
                  width: 46,
                  height: 32, // 窗口按钮高度固定
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                <MinusOutlined style={{ fontSize: 16 }} />
              </div>
              <div 
                className="window-control-btn"
                onClick={handleMaximize}
                style={{
                  width: 46,
                  height: 32, // 窗口按钮高度固定
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                <BorderOutlined style={{ fontSize: 14 }} />
              </div>
              <div 
                className="window-control-btn close"
                onClick={handleClose}
                style={{
                  width: 46,
                  height: 32, // 窗口按钮高度固定
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <CloseOutlined style={{ fontSize: 16 }} />
              </div>
            </div>
          </div>
        </Header>

          <Content style={{ 
            padding: '24px 32px', // 稍微减少顶部边距
            height: 'calc(100vh - 64px)', 
            overflow: activeKey === 'home' ? 'hidden' : 'auto', // 首页禁用滚动
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ 
              maxWidth: 1400, 
              margin: '0 auto', 
              width: '100%', 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column',
              overflow: activeKey === 'home' ? 'hidden' : 'visible' // 首页确保不溢出，功能页允许溢出以支持外层滚动
            }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {activeKey === 'home' ? (
                  <HomePage onNavigate={(key, moduleId) => {
                    handleMenuClick(key);
                    if (moduleId) {
                      setTargetModuleId(moduleId);
                    }
                    setIsModuleSelected(false);
                  }} />
                ) : (
                  <TextToolsPage 
                    searchValue={searchValue} 
                    activeCategory={activeKey as any} 
                    onModuleSelectChange={setIsModuleSelected}
                    initialModuleId={targetModuleId}
                    onModuleSelected={() => setTargetModuleId(null)}
                    menuClickTick={menuClickTick}
                  />
                )}
              </div>
            </div>
          </Content>
        </Layout>
        
        {/* 添加按钮悬停样式 */}
        <style dangerouslySetInnerHTML={{ __html: `
          .window-control-btn:hover {
            background-color: rgba(0, 0, 0, 0.05);
          }
          .window-control-btn.close:hover {
            background-color: #ff4d4f !important;
            color: #fff !important;
          }
          .adv-hover {
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .adv-hover:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0,0,0,0.12) !important;
          }
        ` }} />
      </Layout>
        </AuthProvider>
      </App>
    </ConfigProvider>
  );
};
