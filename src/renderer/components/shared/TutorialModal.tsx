import React from 'react';
import { Modal, Steps, Typography, Divider, Tag, Space } from 'antd';
import { InfoCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useT } from '../../i18n';

const { Title, Paragraph, Text } = Typography;

export interface TutorialStep {
  title: string;
  description: string;
  image?: string;
}

export interface TutorialData {
  title: string;
  steps: TutorialStep[];
  notes: string[];
}

interface TutorialModalProps {
  visible: boolean;
  onClose: () => void;
  data: TutorialData | null;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ visible, onClose, data }) => {
  const t = useT();
  if (!data) return null;

  return (
    <Modal
      title={
        <Space style={{ maxWidth: '100%' }}>
          <InfoCircleOutlined style={{ color: '#1890ff' }} />
          <span style={{ overflowWrap: 'anywhere' }}>{t('{{title}} - 使用教程', { title: data.title })}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      style={{ maxWidth: 'calc(100vw - 32px)' }}
      centered
      destroyOnHidden
      styles={{
        mask: { backgroundColor: 'rgba(0, 0, 0, 0.45)' },
        body: { padding: '24px', maxHeight: '70vh', overflowY: 'auto' }
      }}
      aria-label={t('{{title}} 教程弹窗', { title: data.title })}
    >
      <div style={{ marginBottom: 32 }}>
        <Steps
          direction="vertical"
          current={-1}
          items={data.steps.map((step, index) => ({
            title: <Text strong style={{ overflowWrap: 'anywhere' }}>{step.title}</Text>,
            description: (
              <div style={{ marginTop: 8, minWidth: 0 }}>
                <Paragraph type="secondary">{step.description}</Paragraph>
                {step.image && (
                  <div style={{ 
                    background: '#f0f2f5', 
                    borderRadius: 8, 
                    padding: 12, 
                    marginTop: 12,
                    textAlign: 'center' 
                  }}>
                    {/* 模拟演示图/GIF */}
                    <div style={{ 
                      height: 200, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: '#bfbfbf',
                      border: '1px dashed #d9d9d9'
                    }}>
                      [{t('演示图：{{title}}', { title: step.title })}]
                    </div>
                  </div>
                )}
              </div>
            ),
          }))}
        />
      </div>

      <Divider />

      <div>
        <Title level={5}>
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            {t('注意事项')}
          </Space>
        </Title>
        <ul style={{ paddingLeft: 20, color: '#666' }}>
          {data.notes.map((note, index) => (
            <li key={index} style={{ marginBottom: 8, overflowWrap: 'anywhere' }}>{note}</li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Tag color="blue">{t('提示：处理大文件时请耐心等待')}</Tag>
      </div>
    </Modal>
  );
};
