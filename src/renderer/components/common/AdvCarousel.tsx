import React, { useState, useEffect, useRef } from 'react';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { AdvDisplay } from './AdvDisplay';

interface AdvCarouselProps {
  positions: string[];
  width?: string | number;
  height?: string | number;
  interval?: number;
  style?: React.CSSProperties;
}

export const AdvCarousel: React.FC<AdvCarouselProps> = ({ 
  positions, 
  width = 200, 
  height = 300, 
  interval = 5000,
  style 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 自动轮播逻辑
  const startTimer = () => {
    stopTimer();
    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % positions.length);
    }, interval);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (!isHovered) {
      startTimer();
    } else {
      stopTimer();
    }
    return () => stopTimer();
  }, [isHovered, positions.length]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + positions.length) % positions.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % positions.length);
  };

  const handleDotClick = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(index);
  };

  return (
    <div 
      style={{ 
        position: 'relative', 
        width, 
        height, 
        overflow: 'hidden',
        borderRadius: '12px',
        ...style 
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 轮播内容 */}
      <div style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative' 
      }}>
        {positions.map((pos, index) => (
          <div
            key={pos}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: currentIndex === index ? 1 : 0,
              visibility: currentIndex === index ? 'visible' : 'hidden',
              transition: 'opacity 300ms ease-in-out, visibility 300ms ease-in-out',
              zIndex: currentIndex === index ? 1 : 0
            }}
          >
            <AdvDisplay 
              position={pos} 
              width="100%" 
              height="100%" 
              style={{ borderRadius: 0, boxShadow: 'none', border: 'none' }} 
            />
          </div>
        ))}
      </div>

      {/* 左右切换按钮 */}
      <div 
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          transform: 'translateY(-50%)',
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0 8px',
          zIndex: 10,
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 300ms ease-in-out',
          pointerEvents: isHovered ? 'auto' : 'none'
        }}
      >
        <div 
          onClick={handlePrev}
          style={{
            width: 32,
            height: 32,
            background: 'rgba(255, 255, 255, 0.4)',
            backdropFilter: 'blur(8px)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'background 0.2s'
          }}
          className="carousel-btn"
        >
          <LeftOutlined style={{ fontSize: 14, color: '#333' }} />
        </div>
        <div 
          onClick={handleNext}
          style={{
            width: 32,
            height: 32,
            background: 'rgba(255, 255, 255, 0.4)',
            backdropFilter: 'blur(8px)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'background 0.2s'
          }}
          className="carousel-btn"
        >
          <RightOutlined style={{ fontSize: 14, color: '#333' }} />
        </div>
      </div>

      {/* 底部指示点 */}
      <div 
        style={{
          position: 'absolute',
          bottom: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 8,
          zIndex: 10
        }}
      >
        {positions.map((_, index) => (
          <div
            key={index}
            onClick={(e) => handleDotClick(index, e)}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: currentIndex === index ? '#1890ff' : 'rgba(255, 255, 255, 0.6)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              cursor: 'pointer',
              transition: 'all 0.3s ease-in-out'
            }}
          />
        ))}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .carousel-btn:hover {
          background: rgba(255, 255, 255, 0.6) !important;
        }
      ` }} />
    </div>
  );
};
