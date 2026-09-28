import { useEffect, useState } from 'react';
import {
  Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select,
  Space, Table, Tag, Upload, message,
} from 'antd';
import {
  PlusOutlined, DatabaseOutlined, CloudServerOutlined, UploadOutlined,
  DeleteOutlined, EditOutlined, ApiOutlined, FileExcelOutlined,
} from '@ant-design/icons';
import {
  createDatasource, deleteDatasource, listDatasources, testDatasource,
  updateDatasource, uploadDatasource,
} from '../api';
import type { DatasourceItem } from '../api/types';
import { useAuthStore } from '../stores/auth';

const TYPE_META: Record<string, { label: string; color: string }> = {
  builtin_demo: { label: '内置演示', color: 'blue' },
  mysql: { label: 'MySQL', color: 'geekblue' },
  upload: { label: '文件上传', color: 'purple' },
};

export default function DataSourceList() {
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<DatasourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mysqlOpen, setMysqlOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DatasourceItem | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setItems(await listDatasources());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const canEdit = (d: DatasourceItem) =>
    user?.role === 'admin' || (d.ownerId === user?.id && d.type !== 'builtin_demo');

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>数据源</h3>
        {user?.role !== 'viewer' && (
          <Space>
            <Button icon={<CloudServerOutlined />} onClick={() => { setEditTarget(null); setMysqlOpen(true); }}>
              连接 MySQL
            </Button>
            <Upload
              accept=".xlsx,.xls,.csv"
              showUploadList={false}
              customRequest={async ({ file, onSuccess, onError }) => {
                try {
                  const d = await uploadDatasource(file as File);
                  message.success(`导入成功：${(() => { try { return JSON.parse(d.configJson).rowCount + ' 行'; } catch { return ''; } })()}`);
                  onSuccess?.(d);
                  refresh();
                } catch (e: any) {
                  onError?.(e);
                }
              }}
            >
              <Button icon={<FileExcelOutlined />}>上传 Excel/CSV</Button>
            </Upload>
          </Space>
        )}
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        pagination={false}
        columns={[
          {
            title: '名称', dataIndex: 'name',
            render: (v, r) => (
              <Space>
                <DatabaseOutlined style={{ color: '#2563eb' }} />
                <span>{v}</span>
                <Tag color={TYPE_META[r.type]?.color}>{TYPE_META[r.type]?.label || r.type}</Tag>
              </Space>
            ),
          },
          {
            title: '配置信息', dataIndex: 'configJson',
            render: (v, r) => {
              try {
                const c = JSON.parse(v || '{}');
                if (r.type === 'mysql') return `${c.host}:${c.port}/${c.database}`;
                if (r.type === 'upload') return `表 ${c.table} · ${c.rowCount} 行 · ${c.fileName}`;
                return '电商演示数据（自动生成）';
              } catch {
                return '-';
              }
            },
          },
          { title: '创建时间', dataIndex: 'createdAt', width: 170,
            render: (v) => new Date(v).toLocaleString('zh-CN') },
          {
            title: '操作', width: 140,
            render: (_, r) => (
              <Space>
                {r.type === 'mysql' && (
                  <a onClick={async () => {
                    try {
                      const cfg = JSON.parse(r.configJson || '{}');
                      await testDatasource('mysql', cfg);
                      message.success('连接正常');
                    } catch { /* 拦截器已提示 */ }
                  }}>
                    <ApiOutlined /> 测试
                  </a>
                )}
                {canEdit(r) && r.type === 'mysql' && (
                  <a onClick={() => { setEditTarget(r); setMysqlOpen(true); }}>
                    <EditOutlined /> 编辑
                  </a>
                )}
                {canEdit(r) && r.type !== 'builtin_demo' && (
                  <Popconfirm title="确认删除该数据源？" onConfirm={async () => { await deleteDatasource(r.id); refresh(); }}>
                    <a style={{ color: '#ef4444' }}><DeleteOutlined /></a>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />

      <MysqlModal
        open={mysqlOpen}
        target={editTarget}
        onClose={() => setMysqlOpen(false)}
        onSaved={refresh}
      />
    </div>
  );
}

function MysqlModal({ open, target, onClose, onSaved }: {
  open: boolean;
  target: DatasourceItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (target) {
        try {
          const c = JSON.parse(target.configJson || '{}');
          form.setFieldsValue({ name: target.name, ...c });
        } catch { /* 忽略 */ }
      } else {
        form.resetFields();
        form.setFieldsValue({ host: '127.0.0.1', port: 3306 });
      }
    }
  }, [open, target]);

  const onTest = async () => {
    const values = await form.validateFields();
    setTesting(true);
    try {
      await testDatasource('mysql', { ...values });
      message.success('连接成功');
    } finally {
      setTesting(false);
    }
  };

  const onSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const config = {
        host: values.host, port: String(values.port),
        database: values.database, username: values.username, password: values.password,
      };
      if (target) {
        await updateDatasource(target.id, values.name, config);
      } else {
        await createDatasource(values.name, 'mysql', config);
      }
      message.success('已保存');
      onClose();
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={target ? '编辑 MySQL 数据源' : '连接 MySQL 数据源'}
      footer={
        <Space>
          <Button onClick={onTest} loading={testing}>测试连接</Button>
          <Button type="primary" onClick={onSave} loading={saving}>保存</Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="数据源名称" rules={[{ required: true }]}>
          <Input placeholder="如：订单库" />
        </Form.Item>
        <Space.Compact style={{ width: '100%' }}>
          <Form.Item name="host" label="主机" rules={[{ required: true }]} style={{ width: '60%' }}>
            <Input placeholder="127.0.0.1" />
          </Form.Item>
          <Form.Item name="port" label="端口" rules={[{ required: true }]} style={{ width: '40%', paddingLeft: 8 }}>
            <InputNumber style={{ width: '100%' }} placeholder="3306" />
          </Form.Item>
        </Space.Compact>
        <Form.Item name="database" label="数据库" rules={[{ required: true }]}>
          <Input placeholder="database name" />
        </Form.Item>
        <Space.Compact style={{ width: '100%' }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]} style={{ width: '50%' }}>
            <Input placeholder="root" />
          </Form.Item>
          <Form.Item name="password" label="密码" style={{ width: '50%', paddingLeft: 8 }}>
            <Input.Password placeholder="密码" />
          </Form.Item>
        </Space.Compact>
      </Form>
    </Modal>
  );
}
