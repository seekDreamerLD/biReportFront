import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Empty, List, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DatabaseOutlined } from '@ant-design/icons';
import { deleteDataset, listDatasets, listDatasources } from '../api';
import type { DatasetItem, DatasourceItem } from '../api/types';
import { useAuthStore } from '../stores/auth';

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  builtin_demo: { label: '内置演示', color: 'blue' },
  mysql: { label: 'MySQL', color: 'geekblue' },
  upload: { label: '文件上传', color: 'purple' },
};

export default function DatasetList() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<DatasetItem[]>([]);
  const [sources, setSources] = useState<DatasourceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listDatasets(), listDatasources()])
      .then(([ds, ss]) => {
        setItems(ds);
        setSources(ss);
      })
      .finally(() => setLoading(false));
  }, []);

  const canEdit = (d: DatasetItem) => user?.role === 'admin' || d.ownerId === user?.id;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>数据集</h3>
        {user?.role !== 'viewer' && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/datasets/new')}>
            新建数据集
          </Button>
        )}
      </div>
      {items.length === 0 && !loading ? (
        <Card><Empty description="暂无数据集" /></Card>
      ) : (
        <List
          grid={{ gutter: 16, column: 3 }}
          loading={loading}
          dataSource={items}
          renderItem={(d) => {
            const src = sources.find((s) => s.id === d.datasourceId);
            const fieldCount = (() => {
              try { return JSON.parse(d.fieldsJson).length; } catch { return 0; }
            })();
            return (
              <Card
                hoverable size="small"
                title={<span style={{ fontSize: 13 }}><DatabaseOutlined style={{ color: '#2563eb', marginRight: 6 }} />{d.name}</span>}
                extra={src ? <Tag color={TYPE_LABEL[src.type]?.color}>{TYPE_LABEL[src.type]?.label || src.type}</Tag> : null}
                actions={[
                  ...(canEdit(d)
                    ? [
                        <EditOutlined key="edit" onClick={() => navigate(`/datasets/${d.id}/edit`)} />,
                        <Popconfirm key="del" title="确认删除？引用它的图表将不可用" onConfirm={async () => { await deleteDataset(d.id); setItems(await listDatasets()); }}>
                          <DeleteOutlined style={{ color: '#ef4444' }} />
                        </Popconfirm>,
                      ]
                    : []),
                ]}
              >
                <div style={{ fontSize: 12, color: '#6b7280', wordBreak: 'break-all' }}>
                  {d.sqlText.length > 90 ? d.sqlText.slice(0, 90) + '...' : d.sqlText}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>{fieldCount} 个字段</div>
              </Card>
            );
          }}
        />
      )}
    </div>
  );
}
