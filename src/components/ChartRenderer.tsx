import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { Table, Empty, Spin } from 'antd';
import type { ChartConfig, QueryResultData } from '../api/types';
import { formatNumber, paletteColors } from '../utils/fmt';

interface Props {
  config: ChartConfig;
  data?: QueryResultData;
  loading?: boolean;
  dark?: boolean;
  /** 维度值点击回调（联动/下钻用） */
  onDimensionClick?: (field: string, value: string | number) => void;
  /** KPI 附加样式 */
  compact?: boolean;
}

function measureColumns(config: ChartConfig): string[] {
  return (config.measures || []).map((m) => `${m.field}__${m.agg}`);
}

function displayName(config: ChartConfig, col: string): string {
  const m = config.measures?.find((x) => `${x.field}__${x.agg}` === col);
  return m?.label || col;
}

export default function ChartRenderer({ config, data, loading, dark, onDimensionClick, compact }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);
  const themeRef = useRef<boolean | undefined>(undefined);
  const clickRef = useRef(onDimensionClick);
  clickRef.current = onDimensionClick;
  const configRef = useRef(config);
  configRef.current = config;

  // 数据到达 / 配置变化 → 懒初始化实例并渲染（div 只有在有数据时才挂载，所以必须在这里 init）
  useEffect(() => {
    if (!data || !chartRef.current) return;
    if (instanceRef.current && themeRef.current !== dark) {
      instanceRef.current.dispose();
      instanceRef.current = null;
    }
    if (!instanceRef.current) {
      const chart = echarts.init(chartRef.current, dark ? 'dark' : undefined);
      chart.on('click', (params: any) => {
        const dimField = configRef.current.dims?.[0]?.field;
        if (dimField && params?.name !== undefined && clickRef.current) {
          clickRef.current(dimField, params.name);
        }
      });
      instanceRef.current = chart;
      themeRef.current = dark;
    }
    instanceRef.current.clear();
    instanceRef.current.setOption(buildOption(config, data, !!dark));
    instanceRef.current.resize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, config, dark]);

  // 容器尺寸自适应
  useEffect(() => {
    const onResize = () => instanceRef.current?.resize();
    window.addEventListener('resize', onResize);
    const timer = setInterval(onResize, 600);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // 卸载销毁
  useEffect(() => () => {
    instanceRef.current?.dispose();
    instanceRef.current = null;
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Spin tip="查询中..." />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  if (config.chartType === 'table' || config.chartType === 'detail') {
    return <TableView config={config} data={data} dark={dark} />;
  }

  if (config.chartType === 'kpi') {
    const cols = data.columns.map((c) => c.name);
    const idx = cols.findIndex((c) => c.includes('__') || c === 'total_cnt');
    const value = data.rows[0]?.[idx >= 0 ? idx : 0];
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: config.style?.kpiColor || (dark ? '#38bdf8' : '#2563eb'),
        }}
      >
        <div style={{ fontSize: compact ? 22 : 34, fontWeight: 700, lineHeight: 1.2 }}>
          {formatNumber(value as number)}
        </div>
        {!compact && (
          <div style={{ fontSize: 13, color: dark ? '#94a3b8' : '#6b7280', marginTop: 8 }}>
            {config.measures?.[0]?.label || '指标'}
          </div>
        )}
      </div>
    );
  }

  return <div ref={chartRef} style={{ width: '100%', height: '100%' }} />;
}

function TableView({ config, data, dark }: { config: ChartConfig; data: QueryResultData; dark?: boolean }) {
  const isDetail = config.chartType === 'detail';
  const cols = isDetail
    ? (config.detailFields && config.detailFields.length ? config.detailFields : data.columns.map((c) => c.name))
    : [...(config.dims || []).map((d) => d.field), ...measureColumns(config)];

  const columns = cols.map((name, i) => {
    const meta = data.columns[i];
    const dimMeta = (config.dims || []).find((d) => d.field === name);
    return {
      title: isDetail ? (meta?.name || name) : (dimMeta?.label || displayName(config, name)),
      dataIndex: String(i),
      key: name,
      render: (v: any) => (meta?.type === 'number' ? formatNumber(v) : (v ?? '-')),
    };
  });

  const rows = data.rows.map((r, ri) => {
    const obj: Record<string, any> = { key: ri };
    cols.forEach((_, ci) => {
      obj[String(ci)] = r[ci];
    });
    return obj;
  });

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <Table
        columns={columns}
        dataSource={rows}
        size="small"
        pagination={{ pageSize: 10, showSizeChanger: false, size: 'small' }}
        style={{ background: dark ? 'transparent' : '#fff' }}
      />
    </div>
  );
}

function buildOption(config: ChartConfig, data: QueryResultData, dark: boolean): echarts.EChartsOption {
  const colors = paletteColors(config.style?.palette);
  const type = config.chartType;
  const dimNames = config.dims?.map((d) => d.field) || [];
  const dimLabels = config.dims?.map((d) => d.label || d.field) || [];
  const measureCols = measureColumns(config);
  const dimIdx = dimNames.map((f) => data.columns.findIndex((c) => c.name === f));
  const mIdx = measureCols.map((f) => {
    const i = data.columns.findIndex((c) => c.name === f);
    return i >= 0 ? i : 0;
  });
  const axisColor = dark ? '#94a3b8' : '#6b7280';
  const splitColor = dark ? '#334155' : '#e5e7eb';
  const cardBg = dark ? '#0f172a' : '#ffffff';

  if (type === 'pie') {
    return buildPieOption(config, data, colors, dimIdx, mIdx, axisColor, splitColor, cardBg, dark);
  }

  if (type === 'bubble') {
    return buildBubbleOption(config, data, dimIdx, mIdx, axisColor, splitColor, colors);
  }

  if (type === 'combo') {
    return buildComboOption(config, data, dimIdx, mIdx, axisColor, splitColor, colors);
  }

  // bar / line / area
  const categories = data.rows.map((r) => String(r[dimIdx[0] >= 0 ? dimIdx[0] : 0] ?? '-'));
  const series = measureCols.map((col, i) => ({
    name: displayName(config, col),
    type: (type === 'bar' ? 'bar' : 'line') as any,
    smooth: type !== 'bar',
    areaStyle: type === 'area' ? { opacity: 0.25 } : undefined,
    barMaxWidth: 40,
    symbol: 'circle',
    symbolSize: 6,
    data: data.rows.map((r) => {
      const v = r[mIdx[i]];
      return v === null || v === undefined ? null : Number(v);
    }),
  }));

  return {
    color: colors,
    tooltip: { trigger: 'axis' },
    legend: {
      bottom: 0, textStyle: { color: axisColor, fontSize: 11 },
      show: config.style?.showLegend !== false && measureCols.length > 0,
    },
    grid: { left: 8, right: 16, top: 24, bottom: measureCols.length > 1 ? 30 : 10, containLabel: true },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        color: axisColor, fontSize: 10,
        rotate: categories.length > 8 ? 30 : 0,
        hideOverlap: true,
      },
      axisLine: { lineStyle: { color: splitColor } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: axisColor, fontSize: 10,
        formatter: (v: number) => formatNumber(v),
      },
      splitLine: { lineStyle: { color: splitColor } },
    },
    series,
  };
}

/* ============ 饼图：现代 BI 风格 ============ */
function buildPieOption(
  config: ChartConfig, data: QueryResultData, colors: string[],
  dimIdx: number[], mIdx: number[],
  axisColor: string, splitColor: string, cardBg: string, dark: boolean,
): echarts.EChartsOption {
  const nameIdx = dimIdx[0] >= 0 ? dimIdx[0] : 0;
  const valIdx = mIdx[0];
  const rows = data.rows.slice().sort((a, b) => Number(b[valIdx]) - Number(a[valIdx]));
  const total = rows.reduce((s, r) => s + (Number(r[valIdx]) || 0), 0);
  const showLabels = rows.length <= 10;
  const rose = config.style?.rose === true;

  return {
    color: colors,
    tooltip: {
      trigger: 'item',
      backgroundColor: dark ? '#1e293b' : '#fff',
      borderColor: splitColor,
      textStyle: { color: dark ? '#e2e8f0' : '#1f2937', fontSize: 12 },
      formatter: (p: any) => `${p.marker} ${p.name}<br/>${p.seriesName}：${formatNumber(p.value)}（${p.percent}%）`,
    },
    legend: {
      bottom: 0,
      left: 'center',
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 14,
      textStyle: { color: axisColor, fontSize: 11 },
      show: config.style?.showLegend !== false,
    },
    graphic: config.style?.showTotal === false ? [] : [
      {
        type: 'text', left: 'center', top: rose ? '44%' : '43%',
        style: {
          text: formatNumber(total),
          fontSize: 20, fontWeight: 700,
          fill: dark ? '#e2e8f0' : '#111827',
          textAlign: 'center', textVerticalAlign: 'middle',
        },
      },
      {
        type: 'text', left: 'center', top: rose ? '52%' : '51%',
        style: {
          text: '总计',
          fontSize: 11,
          fill: axisColor,
          textAlign: 'center', textVerticalAlign: 'middle',
        },
      },
    ],
    series: [{
      name: config.measures?.[0]?.label || '数值',
      type: 'pie',
      radius: rose ? ['18%', '72%'] : ['52%', '72%'],
      center: ['50%', '47%'],
      roseType: rose ? 'radius' : undefined,
      avoidLabelOverlap: true,
      minAngle: 4,
      itemStyle: {
        borderRadius: rose ? 4 : 7,
        borderColor: cardBg,
        borderWidth: 2,
      },
      label: {
        show: showLabels,
        formatter: (p: any) => `{name|${p.name}}\n{pct|${p.percent}%}`,
        rich: {
          name: { fontSize: 11, color: axisColor, lineHeight: 15, align: 'left' },
          pct: { fontSize: 12, fontWeight: 700, color: dark ? '#e2e8f0' : '#374151', lineHeight: 16, align: 'left' },
        },
      },
      labelLine: {
        length: 14, length2: 10, smooth: true,
        lineStyle: { color: splitColor },
      },
      emphasis: {
        scaleSize: 5,
        itemStyle: { shadowBlur: 14, shadowColor: 'rgba(0,0,0,0.25)' },
      },
      data: rows.map((r, i) => ({
        name: String(r[nameIdx] ?? '-'),
        value: Number(r[valIdx]) || 0,
        itemStyle: { color: colors[i % colors.length] },
      })),
    }],
  } as echarts.EChartsOption;
}

/* ============ 气泡图：度量1=X 度量2=Y 度量3=大小 ============ */
function buildBubbleOption(
  config: ChartConfig, data: QueryResultData,
  dimIdx: number[], mIdx: number[],
  axisColor: string, splitColor: string, colors: string[],
): echarts.EChartsOption {
  const measures = config.measures || [];
  const xLabel = measures[0]?.label || 'X';
  const yLabel = measures[1]?.label || 'Y';
  const sizeLabel = measures[2]?.label || '';
  const hasDim = dimIdx[0] >= 0;
  const hasSize = mIdx.length >= 3;

  // 气泡大小归一化到 [12, 52]
  const sizes = hasSize ? data.rows.map((r) => Math.abs(Number(r[mIdx[2]]) || 0)) : [];
  const sizeMax = sizes.length ? Math.max(...sizes) : 0;
  const sizeMin = sizes.length ? Math.min(...sizes) : 0;
  const scaleSize = (raw: number) => {
    if (!hasSize || sizeMax === sizeMin) return 22;
    const t = (Math.abs(raw) - sizeMin) / (sizeMax - sizeMin);
    return Math.round(12 + t * 40);
  };

  // 按维度值分组为多个系列（不同颜色）
  const groupMap = new Map<string, [number, number, number, string][]>();
  data.rows.forEach((r) => {
    const x = Number(r[mIdx[0]]) || 0;
    const y = Number(r[mIdx[1]]) || 0;
    const size = hasSize ? Number(r[mIdx[2]]) || 0 : 0;
    const dimVal = hasDim ? String(r[dimIdx[0]] ?? '-') : '';
    if (!groupMap.has(dimVal)) groupMap.set(dimVal, []);
    groupMap.get(dimVal)!.push([x, y, size, dimVal]);
  });

  const series = [...groupMap.entries()].map(([name, points], gi) => ({
    name,
    type: 'scatter' as const,
    data: points.map((p) => ({
      value: [p[0], p[1], p[2]],
      name,
      symbolSize: scaleSize(p[2]),
    })),
    itemStyle: {
      color: colors[gi % colors.length],
      opacity: 0.78,
      borderColor: '#ffffff55',
      borderWidth: 1,
    },
    emphasis: {
      focus: 'series' as const,
      itemStyle: { opacity: 1, shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' },
    },
  }));

  return {
    color: colors,
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const [x, y, size] = p.value || [];
        let tip = `${p.marker} ${p.name}<br/>${xLabel}：${formatNumber(x)}`;
        if (mIdx.length >= 2) tip += `<br/>${yLabel}：${formatNumber(y)}`;
        if (hasSize && sizeLabel) tip += `<br/>${sizeLabel}：${formatNumber(size)}`;
        return tip;
      },
    },
    legend: {
      bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8,
      textStyle: { color: axisColor, fontSize: 11 },
      show: config.style?.showLegend !== false && hasDim && groupMap.size > 1 && groupMap.size <= 12,
    },
    grid: { left: 8, right: 20, top: 24, bottom: 34, containLabel: true },
    xAxis: {
      type: 'value',
      name: xLabel,
      nameTextStyle: { color: axisColor, fontSize: 10 },
      axisLabel: { color: axisColor, fontSize: 10, formatter: (v: number) => formatNumber(v) },
      splitLine: { lineStyle: { color: splitColor } },
      axisLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: yLabel,
      nameTextStyle: { color: axisColor, fontSize: 10 },
      axisLabel: { color: axisColor, fontSize: 10, formatter: (v: number) => formatNumber(v) },
      splitLine: { lineStyle: { color: splitColor } },
    },
    series,
  } as echarts.EChartsOption;
}

/* ============ 混合图：柱+线 双 Y 轴 ============ */
function buildComboOption(
  config: ChartConfig, data: QueryResultData,
  dimIdx: number[], mIdx: number[],
  axisColor: string, splitColor: string, colors: string[],
): echarts.EChartsOption {
  const measures = config.measures || [];
  const categories = data.rows.map((r) => String(r[dimIdx[0] >= 0 ? dimIdx[0] : 0] ?? '-'));

  // 系列类型与 Y 轴的解析必须与 hasRight 判断保持一致，否则会引用不存在的轴导致渲染崩溃
  const resolved = measures.map((m, i) => ({
    name: m.label || m.field,
    seriesType: m.seriesType || (i === 0 ? 'bar' : 'line'),
    yIdx: m.yAxis ?? (i === 0 ? 0 : 1),
  }));
  const hasRight = resolved.some((r) => r.yIdx === 1);

  const series = resolved.map((r, i) => ({
    name: r.name,
    type: r.seriesType,
    yAxisIndex: r.yIdx,
    smooth: r.seriesType === 'line',
    symbol: 'circle',
    symbolSize: 6,
    barMaxWidth: 28,
    data: data.rows.map((row) => {
      const v = row[mIdx[i]];
      return v === null || v === undefined ? null : Number(v);
    }),
  }));

  const makeAxis = (index: number, alignRight = false): any => ({
    type: 'value',
    name: series.filter((s: any) => s.yAxisIndex === index).map((s: any) => s.name).join(' / '),
    nameTextStyle: { color: axisColor, fontSize: 10 },
    position: alignRight ? 'right' : 'left',
    axisLabel: { color: axisColor, fontSize: 10, formatter: (v: number) => formatNumber(v) },
    splitLine: { show: index === 0, lineStyle: { color: splitColor } },
    axisLine: { show: false },
  });

  return {
    color: colors,
    tooltip: { trigger: 'axis' },
    legend: {
      bottom: 0, textStyle: { color: axisColor, fontSize: 11 },
      show: config.style?.showLegend !== false && measures.length > 1,
    },
    grid: { left: 8, right: hasRight ? 20 : 16, top: 28, bottom: measures.length > 1 ? 30 : 10, containLabel: true },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { color: axisColor, fontSize: 10, rotate: categories.length > 8 ? 30 : 0, hideOverlap: true },
      axisLine: { lineStyle: { color: splitColor } },
      axisTick: { show: false },
    },
    yAxis: hasRight ? [makeAxis(0), makeAxis(1, true)] : makeAxis(0),
    series,
  } as echarts.EChartsOption;
}
