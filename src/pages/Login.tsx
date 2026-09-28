import { useState } from 'react';
import { Button, Card, Form, Input, Tabs, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../api';
import { useAuthStore } from '../stores/auth';

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);

  const onLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const data = await login(values.username, values.password);
      setAuth(data.token, data.user);
      message.success('登录成功');
      navigate('/dashboards');
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (values: { username: string; password: string; nickname?: string }) => {
    setLoading(true);
    try {
      await register(values.username, values.password, values.nickname);
      message.success('注册成功，请登录');
    } finally {
      setLoading(false);
    }
  };

  const loginForm = (
    <Form onFinish={onLogin} layout="vertical" initialValues={{ username: 'admin', password: 'admin123' }}>
      <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
        <Input placeholder="用户名" />
      </Form.Item>
      <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
        <Input.Password placeholder="密码" />
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={loading}>
        登录
      </Button>
    </Form>
  );

  const registerForm = (
    <Form onFinish={onRegister} layout="vertical">
      <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
        <Input placeholder="2-32 个字符" />
      </Form.Item>
      <Form.Item name="nickname" label="昵称">
        <Input placeholder="选填" />
      </Form.Item>
      <Form.Item name="password" label="密码" rules={[{ required: true, min: 6, message: '至少 6 位' }]}>
        <Input.Password placeholder="至少 6 位" />
      </Form.Item>
      <Button htmlType="submit" block loading={loading}>
        注册
      </Button>
    </Form>
  );

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #38bdf8 100%)',
      }}
    >
      <Card style={{ width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>BI 数据报表平台</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>拖拽式报表 · 可视化大屏 · 一键嵌入</div>
        </div>
        <Tabs
          centered
          items={[
            { key: 'login', label: '登录', children: loginForm },
            { key: 'register', label: '注册', children: registerForm },
          ]}
        />
      </Card>
    </div>
  );
}
