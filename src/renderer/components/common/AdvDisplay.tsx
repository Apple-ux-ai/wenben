import React, { useState, useEffect } from 'react';
import { Spin } from 'antd';
import { useT } from '../../i18n';

interface Advertisement {
  soft_number: number;
  adv_position: string;
  adv_url: string;
  target_url: string;
  width: number;
  height: number;
}

interface AdvDisplayProps {
  position: string;
  width?: string | number;
  height?: string | number;
  style?: React.CSSProperties;
}

export const AdvDisplay: React.FC<AdvDisplayProps> = ({ position, width, height, style }) => {
  const t = useT();
  const [advs, setAdvs] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdv = async () => {
      try {
        const data = await window.electron.adv.getAdv(position);
        setAdvs(data);
      } catch (error) {
        console.error('Fetch adv error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdv();
  }, [position]);

  const handleAdvClick = () => {
    if (advs[0]?.target_url) {
      window.electron.auth.openExternal(advs[0].target_url);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        width: width || '100%', 
        height: height || 'auto', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f5f5f5',
        borderRadius: '8px',
        ...style 
      }}>
        <Spin size="small" />
      </div>
    );
  }

  if (advs.length === 0) {
    return null; // 如果没加载到广告，直接返回 null，不显示占位图
  }

  return (
    <div 
      onClick={handleAdvClick}
      style={{ 
        width: width || '100%', 
        height: height || 'auto', 
        cursor: 'pointer',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '8px', // 默认 8px 圆角
        ...style 
      }}
      className="adv-hover"
    >
      <img 
        src={advs[0].adv_url} 
        alt={t('Advertisement')} 
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'fill', // 强制填充，确保填满圆角框
          display: 'block',
          borderRadius: 'inherit' // 确保图片也遵循圆角
        }} 
      />
    </div>
  );
};
