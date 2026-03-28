import React, { useEffect } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import './App.css';
import { useT } from './i18n';

function App() {
  const t = useT();

  useEffect(() => {
    document.title = t('文本文件处理工具');
  }, [t]);

  return (
    <MainLayout />
  );
}

export default App;
