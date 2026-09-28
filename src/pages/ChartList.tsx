import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Empty, List, Popconfirm, Tooltip, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, BarChartOutlined } from '@ant-design/icons';
import { deleteChart, listCharts } from '../api';
import type { ChartItem } from '../api/types';
import { CHART_TYPE_LABELS } from '../utils/fmt';
import { useAuthStore } from '../stores/auth';

export default function ChartList() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<ChartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCharts().then(setItems).finally(() => setLoading(false));
  }, []);

  const canEdit = (c: ChartItem) => user?.role === 'admin' || c.ownerId === user?.id;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>图表</h3>
        {user?.role !== 'viewer' && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/charts/new')}>
            新建图表
          </Button>
        )}
      </div>
      {items.length === 0 && !loading ? (
        <Card><Empty description="暂无图表" /></Card>
      ) : (
        <List
          grid={{ gutter: 16, column: 4 }}
          loading={loading}
          dataSource={items}
          renderItem={(c) => {
            const type = (() => {
              try { return JSON.parse(c.configJson).chartType; } catch { return 'bar'; }
            })();
            return (
              <Card
                hoverable size="small"
                title={<span style={{ fontSize: 13 }}><BarChartOutlined style={{ color: '#2563eb', marginRight: 6 }} />{c.name}</span>}
                actions={[
                  ...(canEdit(c)
                    ? [
                        <Tooltip key="edit" title="编辑"><EditOutlined onClick={() => navigate(`/charts/${c.id}/edit`)} /></Tooltip>,
                        <Popconfirm key="del" title="确认删除？" onConfirm={async () => { await deleteChart(c.id); setItems(await listCharts()); }}>
                          <DeleteOutlined style={{ color: '#ef4444' }} />
                        </Popconfirm>,
                      ]
                    : []),
                ]}
              >
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  类型：{CHART_TYPE_LABELS[type] || type}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                  更新于 {new Date(c.updatedAt).toLocaleString('zh-CN')}
                </div>
              </Card>
            );
          }}
        />
      )}
    </div>
  );
}
