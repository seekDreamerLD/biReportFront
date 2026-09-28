import { Layout, Menu, Dropdown, Space, Avatar } from 'antd';
import {
  DashboardOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  TeamOutlined,
  UserOutlined,
  LogoutOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { logout } from '../api';

const { Sider, Header, Content } = Layout;

const MENU_ITEMS = [
  { key: '/dashboards', icon: <DashboardOutlined />, label: '仪表板' },
  { key: '/chatbi', icon: <RobotOutlined />, label: 'AI 问数' },
  { key: '/charts', icon: <BarChartOutlined />, label: '图表' },
  { key: '/datasets', icon: <DatabaseOutlined />, label: '数据集' },
  { key: '/datasources', icon: <CloudServerOutlined />, label: '数据源' },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, clear } = useAuthStore();

  // 未登录：声明式重定向（渲染期调用 navigate() 会导致白屏）
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const selected = MENU_ITEMS.find((m) => location.pathname.startsWith(m.key))?.key || '/dashboards';
  const items = user?.role === 'admin'
    ? [...MENU_ITEMS, { key: '/users', icon: <TeamOutlined />, label: '用户管理' }]
    : MENU_ITEMS;

  const onMenuClick = ({ key }: { key: string }) => navigate(key);

  const userMenu = {
    items: [
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录' },
    ],
    onClick: async () => {
      try {
        await logout();
      } catch {
        // 忽略登出接口异常
      }
      clear();
      navigate('/login');
    },
  };

  return (
    <Layout style={{ height: '100vh' }}>
      <Sider theme="dark" width={200}>
        <div
          style={{
            color: '#fff', fontSize: 17, fontWeight: 700, height: 56,
            display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: 1,
          }}
        >
          BI 数据报表平台
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[selected]} items={items} onClick={onMenuClick} />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff', height: 48, padding: '0 20px',
            display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Dropdown menu={userMenu}>
            <Space style={{ cursor: 'pointer' }}>
              <Avatar size="small" icon={<UserOutlined />} />
              <span>{user?.nickname || user?.username}</span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>({user?.role})</span>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ overflow: 'auto', background: '#f5f6f8' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
