import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Empty, Result, Segmented, Spin } from 'antd';
import { FullscreenOutlined, ReloadOutlined } from '@ant-design/icons';
import CanvasView from '../canvas/CanvasView';
import { getPublishedDashboard, publicDistinct, publicQuery } from '../api';
import type { ChartConfig, DashboardConfig, QueryResultData, DataFilter } from '../api/types';

interface PublishedData {
  id: number;
  name: string;
  config: string;
  charts: Record<string, { id: number; name: string; config: string }>;
  updatedAt: string;
}

/** 免登录嵌入页：/embed/:token — 供其他项目 iframe 引用 */
export default function Embed() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PublishedData | null>(null);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    // 直接走 axios（不走带鉴权拦截的 client），公开接口
    import('../api/client').then(({ default: http }) =>
      http.get<PublishedData>(`/public/dashboards/${token}`)
        .then((d) => {
          setData(d);
          setError('');
        })
        .catch((e) => setError(e?.message || '加载失败'))
        .finally(() => setLoading(false)),
    );
  }, [token, tick]);

  useEffect(() => {
    if (data) {
      try {
        const cfg = JSON.parse(data.config);
        setMode(cfg.canvas?.theme === 'dark' ? 'dark' : 'light');
      } catch { /* 默认浅色 */ }
    }
  }, [data]);

  if (!token) {
    return <Center><Result status="warning" title="缺少分享 token" /></Center>;
  }
  if (loading) {
    return <Center><Spin size="large" tip="加载报表..." /></Center>;
  }
  if (error) {
    return (
      <Center>
        <Result status="404" title="报表不可用" subTitle={error} extra={<Button onClick={() => setTick((t) => t + 1)}>重试</Button>} />
      </Center>
    );
  }
  if (!data) return null;

  let config: DashboardConfig | null = null;
  const chartConfigs: Record<number, ChartConfig> = {};
  try {
    config = JSON.parse(data.config);
    Object.values(data.charts || {}).forEach((c) => {
      try { chartConfigs[c.id] = JSON.parse(c.config); } catch { /* 忽略单个图表解析失败 */ }
    });
  } catch {
    config = null;
  }
  if (!config) {
    return <Center><Result status="error" title="报表配置解析失败" /></Center>;
  }

  const dark = mode === 'dark';

  return (
    <div style={{ width: '100vw', height: '100vh', background: dark ? '#0b1220' : '#eef1f6', position: 'relative' }}>
      <div
        style={{
          position: 'absolute', top: 10, right: 14, zIndex: 999, opacity: 0.35,
          display: 'flex', gap: 6,
        }}
        className="bireport-embed-toolbar"
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.35')}
      >
        <Segmented
          size="small"
          value={mode}
          onChange={(v) => setMode(v as any)}
          options={[{ label: '浅', value: 'light' }, { label: '深', value: 'dark' }]}
        />
        <Button size="small" icon={<ReloadOutlined />} onClick={() => setTick((t) => t + 1)} title="刷新" />
        <Button size="small" icon={<FullscreenOutlined />} onClick={() => document.documentElement.requestFullscreen?.()} title="全屏" />
      </div>
      <CanvasView
        config={dark ? { ...config, canvas: { ...config.canvas, theme: 'dark' } } : config}
        chartConfigs={chartConfigs}
        dark={dark}
        queryFn={(chartId: number, filters: DataFilter[]) => publicQuery(token!, chartId, filters)}
        distinctFn={(chartId: number, field: string) => publicDistinct(token!, chartId, field)}
      />
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6f8' }}>
      {children}
    </div>
  );
}
