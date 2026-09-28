import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Card, Empty, List, Modal, Popconfirm, Space, Tag, message, Input,
  Tooltip, Segmented,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, ShareAltOutlined,
  StopOutlined, AppstoreOutlined,
} from '@ant-design/icons';
import CanvasView from '../canvas/CanvasView';
import {
  createDashboard, deleteDashboard, getChart, getDataset, listCharts,
  listDashboards, publishDashboard, queryChart, queryDistinct, unpublishDashboard, updateDashboard,
} from '../api';
import type { ChartConfig, DashboardConfig, DashboardItem } from '../api/types';
import { useAuthStore } from '../stores/auth';

export default function DashboardList() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewTarget, setViewTarget] = useState<DashboardItem | null>(null);
  const [shareTarget, setShareTarget] = useState<DashboardItem | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setItems(await listDashboards());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const onCreate = async () => {
    const d = await createDashboard('未命名仪表板', '');
    message.success('已创建，进入设计器');
    navigate(`/dashboards/${d.id}/design`);
  };

  const canEdit = (d: DashboardItem) => user?.role === 'admin' || d.ownerId === user?.id;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>仪表板</h3>
        {user?.role !== 'viewer' && (
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            新建仪表板
          </Button>
        )}
      </div>

      {items.length === 0 && !loading ? (
        <Card><Empty description="暂无仪表板，点击右上角新建" /></Card>
      ) : (
        <List
          grid={{ gutter: 16, column: 4 }}
          loading={loading}
          dataSource={items}
          renderItem={(d) => (
            <Card
              hoverable
              size="small"
              title={
                <span style={{ fontSize: 14 }}>
                  <AppstoreOutlined style={{ marginRight: 6, color: '#2563eb' }} />
                  {d.name}
                </span>
              }
              extra={d.shareEnabled === 1 ? <Tag color="green">已发布</Tag> : null}
              actions={[
                <Tooltip key="view" title="查看"><EyeOutlined onClick={() => setViewTarget(d)} /></Tooltip>,
                ...(canEdit(d)
                  ? [
                      <Tooltip key="edit" title="设计"><EditOutlined onClick={() => navigate(`/dashboards/${d.id}/design`)} /></Tooltip>,
                      <Tooltip key="share" title="分享"><ShareAltOutlined onClick={() => setShareTarget(d)} /></Tooltip>,
                      <Popconfirm key="del" title="确认删除？" onConfirm={async () => { await deleteDashboard(d.id); refresh(); }}>
                        <DeleteOutlined style={{ color: '#ef4444' }} />
                      </Popconfirm>,
                    ]
                  : []),
              ]}
            >
              <div style={{ height: 90, overflow: 'hidden', borderRadius: 6, background: '#eef1f6', position: 'relative', opacity: 0.85 }}>
                <MiniPreview dashboard={d} />
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>
                更新于 {new Date(d.updatedAt).toLocaleString('zh-CN')}
              </div>
            </Card>
          )}
        />
      )}

      <Modal
        open={!!viewTarget}
        onCancel={() => setViewTarget(null)}
        footer={null}
        width="94vw"
        title={viewTarget?.name}
        styles={{ body: { height: '78vh', padding: 0 } }}
        destroyOnClose
      >
        {viewTarget && <FullPreview dashboard={viewTarget} />}
      </Modal>

      <ShareModal target={shareTarget} onClose={() => setShareTarget(null)} onChanged={refresh} />
    </div>
  );
}

function MiniPreview({ dashboard }: { dashboard: DashboardItem }) {
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  useEffect(() => {
    try {
      setConfig(JSON.parse(dashboard.configJson));
    } catch {
      setConfig(null);
    }
  }, [dashboard.id]);
  if (!config || !config.components?.length) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 12 }}>
        空画布
      </div>
    );
  }
  return (
    <div style={{ transform: 'scale(0.14)', transformOrigin: 'top left', width: 1920, height: 643, position: 'absolute', pointerEvents: 'none' }}>
      <div style={{ width: 1920, height: 1080, position: 'relative', background: config.canvas?.bgColor || '#eef1f6' }}>
        {config.components.map((c) => (
          <div key={c.id} style={{
            position: 'absolute', left: c.x, top: c.y, width: c.w, height: c.h,
            background: c.type === 'chart' || c.type === 'dateFilter' || c.type === 'selectFilter' ? '#fff' : (c.style?.bgColor || 'transparent'),
            border: c.type === 'chart' ? '1px solid #e5e7eb' : 'none', borderRadius: 8,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }} />
        ))}
      </div>
    </div>
  );
}

function FullPreview({ dashboard }: { dashboard: DashboardItem }) {
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [chartConfigs, setChartConfigs] = useState<Record<number, ChartConfig>>({});
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    try {
      const cfg: DashboardConfig = JSON.parse(dashboard.configJson);
      setConfig(cfg);
      const ids = cfg.components.map((c) => c.props.chartId).filter(Boolean) as number[];
      Promise.all([...new Set(ids)].map((id) => getChart(id).then((c) => [id, JSON.parse(c.configJson)] as const)))
        .then((entries) => setChartConfigs(Object.fromEntries(entries)));
    } catch {
      setConfig(null);
    }
  }, [dashboard.id]);

  if (!config) return <Empty style={{ paddingTop: 100 }} />;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '6px 10px', background: '#fff', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end' }}>
        <Segmented value={mode} onChange={(v) => setMode(v as any)} options={[{ label: '浅色', value: 'light' }, { label: '深色大屏', value: 'dark' }]} />
      </div>
      <div style={{ flex: 1, minHeight: 0, background: mode === 'dark' ? '#0b1220' : '#eef1f6' }}>
        <CanvasView
          config={mode === 'dark' ? { ...config, canvas: { ...config.canvas, theme: 'dark' } } : config}
          chartConfigs={chartConfigs}
          queryFn={queryChart}
          distinctFn={queryDistinct}
          dark={mode === 'dark'}
        />
      </div>
    </div>
  );
}

function ShareModal({ target, onClose, onChanged }: {
  target: DashboardItem | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [current, setCurrent] = useState<DashboardItem | null>(null);

  useEffect(() => {
    setCurrent(target);
  }, [target]);

  if (!current) return null;
  const url = `${location.origin}/#/embed/${current.shareToken}`;
  const iframe = `<iframe src="${url}" style="width:100%;height:100%;border:0" allowfullscreen></iframe>`;
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(
    () => message.success('已复制'),
    () => message.warning('复制失败，请手动复制'),
  );

  return (
    <Modal
      open={!!target}
      onCancel={onClose}
      footer={null}
      title={`分享：${current.name}`}
      width={620}
    >
      {current.shareEnabled === 1 ? (
        <div>
          <div style={{ marginBottom: 8, color: '#16a34a', fontSize: 13 }}>● 已发布，任何人可通过下方链接免登录访问</div>
          <Input.Search readOnly value={url} enterButton="复制 URL" onSearch={() => copy(url)} style={{ marginBottom: 12 }} />
          <Input.TextArea readOnly autoSize={{ minRows: 2 }} value={iframe} style={{ marginBottom: 8 }} />
          <Space>
            <Button onClick={() => copy(iframe)}>复制 iframe 代码</Button>
            <Button danger icon={<StopOutlined />} onClick={async () => {
              const d = await unpublishDashboard(current.id);
              setCurrent(d);
              onChanged();
              message.success('已停止分享');
            }}>
              停止分享
            </Button>
          </Space>
          <div style={{ marginTop: 10, fontSize: 12, color: '#9ca3af' }}>
            嵌入示例：将 iframe 代码粘贴到其他项目的 HTML 页面即可展示该报表，报表内容更新后嵌入页自动同步。
          </div>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: 12, color: '#6b7280', fontSize: 13 }}>该仪表板未发布，发布后将生成可嵌入的公开 URL</div>
          <Button type="primary" icon={<ShareAltOutlined />} onClick={async () => {
            const d = await publishDashboard(current.id);
            setCurrent(d);
            onChanged();
          }}>
            发布并生成链接
          </Button>
        </div>
      )}
    </Modal>
  );
}
