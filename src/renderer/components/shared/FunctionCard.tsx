import React from 'react';
import { Card, Button, Typography, Space, Badge } from 'antd';
import { useT } from '../../i18n';

const { Text, Title } = Typography;

interface FunctionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  onViewTutorial: () => void;
  tag?: string;
}

export const FunctionCard: React.FC<FunctionCardProps> = ({
  title,
  description,
  icon,
  onClick,
  onViewTutorial,
  tag
}) => {
  const t = useT();
  const cardContent = (
    <Card 
      hoverable 
      style={{ 
        borderRadius: 8,
        border: '1px solid #f0f0f0',
        height: '100%', 
        minHeight: '160px',
        display: 'flex',
        flexDirection: 'column'
      }}
      onClick={onClick}
      styles={{ 
        body: { 
          padding: '16px 20px', 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column' 
        } 
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flex: 1 }}>
        <div style={{ 
          fontSize: '28px', 
          color: '#1890ff',
          background: '#e6f7ff',
          padding: '8px',
          borderRadius: '8px',
          display: 'flex',
          flexShrink: 0
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
          <Title level={5} style={{ 
            margin: '0 0 8px 0', 
            fontSize: '16px', 
            lineHeight: '1.4',
            minHeight: '44px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            overflowWrap: 'anywhere'
          }}>
            {title}
          </Title>
          <div style={{ 
            marginBottom: '12px',
            flex: 1,
            minHeight: '72px'
          }}>
            <Text type="secondary" style={{ fontSize: '13px', lineHeight: '1.6', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>
              {description}
            </Text>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <Button 
              type="link" 
              size="small" 
              style={{ padding: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                onViewTutorial();
              }}
            >
              {t('查看教程')}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );

  if (tag) {
    return (
      <Badge.Ribbon text={tag} color="red" style={{ zIndex: 1 }}>
        <div style={{ height: '100%' }}>
          {cardContent}
        </div>
      </Badge.Ribbon>
    );
  }

  return (
    <div style={{ height: '100%' }}>
      {cardContent}
    </div>
  );
};
