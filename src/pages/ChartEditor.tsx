import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button, Empty, Form, Input, InputNumber, message, Popconfirm, Select,
  Segmented, Slider, Switch, Tag, Tooltip, Tree,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  createChart, getChart, getDataset, listDatasets, queryChart, updateChart,
} from '../api';
import type {
  ChartConfig, ChartDim, ChartMeasure, DataFilter, DatasetField,
  DatasetItem, FilterOp, QueryResultData,
} from '../api/types';
import ChartRenderer from '../components/ChartRenderer';
import { AGG_LABELS, CHART_TYPE_HINTS, CHART_TYPE_LABELS } from '../utils/fmt';

const DATE_LEVELS = [
  { label: '按年', value: 'year' }, { label: '按季', value: 'quarter' },
  { label: '按月', value: 'month' }, { label: '按周', value: 'week' },
  { label: '按日', value: 'day' }, { label: '原值', value: '' },
];

const FILTER_OPS: { label: string; value: FilterOp }[] = [
  { label: '=', value: 'eq' }, { label: '≠', value: 'ne' },
  { label: '包含于', value: 'in' }, { label: '不包含', value: 'notIn' },
  { label: '模糊匹配', value: 'like' },
  { label: '>', value: 'gt' }, { label: '≥', value: 'gte' },
  { label: '<', value: 'lt' }, { label: '≤', value: 'lte' },
  { label: '介于', value: 'between' },
];

export default function ChartEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const chartId = id ? Number(id) : null;

  const [name, setName] = useState('未命名图表');
  const [datasetId, setDatasetId] = useState<number | null>(null);
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [fields, setFields] = useState<DatasetField[]>([]);
  const [config, setConfig] = useState<ChartConfig>(() => emptyConfig());
  const [data, setData] = useState<QueryResultData | undefined>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listDatasets().then(setDatasets);
  }, []);

  useEffect(() => {
    if (!chartId) {
      // 从编辑页返回新建时组件实例复用，需重置状态
      setName('未命名图表');
      setDatasetId(null);
      setConfig(emptyConfig());
      setData(undefined);
      return;
    }
    getChart(chartId).then((c) => {
      setName(c.name);
      setDatasetId(c.datasetId);
      setConfig(JSON.parse(c.configJson));
    });
  }, [chartId]);

  useEffect(() => {
    if (!datasetId) return;
    getDataset(datasetId).then((d) => {
      try {
        setFields(JSON.parse(d.fieldsJson));
      } catch {
        setFields([]);
      }
    });
  }, [datasetId]);

  const runQuery = async (cfg: ChartConfig = config) => {
    if (!chartId) {
      // 新建时未保存，提示先保存
      message.info('请先保存图表后再预览');
      return;
    }
    setLoading(true);
    try {
      const res = await queryChart(chartId);
      setData(res);
    } catch {
      setData(undefined);
    } finally {
      setLoading(false);
    }
  };

  const dims = fields.filter((f) => f.fieldType === 'dimension');
  const measures = fields.filter((f) => f.fieldType === 'measure');

  const patch = (p: Partial<ChartConfig>) => setConfig((c) => ({ ...c, ...p }));

  const addDim = (f: DatasetField) => {
    if (config.dims.some((d) => d.field === f.name)) return;
    patch({ dims: [...config.dims, { field: f.name, label: f.label || f.name, dateLevel: f.dataType === 'date' ? 'month' : '' }] });
  };

  const addMeasure = (f: DatasetField) => {
    if (config.measures.some((m) => m.field === f.name)) return;
    patch({
      measures: [...config.measures, {
        field: f.name, label: f.label || f.name,
        agg: (f.defaultAgg as ChartMeasure['agg']) || 'sum',
      }],
    });
  };

  const save = async () => {
    if (!datasetId) {
      message.warning('请选择数据集');
      return;
    }
    setSaving(true);
    try {
      if (chartId) {
        await updateChart(chartId, name, config);
        message.success('已保存');
        await runQuery();
      } else {
        const c = await createChart(name, datasetId, config);
        message.success('已创建');
        navigate(`/charts/${c.id}/edit`, { replace: true });
      }
    } finally {
      setSaving(false);
    }
  };

  const fieldTreeData = [
    {
      title: `维度 (${dims.length})`, key: 'dim', selectable: false,
      children: dims.map((f) => ({ title: fieldLabel(f), key: `dim:${f.name}`, icon: null })),
    },
    {
      title: `度量 (${measures.length})`, key: 'mea', selectable: false,
      children: measures.map((f) => ({ title: fieldLabel(f), key: `mea:${f.name}` })),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f0f2f5' }}>
      <div style={{ height: 48, background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, flexShrink: 0 }}>
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/charts')} />
        <Input value={name} onChange={(e) => setName(e.target.value)} style={{ width: 220 }} variant="borderless" placeholder="图表名称" />
        <Select
          placeholder="选择数据集" style={{ width: 220 }} showSearch optionFilterProp="label"
          value={datasetId} onChange={setDatasetId}
          options={datasets.map((d) => ({ label: d.name, value: d.id }))}
        />
        <div style={{ flex: 1 }} />
        {chartId && (
          <Popconfirm title="删除该图表？" onConfirm={async () => {
            const { deleteChart } = await import('../api');
            await deleteChart(chartId);
            navigate('/charts');
          }}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        )}
        <Button icon={<ReloadOutlined />} disabled={!chartId} onClick={() => runQuery()}>刷新数据</Button>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>保存</Button>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* 左：字段面板 */}
        <div style={{ width: 240, background: '#fff', borderRight: '1px solid #e5e7eb', padding: 10, overflowY: 'auto' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>字段</div>
          {fields.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={datasetId ? '数据集无字段' : '请先选择数据集'} />
          ) : (
            <>
              {dims.map((f) => (
                <FieldRow key={f.name} tag="维度" color="#2563eb" field={f} onAdd={() => addDim(f)} />
              ))}
              {measures.map((f) => (
                <FieldRow key={f.name} tag="度量" color="#16a34a" field={f} onAdd={() => addMeasure(f)} />
              ))}
            </>
          )}
        </div>

        {/* 中：预览 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 12, minWidth: 0 }}>
          <div style={{ background: '#fff', borderRadius: 8, flex: 1, padding: 8, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontWeight: 600, padding: '2px 6px 8px', fontSize: 14 }}>
              {name}
              {data && <span style={{ float: 'right', fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>{data.costMs} ms</span>}
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {chartId ? (
                <ChartRenderer config={config} data={data} loading={loading} />
              ) : (
                <Empty style={{ paddingTop: 80 }} description="保存后展示数据预览" />
              )}
            </div>
          </div>

          {/* 配置槽位区 */}
          <div style={{ background: '#fff', borderRadius: 8, marginTop: 12, padding: 12 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <SlotBox title="维度（拖入/点击左侧字段）" minHeight={64} flex={1}>
                {config.dims.map((d, i) => (
                  <Tag
                    key={d.field}
                    color="blue"
                    closable
                    onClose={() => patch({ dims: config.dims.filter((_, j) => j !== i) })}
                    style={{ padding: '2px 6px' }}
                  >
                    {d.label || d.field}
                    {d.dateLevel && (
                      <Select
                        size="small" variant="borderless" style={{ width: 74, marginLeft: 4 }}
                        value={d.dateLevel} options={DATE_LEVELS}
                        onChange={(v) => {
                          const dims = [...config.dims];
                          dims[i] = { ...d, dateLevel: v };
                          patch({ dims });
                        }}
                      />
                    )}
                  </Tag>
                ))}
              </SlotBox>
              <SlotBox title="度量" minHeight={64} flex={1}>
                {config.measures.map((m, i) => (
                  <Tag
                    key={m.field}
                    color="green"
                    closable
                    onClose={() => patch({ measures: config.measures.filter((_, j) => j !== i) })}
                    style={{ padding: '2px 6px' }}
                  >
                    {m.label || m.field}
                    <Select
                      size="small" variant="borderless" style={{ width: 76, marginLeft: 4 }}
                      value={m.agg}
                      options={Object.entries(AGG_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                      onChange={(v) => {
                        const ms = [...config.measures];
                        ms[i] = { ...m, agg: v as ChartMeasure['agg'] };
                        patch({ measures: ms });
                      }}
                    />
                    {config.chartType === 'combo' && (
                      <>
                        <Select
                          size="small" variant="borderless" style={{ width: 52 }}
                          value={m.seriesType || (i === 0 ? 'bar' : 'line')}
                          options={[{ value: 'bar', label: '柱' }, { value: 'line', label: '线' }]}
                          onChange={(v) => {
                            const ms = [...config.measures];
                            ms[i] = { ...m, seriesType: v as 'bar' | 'line' };
                            patch({ measures: ms });
                          }}
                        />
                        <Select
                          size="small" variant="borderless" style={{ width: 52 }}
                          value={String(m.yAxis ?? (i === 0 ? 0 : 1))}
                          options={[{ value: '0', label: '左轴' }, { value: '1', label: '右轴' }]}
                          onChange={(v) => {
                            const ms = [...config.measures];
                            ms[i] = { ...m, yAxis: Number(v) as 0 | 1 };
                            patch({ measures: ms });
                          }}
                        />
                      </>
                    )}
                  </Tag>
                ))}
              </SlotBox>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
              <SlotBox title="筛选" minHeight={44} flex={2}>
                {config.filters.map((f, i) => (
                  <FilterTag
                    key={i} filter={f} fields={fields}
                    onChange={(nf) => {
                      const fs = [...config.filters];
                      fs[i] = nf;
                      patch({ filters: fs });
                    }}
                    onRemove={() => patch({ filters: config.filters.filter((_, j) => j !== i) })}
                  />
                ))}
                <AddFilterButton
                  fields={fields}
                  onAdd={(f) => patch({ filters: [...config.filters, f] })}
                />
              </SlotBox>
              <SlotBox title="排序" minHeight={44} flex={1}>
                <Select
                  size="small" allowClear placeholder="排序字段" style={{ width: 130 }}
                  value={config.sort?.field}
                  options={[...config.dims.map((d) => ({ label: d.label || d.field, value: d.field })),
                            ...config.measures.map((m) => ({ label: m.label || m.field, value: m.field }))]}
                  onChange={(v) => patch({ sort: v ? { field: v, dir: config.sort?.dir || 'desc' } : null })}
                />
                {config.sort?.field && (
                  <Segmented
                    size="small" value={config.sort?.dir || 'desc'}
                    options={[{ label: '升', value: 'asc' }, { label: '降', value: 'desc' }]}
                    onChange={(v) => patch({ sort: { field: config.sort!.field, dir: v as any } })}
                  />
                )}
              </SlotBox>
            </div>
          </div>
        </div>

        {/* 右：样式面板 */}
        <div style={{ width: 250, background: '#fff', borderLeft: '1px solid #e5e7eb', padding: 12, overflowY: 'auto' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>图表类型</div>
          <Select
            value={config.chartType} style={{ width: '100%' }}
            options={Object.entries(CHART_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            onChange={(v) => patch({ chartType: v as any })}
          />
          {CHART_TYPE_HINTS[config.chartType] && (
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, lineHeight: 1.6 }}>
              {CHART_TYPE_HINTS[config.chartType]}
            </div>
          )}
          <div style={{ fontWeight: 600, fontSize: 13, margin: '12px 0 8px' }}>样式</div>
          <Form layout="vertical" size="small">
            <Form.Item label="配色方案">
              <Select
                allowClear placeholder="默认"
                value={config.style?.palette}
                options={['科技蓝', '暖色', '青绿', '大屏紫'].map((p) => ({ label: p, value: p }))}
                onChange={(v) => patch({ style: { ...config.style, palette: v } })}
              />
            </Form.Item>
            {config.chartType === 'kpi' && (
              <Form.Item label="指标颜色">
                <Input
                  value={config.style?.kpiColor || '#2563eb'}
                  onChange={(e) => patch({ style: { ...config.style, kpiColor: e.target.value } })}
                  type="color" style={{ width: 60, height: 26, padding: 0 }}
                />
              </Form.Item>
            )}
            {config.chartType === 'pie' && (
              <>
                <Form.Item label="南丁格尔玫瑰模式">
                  <Switch
                    checked={config.style?.rose === true}
                    onChange={(v) => patch({ style: { ...config.style, rose: v } })}
                  />
                </Form.Item>
                <Form.Item label="中心显示总计">
                  <Switch
                    checked={config.style?.showTotal !== false}
                    onChange={(v) => patch({ style: { ...config.style, showTotal: v } })}
                  />
                </Form.Item>
              </>
            )}
            <Form.Item label="显示图例">
              <Switch
                checked={config.style?.showLegend !== false}
                onChange={(v) => patch({ style: { ...config.style, showLegend: v } })}
              />
            </Form.Item>
            <Form.Item label={`返回行数 ${config.limit ?? 1000}`}>
              <Slider
                min={50} max={10000} step={50}
                value={config.limit ?? 1000}
                onChange={(v) => patch({ limit: v })}
              />
            </Form.Item>
            {config.chartType === 'detail' && (
              <Form.Item label="明细展示字段">
                <Select
                  mode="multiple" allowClear style={{ width: '100%' }}
                  placeholder="默认全部字段"
                  value={config.detailFields}
                  options={fields.map((f) => ({ label: f.label || f.name, value: f.name }))}
                  onChange={(v) => patch({ detailFields: v })}
                />
              </Form.Item>
            )}
          </Form>
        </div>
      </div>
    </div>
  );
}

function emptyConfig(): ChartConfig {
  return { chartType: 'bar', dims: [], measures: [], filters: [], limit: 1000, style: {} };
}

function fieldLabel(f: DatasetField) {
  return f.label || f.name;
}

function FieldRow({ tag, color, field, onAdd }: {
  tag: string; color: string; field: DatasetField; onAdd: () => void;
}) {
  const typeIcon = field.dataType === 'date' ? '📅' : field.dataType === 'number' ? '#' : 'A';
  return (
    <Tooltip title={`${tag} · 点击添加`}>
      <div
        onClick={onAdd}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
          border: '1px solid #e5e7eb', borderRadius: 6, marginBottom: 6, cursor: 'pointer',
          background: '#fafafa', fontSize: 13,
        }}
      >
        <span style={{ color, fontSize: 12, fontWeight: 600 }}>{tag}</span>
        <span style={{ color: '#9ca3af', fontSize: 11 }}>{typeIcon}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fieldLabel(field)}
        </span>
      </div>
    </Tooltip>
  );
}

function SlotBox({ title, children, minHeight, flex }: {
  title: string; children: React.ReactNode; minHeight?: number; flex?: number;
}) {
  return (
    <div style={{
      flex, minHeight, border: '1px dashed #d1d5db', borderRadius: 8, padding: '6px 8px',
      background: '#fafbfc',
    }}>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>{children}</div>
    </div>
  );
}

function FilterTag({ filter, fields, onChange, onRemove }: {
  filter: DataFilter;
  fields: DatasetField[];
  onChange: (f: DataFilter) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState(filter.values.join(','));
  const label = fields.find((f) => f.name === filter.field)?.label || filter.field;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #c7d2fe', background: '#eef2ff', borderRadius: 6, padding: '1px 4px', fontSize: 12 }}>
      {label}
      <Select size="small" variant="borderless" style={{ width: 90 }} value={filter.op}
        options={FILTER_OPS}
        onChange={(v) => onChange({ ...filter, op: v })} />
      <Input
        size="small" variant="borderless" style={{ width: 110 }}
        value={text}
        placeholder="值，逗号分隔"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange({ ...filter, values: text.split(',').map((s) => s.trim()).filter(Boolean) })}
      />
      <a style={{ color: '#ef4444' }} onClick={onRemove}>×</a>
    </span>
  );
}

function AddFilterButton({ fields, onAdd }: {
  fields: DatasetField[];
  onAdd: (f: DataFilter) => void;
}) {
  return (
    <Select
      size="small" style={{ width: 120 }} placeholder="+ 添加筛选"
      value={null}
      options={fields.map((f) => ({ label: f.label || f.name, value: f.name }))}
      onChange={(v) => v && onAdd({ field: v, op: 'eq', values: [] })}
      dropdownMatchSelectWidth={false}
    />
  );
}
