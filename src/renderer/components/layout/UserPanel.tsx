import React, { useState, useEffect, useRef } from 'react';
import { Button, Avatar, Popover, Space, Typography, message, Spin, Select } from 'antd';
import { UserOutlined, LogoutOutlined, LoadingOutlined } from '@ant-design/icons';
import { useI18n, useT } from '../../i18n';

const { Text } = Typography;

interface UserInfo {
  avatar: string;
  nickname: string;
}

export const UserPanel: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [loading, setLoading] = useState(true);

  const { locale, setLocale, availableLocales } = useI18n();
  const t = useT();
  
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef<boolean>(false);
  const pollStartTimeRef = useRef<number>(0);
  const MAX_POLL_TIME = 300 * 1000; // 300秒

  useEffect(() => {
    checkInitialLogin();
    return () => {
      isPollingRef.current = false;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  const checkInitialLogin = async () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        const isValid = await window.electron.auth.checkLogin(token);
        if (isValid) {
          const info = await window.electron.auth.getUserInfo(token);
          setUserInfo(info);
          setIsLoggedIn(true);
        } else {
          localStorage.removeItem('auth_token');
        }
      } catch (error) {
        console.error('Check initial login error:', error);
        localStorage.removeItem('auth_token');
      }
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      // 1. 生成带签名的 nonce
      const { encodedNonce } = await window.electron.auth.generateNonce();
      
      // 2. 获取网页端登录地址
      const webLoginUrl = await window.electron.auth.getLoginUrl();
      
      // 3. 打开外部浏览器
      const finalUrl = `${webLoginUrl}?client_type=desktop&client_nonce=${encodedNonce}`;
      await window.electron.auth.openExternal(finalUrl);
      
      // 4. 开始轮询
      startPolling(encodedNonce);
      message.info(t('已打开浏览器，请完成登录...'));
    } catch (error: any) {
      message.error(error.message || t('启动登录流程失败'));
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (encodedNonce: string) => {
    setIsPolling(true);
    isPollingRef.current = true;
    pollStartTimeRef.current = Date.now();
    
    const poll = async () => {
      // 检查是否应该停止轮询
      if (!isPollingRef.current) {
        return;
      }

      // 检查超时
      if (Date.now() - pollStartTimeRef.current > MAX_POLL_TIME) {
        stopPolling();
        message.error(t('登录超时，请重新尝试'));
        return;
      }

      try {
        const token = await window.electron.auth.pollToken(encodedNonce);
        console.log('Poll result:', token ? 'Token received' : 'No token yet');
        
        // 再次检查是否在等待期间被取消了
        if (!isPollingRef.current) {
          console.log('Polling was cancelled during fetch');
          return;
        }

        if (token) {
          localStorage.setItem('auth_token', token);
          console.log('Token saved to localStorage');
          
          try {
            const info = await window.electron.auth.getUserInfo(token);
            console.log('User info received:', info.nickname);
            
            if (!isPollingRef.current) return;

            setUserInfo(info);
            setIsLoggedIn(true);
            stopPolling();
            message.success(t('登录成功'));
          } catch (infoError) {
            console.error('Failed to get user info after login:', infoError);
            // 如果获取用户信息失败，也算登录成功，但显示默认头像/昵称
            setUserInfo({ avatar: '', nickname: t('已登录用户') });
            setIsLoggedIn(true);
            stopPolling();
            message.success(t('登录成功 (获取用户信息失败)'));
          }
        } else {
          // 继续轮询
          if (isPollingRef.current) {
            pollTimerRef.current = setTimeout(poll, 2000);
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        // 出错也继续轮询，除非被手动停止
        if (isPollingRef.current) {
          pollTimerRef.current = setTimeout(poll, 2000);
        }
      }
    };

    poll();
  };

  const stopPolling = () => {
    setIsPolling(false);
    isPollingRef.current = false;
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        await window.electron.auth.logout(token);
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    localStorage.removeItem('auth_token');
    setIsLoggedIn(false);
    setUserInfo(null);
    message.success(t('已退出登录'));
  };

  const handleCancelLogin = () => {
    stopPolling();
    message.info(t('已取消登录'));
  };

  const userContent = (
    <div style={{ width: 220, maxWidth: 'calc(100vw - 48px)', padding: '12px 0' }}>
      <Space direction="vertical" style={{ width: '100%' }} align="center" size={12}>
        <Avatar src={userInfo?.avatar} size={64} icon={<UserOutlined />} />
        <Text strong style={{ fontSize: 16, textAlign: 'center', overflowWrap: 'anywhere' }}>{userInfo?.nickname || t('未知用户')}</Text>
        <div style={{ width: '100%', height: '1px', background: '#f0f0f0', margin: '8px 0' }} />
        <Button 
          type="text" 
          danger 
          icon={<LogoutOutlined />} 
          onClick={handleLogout}
          style={{ width: '100%', textAlign: 'left', padding: '0 12px' }}
        >
          {t('退出登录')}
        </Button>
      </Space>
    </div>
  );

  if (loading && !isPolling) {
    return <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="small" /></div>;
  }

  if (isPolling) {
    return (
      <div style={({ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', maxWidth: 320, WebkitAppRegion: 'no-drag' } as any)}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 14 }} spin />} />
        <Text type="secondary" style={{ fontSize: 12, overflowWrap: 'anywhere' }}>{t('正在等待网页登录...')}</Text>
        <Button 
          size="small" 
          onClick={(e) => {
            e.stopPropagation();
            handleCancelLogin();
          }}
          style={{ fontSize: 12 }}
        >
          {t('取消')}
        </Button>
      </div>
    );
  }

  return (
    <div style={({ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', WebkitAppRegion: 'no-drag' } as any)}>
      <Select
        size="small"
        value={locale}
        style={{ minWidth: 110, maxWidth: 160 }}
        onChange={(value) => setLocale(String(value))}
        options={availableLocales.map((l) => ({
          value: l,
          label: l === 'zh_CN' ? t('中文') : l,
        }))}
      />
      {isLoggedIn ? (
        <Popover content={userContent} trigger="click" placement="bottomRight">
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 8px', borderRadius: '4px', transition: 'background 0.2s' }} className="user-avatar-hover">
            <Avatar src={userInfo?.avatar} icon={<UserOutlined />} style={{ border: '1px solid #f0f0f0' }} />
            <Text style={{ marginLeft: 8, maxWidth: 120 }} ellipsis>{userInfo?.nickname}</Text>
          </div>
        </Popover>
      ) : (
        <Button 
          type="primary" 
          icon={<UserOutlined />} 
          onClick={handleLogin}
          style={{ borderRadius: '20px' }}
        >
          {t('登录')}
        </Button>
      )}
    </div>
  );
};
