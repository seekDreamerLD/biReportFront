import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button, Modal, Select, Input, InputNumber, ColorPicker, Switch,
  Slider, message, Tooltip, Divider, Popconfirm, Segmented, Form, Space, Tag,
} from 'antd';
import {
  SaveOutlined, EyeOutlined, ShareAltOutlined, ArrowLeftOutlined,
  BarChartOutlined, FontSizeOutlined, PictureOutlined, ClockCircleOutlined,
  BorderOutlined, CalendarOutlined, FilterOutlined, CopyOutlined,
  DeleteOutlined, VerticalAlignTopOutlined, VerticalAlignBottomOutlined,
  UndoOutlined, RedoOutlined, LinkOutlined, PlusOutlined,
} from '@ant-design/icons';
import { Rnd } from 'react-rnd';
import {
  getDashboard, updateDashboard, publishDashboard, listCharts, listDatasets,
  queryChart, queryDistinct, getChart, getDataset,
} from '../../api';
import type {
  CanvasComponent, ChartConfig, DashboardConfig, DashboardItem, LinkRule,
} from '../../api/types';
import CanvasView, { ComponentBody } from '../../canvas/CanvasView';
import { genId, CHART_TYPE_LABELS } from '../../utils/fmt';

/** 历史栈（撤销/重做） */
interface Snapshot { components: CanvasComponent[]; links: LinkRule[]; }

const COMPONENT_LIBRARY = [
  { type: 'chart', label: '图表', icon: <BarChartOutlined />, desc: '绑定已创建的图表' },
  { type: 'text', label: '文本标题', icon: <FontSizeOutlined />, desc: '静态文字' },
  { type: 'image', label: '图片', icon: <PictureOutlined />, desc: 'URL 图片' },
  { type: 'clock', label: '时间器', icon: <ClockCircleOutlined />, desc: '实时时钟' },
  { type: 'rect', label: '矩形装饰', icon: <BorderOutlined />, desc: '色块/边框装饰' },
  { type: 'dateFilter', label: '日期筛选', icon: <CalendarOutlined />, desc: '全局日期范围' },
  { type: 'selectFilter', label: '下拉筛选', icon: <FilterOutlined />, desc: '维度值多选' },
] as const;

const DEFAULT_STYLE: CanvasComponent['style'] = {
  bgColor: '#ffffff', fontColor: '#111827', fontSize: 14,
  align: 'center', borderRadius: 8, borderColor: '#e5e7eb', showTitle: true, padding: 8,
};

export default function DashboardDesigner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const designId = Number(id);

  const [dashboard, setDashboard] = useState<DashboardItem | null>(null);
  const [name, setName] = useState('');
  const [config, setConfig] = useState<DashboardConfig>(() => defaultConfig());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chartOptions, setChartOptions] = useState<{ label: string; value: number; config: ChartConfig; datasetId: number }[]>([]);
  const [datasetNames, setDatasetNames] = useState<Record<number, string>>({});
  const [chartConfigs, setChartConfigs] = useState<Record<number, ChartConfig>>({});
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  /** 最近一次保存的快照，用于推导"未保存"状态（避免命令式标记误触发） */
  const [savedSnap, setSavedSnap] = useState<{ name: string; config: string } | null>(null);

  // 撤销/重做
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const [historyTick, setHistoryTick] = useState(0);

  const canvasW = config.canvas.width;
  const canvasH = config.canvas.height;
  const selected = config.components.find((c) => c.id === selectedId) || null;

  useEffect(() => {
    if (!designId) return;
    getDashboard(designId).then((d) => {
      setDashboard(d);
      setName(d.name);
      const cfg = safeParseConfig(d.configJson);
      setConfig(cfg);
      setSavedSnap({ name: d.name, config: JSON.stringify(cfg) });
    });
    listCharts().then((charts) => {
      const opts: typeof chartOptions = [];
      const cfgMap: Record<number, ChartConfig> = {};
      charts.forEach((c) => {
        const cfg = JSON.parse(c.configJson);
        opts.push({ label: c.name, value: c.id, config: cfg, datasetId: c.datasetId });
        cfgMap[c.id] = cfg;
      });
      setChartOptions(opts);
      setChartConfigs(cfgMap);
    });
    listDatasets().then((ds) => {
      const m: Record<number, string> = {};
      ds.forEach((d) => (m[d.id] = d.name));
      setDatasetNames(m);
    });
  }, [designId]);

  const pushHistory = useCallback(() => {
    undoStack.current.push({ components: config.components, links: config.links });
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
    setHistoryTick((t) => t + 1);
  }, [config]);

  const mutate = (fn: (draft: DashboardConfig) => void, record = true) => {
    if (record) pushHistory();
    setConfig((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  };

  const undo = () => {
    const snap = undoStack.current.pop();
    if (!snap) return;
    redoStack.current.push({ components: config.components, links: config.links });
    setConfig((c) => ({ ...c, components: snap.components, links: snap.links }));
    setHistoryTick((t) => t + 1);
  };

  const redo = () => {
    const snap = redoStack.current.pop();
    if (!snap) return;
    undoStack.current.push({ components: config.components, links: config.links });
    setConfig((c) => ({ ...c, components: snap.components, links: snap.links }));
    setHistoryTick((t) => t + 1);
  };

  const dirty = !savedSnap || name !== savedSnap.name || JSON.stringify(config) !== savedSnap.config;

  /** 拖拽左侧组件库进入画布 */
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('component-type') as CanvasComponent['type'];
    if (!type) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left - 60);
    const y = Math.max(0, e.clientY - rect.top - 20);
    const comp = createComponent(type, x, y);
    mutate((d) => d.components.push(comp));
    setSelectedId(comp.id);
  };

  const updateComp = (compId: string, patch: Partial<CanvasComponent>) => {
    mutate((d) => {
      const c = d.components.find((x) => x.id === compId);
      if (c) Object.assign(c, patch);
    }, false);
  };

  const updateStyle = (compId: string, patch: Partial<CanvasComponent['style']>) => {
    mutate((d) => {
      const c = d.components.find((x) => x.id === compId);
      if (c) c.style = { ...c.style, ...patch };
    }, false);
  };

  const updateProps = (compId: string, patch: Partial<CanvasComponent['props']>) => {
    mutate((d) => {
      const c = d.components.find((x) => x.id === compId);
      if (c) c.props = { ...c.props, ...patch };
    }, false);
  };

  const removeComp = (compId: string) => {
    mutate((d) => {
      d.components = d.components.filter((c) => c.id !== compId);
      d.links = d.links.filter((l) => l.source !== compId);
    });
    if (selectedId === compId) setSelectedId(null);
  };

  const duplicateComp = (compId: string) => {
    const src = config.components.find((c) => c.id === compId);
    if (!src) return;
    const copy: CanvasComponent = {
      ...structuredClone(src), id: genId(src.type), x: src.x + 24, y: src.y + 24,
      z: Math.max(...config.components.map((c) => c.z), 0) + 1,
    };
    mutate((d) => d.components.push(copy));
    setSelectedId(copy.id);
  };

  const changeZ = (compId: string, dir: 'top' | 'up' | 'down' | 'bottom') => {
    mutate((d) => {
      const sorted = [...d.components].sort((a, b) => a.z - b.z);
      const idx = sorted.findIndex((c) => c.id === compId);
      if (idx < 0) return;
      const [item] = sorted.splice(idx, 1);
      const target = dir === 'top' ? sorted.length : dir === 'bottom' ? 0
        : dir === 'up' ? Math.min(idx + 1, sorted.length) : Math.max(idx - 1, 0);
      sorted.splice(target, 0, item);
      sorted.forEach((c, i) => (c.z = i + 1));
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateDashboard(designId, name, JSON.stringify(config));
      message.success('已保存');
      setSavedSnap({ name, config: JSON.stringify(config) });
    } finally {
      setSaving(false);
    }
  };

  const onPublish = async () => {
    await save();
    const d = await publishDashboard(designId);
    setDashboard(d);
    const url = `${location.origin}/#/embed/${d.shareToken}`;
    Modal.success({
      title: '发布成功',
      content: (
        <div>
          <p>嵌入 URL（可将下方 iframe 代码粘贴到任意项目页面）：</p>
          <Input.Search readOnly value={url} enterButton="复制 URL" onSearch={() => copyText(url)} />
          <Divider />
          <Input.TextArea
            readOnly autoSize={{ minRows: 2 }}
            value={`<iframe src="${url}" style="width:100%;height:100%;border:0" allowfullscreen></iframe>`}
          />
          <Button size="small" style={{ marginTop: 8 }} onClick={() => copyText(`<iframe src="${url}" style="width:100%;height:100%;border:0" allowfullscreen></iframe>`)}>
            复制 iframe 代码
          </Button>
        </div>
      ),
      width: 640,
    });
  };

  const copyText = (t: string) => {
    navigator.clipboard?.writeText(t).then(
      () => message.success('已复制'),
      () => message.warning('复制失败，请手动选择复制'),
    );
  };

  if (!designId || (designId && !dashboard)) {
    return <div style={{ padding: 40, textAlign: 'center' }}>加载中...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f0f2f5' }}>
      {/* 顶部工具栏 */}
      <div
        style={{
          height: 48, background: '#fff', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, flexShrink: 0,
        }}
      >
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/dashboards')} />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: 240 }} variant="borderless" placeholder="仪表板名称"
        />
        {dirty && <span style={{ color: '#f59e0b', fontSize: 12 }}>未保存</span>}
        <Divider type="vertical" />
        <Tooltip title="撤销"><Button icon={<UndoOutlined />} disabled={!undoStack.current.length} onClick={undo} type="text" /></Tooltip>
        <Tooltip title="重做"><Button icon={<RedoOutlined />} disabled={!redoStack.current.length} onClick={redo} type="text" /></Tooltip>
        <Divider type="vertical" />
        <span style={{ fontSize: 12, color: '#6b7280' }}>画布</span>
        <InputNumber size="small" value={canvasW} min={800} max={7680} step={40}
          onChange={(v) => mutate((d) => { d.canvas.width = v || 1920; })} style={{ width: 90 }} />
        <span>×</span>
        <InputNumber size="small" value={canvasH} min={600} max={4320} step={40}
          onChange={(v) => mutate((d) => { d.canvas.height = v || 1080; })} style={{ width: 90 }} />
        <Segmented
          value={config.canvas.theme}
          onChange={(v) => mutate((d) => { d.canvas.theme = v as any; })}
          options={[{ label: '浅色', value: 'light' }, { label: '深色', value: 'dark' }]}
        />
        <div style={{ flex: 1 }} />
        <Button icon={<LinkOutlined />} onClick={() => setLinkOpen(true)}>联动配置</Button>
        <Button icon={<EyeOutlined />} onClick={() => setPreviewOpen(true)}>预览</Button>
        <Button icon={<ShareAltOutlined />} onClick={onPublish}>发布</Button>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>保存</Button>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* 左侧组件库 */}
        <div style={{ width: 190, background: '#fff', borderRight: '1px solid #e5e7eb', padding: 10, overflowY: 'auto' }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>组件库（拖入画布）</div>
          {COMPONENT_LIBRARY.map((item) => (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => e.dataTransfer.setData('component-type', item.type)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                border: '1px dashed #d1d5db', borderRadius: 8, marginBottom: 8, cursor: 'grab',
                background: '#fafafa', fontSize: 13,
              }}
            >
              <span style={{ fontSize: 18, color: '#2563eb' }}>{item.icon}</span>
              <div>
                <div>{item.label}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{item.desc}</div>
              </div>
            </div>
          ))}
          <Divider style={{ margin: '8px 0' }} />
          <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.8, background: '#f0f5ff', borderRadius: 6, padding: 8 }}>
            <b>使用流程</b>
            <br />① 在「图表」页面选数据集做好图表
            <br />② 回到这里，把「图表」组件拖入画布
            <br />③ 在右侧「绑定图表」中选择它
            <br />
            <span style={{ color: '#9ca3af' }}>数据集与字段都在图表页维护，看板只负责拼装布局</span>
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.6, marginTop: 8 }}>
            拖动定位、八向手柄缩放；图表组件还可配置联动与下钻。
          </div>
        </div>

        {/* 画布区 */}
        <div
          style={{ flex: 1, overflow: 'auto', padding: 16, background: '#e8ebf1' }}
          onClick={() => setSelectedId(null)}
        >
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: canvasW, height: canvasH, position: 'relative',
              background: config.canvas.bgColor || (config.canvas.theme === 'dark' ? '#0b1220' : '#eef1f6'),
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)', borderRadius: 4,
              backgroundImage:
                'linear-gradient(rgba(128,128,128,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.08) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          >
            {config.components.map((comp) => (
              <Rnd
                key={comp.id}
                size={{ width: comp.w, height: comp.h }}
                position={{ x: comp.x, y: comp.y }}
                z={comp.z}
                bounds="parent"
                resizeGrid={[10, 10]}
                dragGrid={[10, 10]}
                minWidth={60}
                minHeight={36}
                enableResizing={{ bottomRight: true, bottom: true, right: true, topLeft: true, top: true, left: true, bottomLeft: true, topRight: true }}
                style={{ zIndex: comp.z }}
                onDragStart={() => setSelectedId(comp.id)}
                onDragStop={(_e, d) => updateComp(comp.id, { x: d.x, y: d.y })}
                onResizeStart={() => setSelectedId(comp.id)}
                onResizeStop={(_e, _dir, ref, _delta, pos) =>
                  updateComp(comp.id, { w: parseInt(ref.style.width), h: parseInt(ref.style.height), ...pos })
                }
              >
                <div
                  onClick={(e) => { e.stopPropagation(); setSelectedId(comp.id); }}
                  style={{
                    width: '100%', height: '100%',
                    outline: selectedId === comp.id ? '2px solid #2563eb' : 'none',
                    outlineOffset: -1, pointerEvents: 'auto',
                  }}
                >
                  <ComponentBody
                    comp={comp}
                    theme={config.canvas.theme === 'dark'}
                    chartConfig={chartConfigs[comp.props.chartId || 0]}
                    queryFn={queryChart}
                    distinctFn={queryDistinct}
                    filters={[]}
                    onFilterChange={() => {}}
                    onChartClick={() => {}}
                    drillStack={[]}
                    onDrillReset={() => {}}
                  />
                </div>
              </Rnd>
            ))}
          </div>
        </div>

        {/* 右侧属性面板 */}
        <div style={{ width: 264, background: '#fff', borderLeft: '1px solid #e5e7eb', overflowY: 'auto', padding: 12 }}>
          {selected ? (
            <PropsPanel
              key={selected.id}
              comp={selected}
              chartOptions={chartOptions}
              datasetNames={datasetNames}
              config={config}
              onUpdate={(patch) => updateComp(selected.id, patch)}
              onUpdateStyle={(patch) => updateStyle(selected.id, patch)}
              onUpdateProps={(patch) => updateProps(selected.id, patch)}
              onRemove={() => removeComp(selected.id)}
              onDuplicate={() => duplicateComp(selected.id)}
              onZ={(dir) => changeZ(selected.id, dir)}
              datasetFieldsOf={async (chartId) => {
                const chart = chartOptions.find((o) => o.value === chartId);
                if (!chart) return [];
                const c = await getChart(chartId);
                const res = await getDataset(c.datasetId);
                return (JSON.parse(res.fieldsJson) as { name: string; label?: string; fieldType: string }[])
                  .map((f) => ({ name: f.name, label: f.label || f.name, fieldType: f.fieldType }));
              }}
            />
          ) : (
            <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>
              选中画布中的组件后在此配置属性
            </div>
          )}
        </div>
      </div>

      {/* 预览 */}
      <Modal
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        width="92vw"
        title={`预览：${name}`}
        styles={{ body: { height: '76vh', padding: 0 } }}
        destroyOnClose
      >
        <PreviewCanvas config={config} chartConfigs={chartConfigs} />
      </Modal>

      {/* 联动配置 */}
      <LinkModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        config={config}
        chartConfigs={chartConfigs}
        onChange={(links) => mutate((d) => { d.links = links; })}
      />
    </div>
  );
}

function defaultConfig(): DashboardConfig {
  return { canvas: { width: 1920, height: 1080, theme: 'light' }, components: [], links: [] };
}

function safeParseConfig(json: string): DashboardConfig {
  try {
    const c = JSON.parse(json);
    return {
      canvas: { width: 1920, height: 1080, theme: 'light', ...(c.canvas || {}) },
      components: c.components || [],
      links: c.links || [],
    };
  } catch {
    return defaultConfig();
  }
}

function createComponent(
  type: CanvasComponent['type'],
  x: number, y: number,
): CanvasComponent {
  const id = genId(type);
  const base = { id, type, z: 100 };
  switch (type) {
    case 'chart':
      // 不自动绑定：强制用户显式选择图表，避免"莫名其妙出图"的困惑
      return {
        ...base, x, y, w: 480, h: 320,
        props: { chartId: undefined, title: '' },
        style: { ...DEFAULT_STYLE },
      };
    case 'text':
      return { ...base, x, y, w: 400, h: 60, props: { text: '标题文本' }, style: { ...DEFAULT_STYLE, fontSize: 26, bold: true, bgColor: 'transparent', borderColor: '' } };
    case 'image':
      return { ...base, x, y, w: 320, h: 220, props: { src: '' }, style: { ...DEFAULT_STYLE } };
    case 'clock':
      return { ...base, x, y, w: 240, h: 100, props: {}, style: { ...DEFAULT_STYLE, fontSize: 30, fontColor: '#2563eb' } };
    case 'rect':
      return { ...base, x, y, w: 300, h: 120, props: {}, style: { ...DEFAULT_STYLE, bgColor: '#dbeafe', borderColor: 'transparent' } };
    case 'dateFilter':
      return { ...base, x, y, w: 360, h: 46, props: { field: '', title: '日期范围', bindChartIds: [] }, style: { ...DEFAULT_STYLE, fontSize: 13 } };
    case 'selectFilter':
      return { ...base, x, y, w: 300, h: 46, props: { field: '', title: '筛选', bindChartIds: [], options: [] }, style: { ...DEFAULT_STYLE, fontSize: 13 } };
    default:
      return { ...base, x, y, w: 320, h: 200, props: {}, style: { ...DEFAULT_STYLE } };
  }
}

function PreviewCanvas({ config, chartConfigs }: { config: DashboardConfig; chartConfigs: Record<number, ChartConfig> }) {
  return <CanvasView config={config} chartConfigs={chartConfigs} queryFn={queryChart} distinctFn={queryDistinct} />;
}

/* ================= 属性面板 ================= */

interface FieldMeta { name: string; label: string; fieldType: string; }

const COMP_TYPE_LABEL: Record<string, string> = {
  chart: '图表组件', text: '文本组件', image: '图片组件', clock: '时间器',
  rect: '矩形装饰', dateFilter: '日期筛选器', selectFilter: '下拉筛选器',
};

function PropsPanel({ comp, chartOptions, datasetNames, config, onUpdate, onUpdateStyle, onUpdateProps, onRemove, onDuplicate, onZ, datasetFieldsOf }: {
  comp: CanvasComponent;
  chartOptions: { label: string; value: number; config: ChartConfig; datasetId: number }[];
  datasetNames: Record<number, string>;
  config: DashboardConfig;
  onUpdate: (patch: Partial<CanvasComponent>) => void;
  onUpdateStyle: (patch: Partial<CanvasComponent['style']>) => void;
  onUpdateProps: (patch: Partial<CanvasComponent['props']>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onZ: (dir: 'top' | 'up' | 'down' | 'bottom') => void;
  datasetFieldsOf: (chartId: number) => Promise<FieldMeta[]>;
}) {
  const navigate = useNavigate();
  const [fields, setFields] = useState<FieldMeta[]>([]);

  useEffect(() => {
    if (comp.type === 'chart' && comp.props.chartId) {
      datasetFieldsOf(comp.props.chartId).then(setFields).catch(() => setFields([]));
    } else {
      setFields([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comp.type, comp.props.chartId]);

  const dimOptions = fields.filter((f) => f.fieldType === 'dimension');
  const boundChart = chartOptions.find((o) => o.value === comp.props.chartId);

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <Tooltip title="复制"><Button size="small" icon={<CopyOutlined />} onClick={onDuplicate} /></Tooltip>
        <Tooltip title="置顶"><Button size="small" icon={<VerticalAlignTopOutlined />} onClick={() => onZ('top')} /></Tooltip>
        <Tooltip title="置底"><Button size="small" icon={<VerticalAlignBottomOutlined />} onClick={() => onZ('bottom')} /></Tooltip>
        <div style={{ flex: 1 }} />
        <Popconfirm title="删除该组件？" onConfirm={onRemove}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </div>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 10, background: '#f3f4f6', borderRadius: 6, padding: '4px 8px' }}>
        已选中：{COMP_TYPE_LABEL[comp.type] || comp.type}
      </div>

      <Form layout="vertical" size="small" labelCol={{ style: { fontSize: 12 } }}>
        {comp.type === 'chart' && (
          <>
            <Form.Item
              label="① 绑定图表"
              style={{ marginBottom: 6 }}
              extra="图表在「图表」页面创建：数据集、维度/度量、图表样式都在其中配置好了，这里只需选择用哪个图"
            >
              <Select
                value={comp.props.chartId}
                options={chartOptions}
                showSearch optionFilterProp="label"
                placeholder="请选择图表"
                allowClear
                onChange={(v, opt) => onUpdateProps({ chartId: v, title: v ? (opt as any).label : '' })}
              />
            </Form.Item>
            {comp.props.chartId && boundChart && (
              <div style={{ marginBottom: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <Tag color="blue">{CHART_TYPE_LABELS[boundChart.config?.chartType] || '图表'}</Tag>
                <Tag>数据集：{datasetNames[boundChart.datasetId] || '—'}</Tag>
              </div>
            )}
            <Space style={{ marginBottom: 12 }}>
              <Button size="small" type="primary" ghost icon={<PlusOutlined />}
                onClick={() => navigate('/charts/new')}>
                新建图表
              </Button>
              <Button size="small" disabled={!comp.props.chartId}
                onClick={() => navigate(`/charts/${comp.props.chartId}/edit`)}>
                编辑该图表
              </Button>
            </Space>
            <Form.Item label="② 组件标题（留空不显示）">
              <Input value={comp.props.title} onChange={(e) => onUpdateProps({ title: e.target.value })} placeholder="默认使用图表名" />
            </Form.Item>
            <Form.Item label="③ 下钻字段（点击图表后依次钻取，如 大区→省→市）">
              <Select
                mode="multiple" allowClear placeholder="选择维度字段（可选）"
                value={comp.props.drillFields || []}
                options={dimOptions.map((f) => ({ label: f.label, value: f.name }))}
                onChange={(v) => onUpdateProps({ drillFields: v })}
              />
            </Form.Item>
          </>
        )}

        <Divider style={{ margin: '4px 0 10px' }} plain>位置与尺寸</Divider>
        <div style={{ display: 'flex', gap: 8 }}>
          <Form.Item label="X" style={{ flex: 1 }}>
            <InputNumber value={comp.x} onChange={(v) => onUpdate({ x: v || 0 })} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Y" style={{ flex: 1 }}>
            <InputNumber value={comp.y} onChange={(v) => onUpdate({ y: v || 0 })} style={{ width: '100%' }} />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Form.Item label="宽" style={{ flex: 1 }}>
            <InputNumber value={comp.w} onChange={(v) => onUpdate({ w: v || 100 })} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="高" style={{ flex: 1 }}>
            <InputNumber value={comp.h} onChange={(v) => onUpdate({ h: v || 100 })} style={{ width: '100%' }} />
          </Form.Item>
        </div>

        {comp.type === 'text' && (
          <Form.Item label="文本内容">
            <Input.TextArea value={comp.props.text} onChange={(e) => onUpdateProps({ text: e.target.value })} autoSize />
          </Form.Item>
        )}

        {comp.type === 'image' && (
          <Form.Item label="图片 URL">
            <Input value={comp.props.src} onChange={(e) => onUpdateProps({ src: e.target.value })} placeholder="https://..." />
          </Form.Item>
        )}

        {(comp.type === 'dateFilter' || comp.type === 'selectFilter') && (
          <>
            <Form.Item label={comp.type === 'dateFilter' ? '日期字段' : '维度字段'}>
              <Select
                showSearch allowClear placeholder="选择字段"
                value={comp.props.field || undefined}
                options={fields.map((f) => ({ label: f.label, value: f.name }))}
                onChange={(v) => onUpdateProps({ field: v || '' })}
                onDropdownVisibleChange={(open) => {
                  if (open && !fields.length && chartOptions[0]) {
                    datasetFieldsOf(chartOptions[0].value).then(setFields).catch(() => {});
                  }
                }}
              />
            </Form.Item>
            <Form.Item label="作用图表">
              <Select
                mode="multiple" allowClear placeholder="选择受影响的图表"
                value={comp.props.bindChartIds || []}
                options={chartOptions}
                onChange={(v) => onUpdateProps({ bindChartIds: v })}
              />
            </Form.Item>
            <Form.Item label="标题">
              <Input value={comp.props.title} onChange={(e) => onUpdateProps({ title: e.target.value })} />
            </Form.Item>
          </>
        )}

        <Divider style={{ margin: '8px 0' }}>样式</Divider>

        <Form.Item label="背景色">
          <ColorPicker
            value={comp.style.bgColor || '#ffffff'}
            onChange={(c) => onUpdateStyle({ bgColor: c.toHexString() })}
            showText allowClear
          />
        </Form.Item>
        {comp.type !== 'clock' && (
          <Form.Item label="文字颜色">
            <ColorPicker
              value={comp.style.fontColor || '#111827'}
              onChange={(c) => onUpdateStyle({ fontColor: c.toHexString() })}
              showText allowClear
            />
          </Form.Item>
        )}
        <Form.Item label={`字号 ${comp.style.fontSize || 14}`}>
          <Slider min={10} max={64} value={comp.style.fontSize || 14} onChange={(v) => onUpdateStyle({ fontSize: v })} />
        </Form.Item>
        <Form.Item label="对齐">
          <Segmented
            value={comp.style.align || 'center'}
            onChange={(v) => onUpdateStyle({ align: v as any })}
            options={[{ label: '左', value: 'left' }, { label: '中', value: 'center' }, { label: '右', value: 'right' }]}
          />
        </Form.Item>
        <Form.Item label="圆角">
          <Slider min={0} max={24} value={comp.style.borderRadius ?? 8} onChange={(v) => onUpdateStyle({ borderRadius: v })} />
        </Form.Item>
        {comp.type === 'chart' && (
          <Form.Item label="显示标题">
            <Switch checked={comp.style.showTitle !== false} onChange={(v) => onUpdateStyle({ showTitle: v })} />
          </Form.Item>
        )}
      </Form>
    </div>
  );
}

/* ================= 联动配置弹窗 ================= */

function LinkModal({ open, onClose, config, chartConfigs, onChange }: {
  open: boolean;
  onClose: () => void;
  config: DashboardConfig;
  chartConfigs: Record<number, ChartConfig>;
  onChange: (links: LinkRule[]) => void;
}) {
  const chartComps = config.components.filter((c) => c.type === 'chart');
  const compOptions = chartComps.map((c) => ({ label: c.props.title || `图表#${c.props.chartId}`, value: c.id }));

  return (
    <Modal
      open={open} onCancel={onClose} onOk={onClose} title="联动配置" width={720}
    >
      <p style={{ color: '#6b7280', fontSize: 12, marginBottom: 12 }}>
        点击源图表的维度值后，目标图表自动按该值过滤（如：点击"华东"，销售额趋势图只显示华东数据）。
      </p>
      {config.links.length === 0 && (
        <Button type="dashed" block onClick={() => onChange([{ source: '', sourceField: '', targets: [] }])}>
          + 添加联动规则
        </Button>
      )}
      {config.links.map((link, i) => {
        const sourceComp = chartComps.find((c) => c.id === link.source);
        const sourceChartId = sourceComp?.props.chartId || 0;
        const sourceConfig = chartConfigs[sourceChartId];
        const sourceDims = (sourceConfig?.dims || []).map((d) => ({ label: d.label || d.field, value: d.field }));
        const otherComps = chartComps.filter((c) => c.id !== link.source);
        return (
          <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12 }}>点击</span>
              <Select
                style={{ width: 200 }} placeholder="源图表"
                value={link.source || undefined} options={compOptions}
                onChange={(v) => {
                  const links = [...config.links];
                  links[i] = { ...link, source: v, sourceField: '' };
                  onChange(links);
                }}
              />
              <span style={{ fontSize: 12 }}>的维度</span>
              <Select
                style={{ width: 160 }} placeholder="维度字段"
                value={link.sourceField || undefined} options={sourceDims}
                onChange={(v) => {
                  const links = [...config.links];
                  links[i] = { ...link, sourceField: v };
                  onChange(links);
                }}
              />
              <div style={{ flex: 1 }} />
              <Button
                size="small" danger type="text"
                onClick={() => onChange(config.links.filter((_, j) => j !== i))}
              >
                删除
              </Button>
            </div>
            <div style={{ marginTop: 8 }}>
              <span style={{ fontSize: 12 }}>过滤目标：</span>
              <Select
                mode="multiple" style={{ width: '100%' }} placeholder="选择联动的目标图表"
                value={link.targets.map((t) => t.component)}
                options={otherComps.map((c) => ({ label: c.props.title || `图表#${c.props.chartId}`, value: c.id }))}
                onChange={(vals) => {
                  const links = [...config.links];
                  links[i] = {
                    ...link,
                    targets: vals.map((cid) => {
                      const existing = link.targets.find((t) => t.component === cid);
                      const cfg = chartConfigs[chartComps.find((c) => c.id === cid)?.props.chartId || 0];
                      return existing || { component: cid, field: cfg?.dims?.[0]?.field || '' };
                    }),
                  };
                  onChange(links);
                }}
              />
              {link.targets.map((t, ti) => {
                const tc = chartComps.find((c) => c.id === t.component);
                const tcfg = chartConfigs[tc?.props.chartId || 0];
                const tdims = (tcfg?.dims || []).map((d) => ({ label: d.label || d.field, value: d.field }));
                return (
                  <div key={ti} style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', fontSize: 12 }}>
                    <span>目标 {ti + 1} 过滤字段：</span>
                    <Select
                      size="small" style={{ width: 200 }} placeholder="字段"
                      value={t.field || undefined} options={tdims.length ? tdims : [{ label: t.field, value: t.field }]}
                      onChange={(v) => {
                        const links = [...config.links];
                        const targets = [...link.targets];
                        targets[ti] = { ...t, field: v };
                        links[i] = { ...link, targets };
                        onChange(links);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {config.links.length > 0 && (
        <Button type="dashed" block onClick={() => onChange([...config.links, { source: '', sourceField: '', targets: [] }])}>
          + 添加联动规则
        </Button>
      )}
    </Modal>
  );
}
