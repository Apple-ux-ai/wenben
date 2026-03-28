/**
 * 功能：首页入口，包含功能卡片、历史记录与快速指南
 * 作者：FullStack-Guardian
 * 更新时间：2026-03-05
 */
import React from 'react';
import { Typography, Row, Col, Card, Space, Divider } from 'antd';
import { 
  FileSearchOutlined, 
  SwapOutlined, 
  MergeCellsOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  RightOutlined,
  InfoCircleOutlined,
  HistoryOutlined,
  BulbOutlined,
  FileProtectOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { useHistory } from '../hooks/useHistory';
import { getTextToolModules } from '../features/text-tools/config';
import { useT } from '../i18n';

const { Title, Paragraph, Text } = Typography;

interface HomePageProps {
  onNavigate: (key: string, moduleId?: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const t = useT();
  const modules = getTextToolModules(t);
  const { history, clearHistory, removeFromHistory } = useHistory();

  const features = [
    {
      key: 'content',
      title: t('文件内容处理'),
      description: t('批量查找替换、正则匹配、编码转换及文本深度优化。'),
      icon: <FileSearchOutlined />,
      color: '#1890ff',
      bgColor: '#e6f7ff',
      tags: [t('正则替换'), t('编码转换'), t('去重清理')]
    },
    {
      key: 'convert',
      title: t('万能格式转换'),
      description: t('支持 Word、PDF、Excel、HTML、Markdown 等互转。'),
      icon: <SwapOutlined />,
      color: '#52c41a',
      bgColor: '#f6ffed',
      tags: [t('PDF转Word'), t('JSON转Excel'), t('MD预览')]
    },
    {
      key: 'split-merge',
      title: t('大文件合并拆分'),
      description: t('精准按行或数量拆分超大文件，或将多个零散文件按序合并。'),
      icon: <MergeCellsOutlined />,
      color: '#722ed1',
      bgColor: '#f9f0ff',
      tags: [t('按行拆分'), t('流式读写'), t('一键合并')]
    }
  ];

  return (
    <div style={{ 
      padding: '0 0 8px 0', 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden' // 内部不滚动
    }}>
      {/* 顶部欢迎区 - 极致压缩 */}
      <div style={{ 
        padding: '20px 24px', // 减少内边距
        background: '#fff',
        borderRadius: 8,
        border: '1px solid #f0f0f0',
        marginBottom: 16, // 减少外边距
        boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
      }}>
        <Row align="middle" justify="space-between" gutter={[16, 16]}>
          <Col flex="auto">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
              <Title level={4} style={{ margin: 0, fontWeight: 600 }}>
                {t('文本处理效率工具')}
              </Title>
              <Text type="secondary" style={{ fontSize: 13, overflowWrap: 'anywhere' }}>
                {t('简单、高效、本地化的批量文本处理解决方案')}
              </Text>
            </div>
          </Col>
          <Col>
            <Space size="middle" wrap>
              <div style={{ textAlign: 'center' }}>
                <ThunderboltOutlined style={{ color: '#faad14', fontSize: 16 }} />
                <div style={{ fontSize: 11, color: '#8c8c8c' }}>{t('极速响应')}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <SafetyCertificateOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                <div style={{ fontSize: 11, color: '#8c8c8c' }}>{t('本地安全')}</div>
              </div>
            </Space>
          </Col>
        </Row>
      </div>

      {/* 核心功能卡片 - 紧凑排列 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {features.map((item) => (
          <Col key={item.key} xs={24} md={8}>
            <Card
              hoverable
              onClick={() => {
                onNavigate(item.key);
              }}
              style={{ 
                borderRadius: 8, 
                border: '1px solid #f0f0f0',
                minHeight: 220,
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s'
              }}
              styles={{
                body: { 
                  padding: '16px',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }
              }}
            >
              <div>
                <div style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: '8px', 
                  background: item.bgColor, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  marginBottom: 10,
                  fontSize: 18,
                  color: item.color
                }}>
                  {item.icon}
                </div>
                <Title level={5} style={{ margin: '0 0 4px 0', fontWeight: 600, fontSize: 15, overflowWrap: 'anywhere' }}>{item.title}</Title>
                <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0, lineHeight: 1.4, overflowWrap: 'anywhere' }}>
                  {item.description}
                </Paragraph>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Space size={4} wrap>
                  {item.tags.slice(0, 2).map(tag => (
                    <span key={tag} style={{ 
                      fontSize: 10, 
                      padding: '1px 6px', 
                      background: '#f5f5f5', 
                      borderRadius: '4px',
                      color: '#8c8c8c'
                    }}>
                      {tag}
                    </span>
                  ))}
                </Space>
                <RightOutlined style={{ color: '#bfbfbf', fontSize: 12 }} />
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 新增内容区：使用指南与特性 */}
      <div style={{ flex: 1, minHeight: 0, marginBottom: 16, overflow: 'hidden' }}>
        <Row gutter={[16, 16]} style={{ height: '100%' }}>
          <Col xs={24} xl={16} style={{ height: '100%' }}>
            <div style={{ 
              background: '#fff', 
              borderRadius: 8, 
              border: '1px solid #f0f0f0', 
              height: '100%',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto'
            }}>
            <Title level={5} style={{ fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center' }}>
              <BulbOutlined style={{ color: '#faad14', marginRight: 8 }} />
              {t('快速使用指南')}
            </Title>
            <Row gutter={[16, 16]}>
              {[
                { title: t('导入文件'), desc: t('支持拖拽或批量选择文本文件'), icon: <FileProtectOutlined /> },
                { title: t('配置规则'), desc: t('灵活设置查找替换或转换参数'), icon: <HistoryOutlined /> },
                { title: t('一键处理'), desc: t('毫秒级响应，实时查看处理进度'), icon: <ThunderboltOutlined /> }
              ].map((step, idx) => (
                <Col xs={24} md={8} key={idx}>
                  <div style={{ padding: '12px', background: '#fafafa', borderRadius: 8 }}>
                    <div style={{ color: '#1890ff', marginBottom: 4, fontSize: 16 }}>{step.icon}</div>
                    <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 2, overflowWrap: 'anywhere' }}>{step.title}</div>
                    <div style={{ color: '#8c8c8c', fontSize: 11, overflowWrap: 'anywhere' }}>{step.desc}</div>
                  </div>
                </Col>
              ))}
            </Row>
          </div>
          </Col>
          <Col xs={24} xl={8} style={{ height: '100%' }}>
            <div style={{ 
              background: '#fff', 
              borderRadius: 8, 
              border: '1px solid #f0f0f0', 
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
            <div style={{ 
              padding: '16px 20px 8px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap'
            }}>
              <Title level={5} style={{ fontSize: 14, margin: 0, display: 'flex', alignItems: 'center' }}>
                <ClockCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
                {t('最近使用')}
              </Title>
              {history.length > 0 && (
                <Text 
                  type="secondary" 
                  style={{ fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    clearHistory();
                  }}
                >
                  <DeleteOutlined style={{ marginRight: 4 }} />
                  {t('清空')}
                </Text>
              )}
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {history.length === 0 ? (
                <div style={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: '#d9d9d9'
                }}>
                  <HistoryOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>{t('暂无历史记录')}</Text>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {history.map((item, index) => {
                    // 查找对应的功能模块，如果找不到（可能是旧数据或大类），则尝试在features里找（兼容旧数据）
                    const module = modules.find(m => m.id === item.key);
                    const categoryFeature = features.find(f => f.key === item.key);
                    const displayTitle = module?.title || categoryFeature?.title || item.title || item.key;
                    
                    return (
                      <div 
                        key={`${item.key}-${index}`}
                        className="history-item"
                        onClick={() => {
                          if (module) {
                            onNavigate(module.category, module.id);
                          } else if (categoryFeature) {
                            onNavigate(categoryFeature.key);
                          }
                        }}
                        style={{
                          padding: '10px 20px',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#fafafa';
                          const delBtn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                          if (delBtn) delBtn.style.opacity = '1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          const delBtn = e.currentTarget.querySelector('.delete-btn') as HTMLElement;
                          if (delBtn) delBtn.style.opacity = '0';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            width: 24, 
                            height: 24, 
                            borderRadius: 4, 
                            background: module?.themeColor ? `${module.themeColor}15` : (categoryFeature?.bgColor || '#f5f5f5'), 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            marginRight: 12,
                            color: module?.themeColor || categoryFeature?.color || '#8c8c8c',
                            fontSize: 12,
                            flexShrink: 0
                          }}>
                            {module?.icon || categoryFeature?.icon || <FileSearchOutlined />}
                          </div>
                          <Text style={{ fontSize: 13 }} ellipsis>{displayTitle}</Text>
                        </div>
                        
                        <div 
                          className="delete-btn"
                          style={{
                            opacity: 0,
                            transition: 'opacity 0.2s',
                            padding: '4px',
                            marginLeft: 8,
                            color: '#ff4d4f',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromHistory(item.key);
                          }}
                        >
                          <CloseOutlined style={{ fontSize: 12 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          </Col>
        </Row>
      </div>

      {/* 底部信息栏 - 合并到一行 */}
      <div style={{ 
        marginTop: 'auto', 
        padding: '12px 24px', 
        background: '#fff', 
        borderRadius: 8, 
        border: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap'
      }}>
        <Space size="middle" wrap>
          <InfoCircleOutlined style={{ color: '#1890ff' }} />
          <Text type="secondary" style={{ fontSize: 12, overflowWrap: 'anywhere' }}>
            {t('提示：所有操作均在本地执行，您的文件不会被上传到任何服务器。')}
          </Text>
        </Space>
        <Space split={<Divider type="vertical" />} wrap>
          <Text type="secondary" style={{ fontSize: 12 }}>{t('版本 {{version}}', { version: 'v1.0.0' })}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{t('本地环境就绪')}</Text>
        </Space>
      </div>
    </div>
  );
};
