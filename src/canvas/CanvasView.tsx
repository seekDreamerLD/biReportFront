import { useEffect, useMemo, useRef, useState } from 'react';
import { DatePicker, Select, Empty, Tag } from 'antd';
import type { Dayjs } from 'dayjs';
import ChartRenderer from '../components/ChartRenderer';
import type {
  CanvasComponent,
  ChartConfig,
  DashboardConfig,
  DataFilter,
  QueryResultData,
} from '../api/types';

export type QueryFn = (chartId: number, filters: DataFilter[]) => Promise<QueryResultData>;
export type DistinctFn = (chartId: number, field: string) => Promise<QueryResultData>;

interface CanvasViewProps {
  config: DashboardConfig;
  /** chartId -> 图表配置（由调用方预加载） */
  chartConfigs: Record<number, ChartConfig>;
  queryFn: QueryFn;
  distinctFn?: DistinctFn;
  dark?: boolean;
  /** 等比缩放适配容器；false 时按画布原始尺寸并出现滚动条 */
  fit?: boolean;
}

/** 画布运行时：组件渲染 + 全局筛选 + 联动 + 下钻（预览/嵌入共用） */
export default function CanvasView({
  config,
  chartConfigs,
  queryFn,
  distinctFn,
  dark,
  fit = true,
}: CanvasViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [linkage, setLinkage] = useState<Record<string, { field: string; value: any }[]>>({});
  const [drillStack, setDrillStack] = useState<Record<string, { field: string; value: any }[]>>({});

  const canvasW = config.canvas?.width || 1920;
  const canvasH = config.canvas?.height || 1080;

  useEffect(() => {
    if (!fit) {
      setScale(1);
      return;
    }
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      setScale(Math.min(el.clientWidth / canvasW, el.clientHeight / canvasH));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, canvasW, canvasH]);

  const components = config.components || [];

  /** 计算某图表组件最终生效的筛选（全局筛选组件 + 联动 + 下钻） */
  const filtersFor = (comp: CanvasComponent): DataFilter[] => {
    const list: DataFilter[] = [];
    components
      .filter((c) => c.type === 'dateFilter' || c.type === 'selectFilter')
      .forEach((fc) => {
        const bound = fc.props.bindChartIds || [];
        if (!bound.includes(comp.props.chartId || 0)) return;
        const v = filterValues[fc.id];
        if (v === undefined || v === null || v === '') return;
        if (fc.type === 'dateFilter' && Array.isArray(v) && v.length === 2) {
          list.push({
            field: fc.props.field!,
            op: 'between',
            values: [v[0].format('YYYY-MM-DD 00:00:00'), v[1].format('YYYY-MM-DD 23:59:59')],
          });
        }
        if (fc.type === 'selectFilter') {
          const values = Array.isArray(v) ? v : [v];
          if (values.length) {
            list.push({ field: fc.props.field!, op: values.length > 1 ? 'in' : 'eq', values });
          }
        }
      });
    (linkage[comp.id] || []).forEach((l) => list.push({ field: l.field, op: 'eq', values: [l.value] }));
    (drillStack[comp.id] || []).forEach((d) => list.push({ field: d.field, op: 'eq', values: [d.value] }));
    return list;
  };

  const onChartClick = (comp: CanvasComponent, field: string, value: string | number) => {
    const drills = comp.props.drillFields || [];
    if (drills.length) {
      const stack = drillStack[comp.id] || [];
      if (stack.length < drills.length) {
        setDrillStack((s) => ({ ...s, [comp.id]: [...stack, { field: drills[stack.length], value }] }));
        return;
      }
    }
    const links = (config.links || []).filter((l) => l.source === comp.id && l.sourceField === field);
    if (links.length) {
      setLinkage((prev) => {
        const next = { ...prev };
        links.forEach((l) => {
          l.targets.forEach((t) => {
            const existing = next[t.component] || [];
            next[t.component] = [...existing.filter((e) => e.field !== t.field), { field: t.field, value }];
          });
        });
        return next;
      });
    }
  };

  const theme = dark || config.canvas?.theme === 'dark';
  const bgColor = config.canvas?.bgColor || (theme ? '#0b1220' : '#eef1f6');

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%', overflow: fit ? 'hidden' : 'auto', position: 'relative' }}>
      <div
        style={{
          width: canvasW,
          height: canvasH,
          transform: fit ? `scale(${scale})` : undefined,
          transformOrigin: 'top left',
          background: bgColor,
          position: 'relative',
          margin: '0 auto',
        }}
      >
        {components.length === 0 && (
          <div style={{ paddingTop: 80, textAlign: 'center' }}>
            <Empty description="画布为空" />
          </div>
        )}
        {components.map((comp) => (
          <div
            key={comp.id}
            style={{
              position: 'absolute',
              left: comp.x,
              top: comp.y,
              width: comp.w,
              height: comp.h,
              zIndex: comp.z || 1,
            }}
          >
            <ComponentBody
              comp={comp}
              theme={theme}
              chartConfig={chartConfigs[comp.props.chartId || 0]}
              queryFn={queryFn}
              distinctFn={distinctFn}
              filters={comp.type === 'chart' ? filtersFor(comp) : []}
              filterValue={filterValues[comp.id]}
              onFilterChange={(v) => setFilterValues((s) => ({ ...s, [comp.id]: v }))}
              onChartClick={onChartClick}
              drillStack={drillStack[comp.id] || []}
              interactive={
                (comp.props.drillFields?.length || 0) > 0 ||
                (config.links || []).some((l) => l.source === comp.id)
              }
              onDrillReset={(levels) =>
                setDrillStack((s) => ({ ...s, [comp.id]: (s[comp.id] || []).slice(0, levels) }))
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface BodyProps {
  comp: CanvasComponent;
  theme: boolean;
  chartConfig?: ChartConfig;
  queryFn: QueryFn;
  distinctFn?: DistinctFn;
  filters: DataFilter[];
  filterValue?: any;
  onFilterChange: (v: any) => void;
  onChartClick: (comp: CanvasComponent, field: string, value: string | number) => void;
  drillStack: { field: string; value: any }[];
  onDrillReset: (levels: number) => void;
  /** 图表是否可点击（配置了下钻或联动） */
  interactive?: boolean;
}

/** 单个组件的内容渲染（设计器画布与运行时共用） */
export function ComponentBody(props: BodyProps) {
  const { comp, theme, chartConfig, queryFn, filters } = props;
  const style = comp.style || {};
  const boxStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    background: style.bgColor ?? (theme ? 'rgba(30, 41, 59, 0.7)' : '#ffffff'),
    color: style.fontColor ?? (theme ? '#e2e8f0' : '#1f2937'),
    border: `1px solid ${style.borderColor ?? (theme ? '#1e293b' : '#e5e7eb')}`,
    borderRadius: style.borderRadius ?? 8,
    padding: style.padding ?? 8,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: theme ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
  };

  if (comp.type === 'text') {
    return (
      <div
        style={{
          ...boxStyle,
          background: style.bgColor ?? 'transparent',
          border: style.borderColor ? boxStyle.border : 'none',
          justifyContent: 'center',
          alignItems: style.align === 'left' ? 'flex-start' : style.align === 'right' ? 'flex-end' : 'center',
        }}
      >
        <span
          style={{
            fontSize: style.fontSize || 24,
            fontWeight: style.bold === false ? 400 : 700,
            color: style.fontColor ?? (theme ? '#e2e8f0' : '#111827'),
          }}
        >
          {comp.props.text || '文本组件'}
        </span>
      </div>
    );
  }

  if (comp.type === 'image') {
    return (
      <div style={boxStyle}>
        {comp.props.src ? (
          <img src={comp.props.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未设置图片地址" />
        )}
      </div>
    );
  }

  if (comp.type === 'rect') {
    return <div style={{ ...boxStyle, background: style.bgColor || (theme ? '#1e293b' : '#dbeafe'), border: 'none' }} />;
  }

  if (comp.type === 'clock') {
    return <ClockComp style={style} theme={theme} />;
  }

  if (comp.type === 'dateFilter') {
    return (
      <div style={{ ...boxStyle, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: style.fontSize || 13, whiteSpace: 'nowrap' }}>
          {comp.props.title || style.title || '日期范围'}
        </span>
        <DatePicker.RangePicker
          size="small"
          style={{ flex: 1 }}
          value={(props.filterValue as [Dayjs, Dayjs]) || null}
          onChange={(v) => props.onFilterChange(v)}
          allowClear
        />
      </div>
    );
  }

  if (comp.type === 'selectFilter') {
    return <SelectFilterBody {...props} boxStyle={boxStyle} />;
  }

  return <ChartBody {...props} boxStyle={boxStyle} />;
}

function ClockComp({ style, theme }: { style: any; theme: boolean }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: style.bgColor ?? 'transparent',
        borderRadius: style.borderRadius ?? 8,
      }}
    >
      <div style={{ fontSize: style.fontSize || 32, fontWeight: 700, color: style.fontColor ?? (theme ? '#38bdf8' : '#2563eb') }}>
        {now.toLocaleTimeString('zh-CN', { hour12: false })}
      </div>
      <div style={{ fontSize: 12, color: theme ? '#94a3b8' : '#6b7280', marginTop: 4 }}>
        {now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' })}
      </div>
    </div>
  );
}

function SelectFilterBody(props: BodyProps & { boxStyle: React.CSSProperties }) {
  const { comp, distinctFn, filterValue, onFilterChange } = props;
  const [options, setOptions] = useState<string[]>(comp.props.options || []);

  useEffect(() => {
    if (options.length > 0 || !distinctFn) return;
    const chartId = (comp.props.bindChartIds || [])[0];
    const field = comp.props.field;
    if (!chartId || !field) return;
    distinctFn(chartId, field)
      .then((res) => {
        const seen = new Set<string>();
        const opts: string[] = [];
        res.rows.forEach((r) => {
          const s = String(r[0] ?? '');
          if (s && !seen.has(s)) {
            seen.add(s);
            opts.push(s);
          }
        });
        setOptions(opts);
      })
      .catch(() => setOptions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ ...props.boxStyle, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: comp.style?.fontSize || 13, whiteSpace: 'nowrap' }}>
        {comp.props.title || comp.style?.title || comp.props.field}
      </span>
      <Select
        size="small"
        mode="multiple"
        allowClear
        maxTagCount="responsive"
        placeholder="全部"
        style={{ flex: 1 }}
        value={filterValue || []}
        onChange={onFilterChange}
        options={options.map((o) => ({ label: o, value: o }))}
      />
    </div>
  );
}

function ChartBody({
  comp,
  theme,
  chartConfig,
  queryFn,
  distinctFn,
  filters,
  onChartClick,
  drillStack,
  onDrillReset,
  boxStyle,
  interactive,
}: BodyProps & { boxStyle: React.CSSProperties }) {
  const chartId = comp.props.chartId;
  const [data, setData] = useState<QueryResultData | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const filtersKey = JSON.stringify(filters);
  // queryFn 可能是每次渲染的新箭头函数，用 ref 固定避免请求循环
  const queryRef = useRef(queryFn);
  queryRef.current = queryFn;

  useEffect(() => {
    if (!chartId) return;
    let cancelled = false;
    setLoading(true);
    queryRef.current(chartId, JSON.parse(filtersKey))
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData(undefined);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chartId, filtersKey]);

  const title = comp.props.title || comp.style?.title;
  const drills = comp.props.drillFields || [];

  return (
    <div style={boxStyle}>
      {title && comp.style?.showTitle !== false && (
        <div
          style={{
            fontSize: comp.style?.fontSize || 14,
            fontWeight: 600,
            color: comp.style?.fontColor ?? (theme ? '#e2e8f0' : '#1f2937'),
            padding: '0 4px 6px',
            display: 'flex',
            justifyContent: comp.style?.align === 'left' ? 'flex-start' : 'center',
            flexShrink: 0,
          }}
        >
          {title}
        </div>
      )}
      {drills.length > 0 && (
        <div style={{ padding: '0 4px 4px', display: 'flex', gap: 4, flexWrap: 'wrap', flexShrink: 0 }}>
          <Tag style={{ cursor: 'pointer' }} onClick={() => onDrillReset(0)}>全部</Tag>
          {drillStack.map((d, i) => (
            <Tag key={i} color="blue" style={{ cursor: 'pointer' }} onClick={() => onDrillReset(i + 1)}>
              {d.field} = {String(d.value)}
            </Tag>
          ))}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, cursor: interactive ? 'pointer' : undefined }}>
        {chartId && chartConfig ? (
          <ChartRenderer
            config={chartConfig}
            data={data}
            loading={loading}
            dark={theme}
            compact={(comp.h || 0) < 300}
            onDimensionClick={
              interactive
                ? (field: string, value: string | number) => onChartClick(comp, field, value)
                : undefined
            }
          />
        ) : chartId ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="加载图表配置..." />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.8 }}>
              未绑定图表
              <br />
              请在右侧属性面板的「绑定图表」中选择
            </div>
          </Empty>
        )}
      </div>
    </div>
  );
}
