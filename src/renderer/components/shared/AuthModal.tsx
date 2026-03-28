import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, Typography, Space, message, App } from 'antd';
import { SafetyCertificateOutlined, EyeInvisibleOutlined, EyeTwoTone, CloseOutlined } from '@ant-design/icons';
import logo from '../../assets/logo.png';
import authIcon from '../../assets/kq-55_256x256.ico';
import { useT } from '../../i18n';

const { Text, Title, Link } = Typography;

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ visible, onClose, onSuccess }) => {
  const [authCode, setAuthCode] = useState(() => localStorage.getItem('last_auth_code_input') || '');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { message: antdMessage } = App.useApp();
  const t = useT();

  // 记录输入历史（仅限当前会话，但用户要求保留已输入内容，所以用 localStorage）
  useEffect(() => {
    localStorage.setItem('last_auth_code_input', authCode);
  }, [authCode]);

  const handleVerify = async () => {
    if (!authCode.trim()) {
      setErrorMsg(t('请输入授权码'));
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const machineCode = await window.electron.auth.getMachineCode();
      const result = await window.electron.auth.validAuth(machineCode, authCode.trim());

      if (result.valid) {
        antdMessage.success(t('授权验证成功'));
        // 记录验证成功时间和状态
        const authData = {
          verified: true,
          timestamp: Date.now(),
          machineCode
        };
        localStorage.setItem('software_auth_data', JSON.stringify(authData));
        onSuccess();
      } else {
        setErrorMsg(result.msg || t('授权码验证无效'));
      }
    } catch (error) {
      console.error('Auth verify error:', error);
      setErrorMsg(t('网络请求异常，请稍后重试'));
    } finally {
      setLoading(false);
    }
  };

  const handleGetAuthCode = async () => {
    try {
      const machineCode = await window.electron.auth.getMachineCode();
      const result = await window.electron.auth.checkNeedAuth(machineCode);
      console.log('AuthModal: checkNeedAuth result:', result);
      
      if (result.authCodeUrl) {
        let url = result.authCodeUrl;
        // 智能拼接参数
        const connector = url.includes('?') ? '&' : '?';
        url = `${url}${connector}device_id=${machineCode}&software_code=10019`;
        
        console.log('AuthModal: Opening external URL:', url);
        window.electron.auth.openExternal(url);
      } else {
        antdMessage.info(t('当前环境无需授权码'));
      }
    } catch (error) {
      console.error('AuthModal: handleGetAuthCode error:', error);
      antdMessage.error(t('无法获取授权页面地址，请检查网络连接'));
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      closable={false} // 使用自定义关闭按钮
      width={400}
      centered
      keyboard={true} // 支持 ESC 关闭
      transitionName="ant-zoom" // 300ms 左右的弹出动画
      styles={{
        mask: { backdropFilter: 'blur(4px)' },
        content: { borderRadius: '16px', padding: '24px' }
      }}
    >
      <div style={{ position: 'relative' }}>
        {/* 右上角关闭按钮 */}
        <Button 
          type="text" 
          icon={<CloseOutlined style={{ fontSize: 18, color: '#bfbfbf' }} />} 
          onClick={onClose}
          style={{ position: 'absolute', right: -12, top: -12 }}
        />

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Space align="center" style={{ marginBottom: 16 }}>
            <img src={authIcon} alt={t('Logo')} style={{ width: 32, height: 32 }} />
            <Title level={4} style={{ margin: 0, fontSize: 18 }}>{t('鲲穹AI工具箱 · 软件授权验证')}</Title>
          </Space>
          <Text type="secondary" style={{ display: 'block', lineHeight: '1.6', fontSize: 14 }}>
            {t('您当前安装的工具为鲲穹AI工具箱生态应用，需通过工具箱授权码完成激活，以启用完整功能。')}
          </Text>
        </div>

        <div style={{ marginBottom: 24 }}>
          <Input.Password
            placeholder={t('请输入授权码')}
            size="large"
            value={authCode}
            onChange={(e) => {
              setAuthCode(e.target.value);
              setErrorMsg('');
            }}
            onPressEnter={handleVerify}
            iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            style={{ 
              borderRadius: '12px', 
              padding: '10px 16px',
              border: errorMsg ? '1px solid #ff4d4f' : '1px solid #d9d9d9'
            }}
          />
          {errorMsg && (
            <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4, marginLeft: 4 }}>
              {errorMsg}
            </div>
          )}
        </div>

        <Button
          type="primary"
          size="large"
          block
          loading={loading}
          onClick={handleVerify}
          style={{ 
            height: 48, 
            borderRadius: '12px', 
            fontSize: 16, 
            fontWeight: 500,
            background: 'linear-gradient(90deg, #94b4ff, #80a1ff)',
            border: 'none',
            marginBottom: 20
          }}
        >
          {t('验证授权')}
        </Button>

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('还没有授权码？')} <Link onClick={handleGetAuthCode}>{t('点击获取')}</Link>
          </Text>
        </div>
      </div>
    </Modal>
  );
};
