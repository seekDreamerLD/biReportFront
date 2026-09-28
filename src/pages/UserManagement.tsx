import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, message } from 'antd';
import { PlusOutlined, DeleteOutlined, KeyOutlined } from '@ant-design/icons';
import axios from '../api/client';

interface UserRow {
  id: number;
  username: string;
  nickname: string;
  role: string;
  status: number;
  createdAt: string;
}

const ROLE_DESC: Record<string, string> = {
  admin: '管理全部资源与用户',
  editor: '创建/编辑自己的资源',
  viewer: '只读浏览',
};

export default function UserManagement() {
  const [items, setItems] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [form] = Form.useForm();
  const [pwdForm] = Form.useForm();

  const refresh = async () => {
    setLoading(true);
    try {
      setItems(await axios.get('/users/list'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const update = async (id: number, patch: Record<string, unknown>) => {
    await axios.put(`/users/${id}`, patch);
    message.success('已更新');
    refresh();
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>用户管理</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCreateOpen(true); }}>
          新建用户
        </Button>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        pagination={false}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 60 },
          { title: '用户名', dataIndex: 'username' },
          { title: '昵称', dataIndex: 'nickname' },
          {
            title: '角色', dataIndex: 'role', width: 150,
            render: (v, r) => (
              <Select
                size="small" value={v} style={{ width: 110 }}
                options={Object.keys(ROLE_DESC).map((k) => ({ label: k, value: k }))}
                onChange={(nv) => update(r.id, { role: nv })}
              />
            ),
          },
          {
            title: '状态', dataIndex: 'status', width: 90,
            render: (v, r) => (
              <Switch checked={v === 1} onChange={(nv) => update(r.id, { status: nv ? 1 : 0 })} />
            ),
          },
          { title: '创建时间', dataIndex: 'createdAt', width: 170,
            render: (v) => new Date(v).toLocaleString('zh-CN') },
          {
            title: '操作', width: 150,
            render: (_, r) => (
              <Space>
                <a onClick={() => { pwdForm.resetFields(); setResetTarget(r); }}>
                  <KeyOutlined /> 重置密码
                </a>
                <Popconfirm title="确认删除该用户？" onConfirm={async () => { await axios.delete(`/users/${r.id}`); refresh(); }}>
                  <a style={{ color: '#ef4444' }}><DeleteOutlined /></a>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        title="新建用户"
        onOk={async () => {
          const values = await form.validateFields();
          await axios.post('/users/create', values);
          message.success('已创建');
          setCreateOpen(false);
          refresh();
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, min: 2 }]}>
            <Input />
          </Form.Item>
          <Form.Item name="nickname" label="昵称">
            <Input />
          </Form.Item>
          <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="viewer" extra={ROLE_DESC[form.getFieldValue('role') || 'viewer']}>
            <Select
              options={Object.entries(ROLE_DESC).map(([v, l]) => ({ label: `${v}（${l}）`, value: v }))}
              onChange={() => form.setFields([{ name: 'role', errors: [] }])}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!resetTarget}
        onCancel={() => setResetTarget(null)}
        title={`重置密码：${resetTarget?.username}`}
        onOk={async () => {
          const values = await pwdForm.validateFields();
          await update(resetTarget!.id, { password: values.password });
          setResetTarget(null);
        }}
      >
        <Form form={pwdForm} layout="vertical">
          <Form.Item name="password" label="新密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password placeholder="至少 6 位，重置后该用户所有登录态失效" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
