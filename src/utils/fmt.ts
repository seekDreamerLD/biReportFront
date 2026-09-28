/** 数值格式化：大数转为 万/亿 显示 */
export function formatNumber(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '-';
  const n = typeof v === 'string' ? Number(v) : v;
  if (Number.isNaN(n)) return String(v);
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(2) + ' 万亿';
  if (abs >= 1e8) return (n / 1e8).toFixed(2) + ' 亿';
  if (abs >= 1e4) return (n / 1e4).toFixed(2) + ' 万';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

export const PALETTES: Record<string, string[]> = {
  默认: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4'],
  科技蓝: ['#2f7ce0', '#38bdf8', '#6366f1', '#22d3ee', '#4f46e5', '#0ea5e9', '#818cf8', '#67e8f9'],
  暖色: ['#f97316', '#f59e0b', '#ef4444', '#ec4899', '#fbbf24', '#fb7185', '#fdba74', '#fde68a'],
  青绿: ['#10b981', '#14b8a6', '#06b6d4', '#84cc16', '#22c55e', '#2dd4bf', '#4ade80', '#a3e635'],
  大屏紫: ['#8b5cf6', '#a78bfa', '#c084fc', '#6d28d9', '#d946ef', '#7c3aed', '#e879f9', '#5b21b6'],
};

export function paletteColors(name?: string): string[] {
  return PALETTES[name || '默认'] || PALETTES['默认'];
}

export const CHART_TYPE_LABELS: Record<string, string> = {
  bar: '柱状图',
  line: '折线图',
  area: '面积图',
  pie: '饼图',
  bubble: '气泡图',
  combo: '混合图',
  table: '汇总表格',
  kpi: '指标卡',
  detail: '明细表格',
};

export const CHART_TYPE_HINTS: Record<string, string> = {
  bubble: '气泡图：维度作为类别分组，度量1=X 轴、度量2=Y 轴、度量3=气泡大小（可选）',
  combo: '混合图：每个度量可选择柱/线系列与左/右 Y 轴，常用于 金额+比率 双轴对比',
};

export const AGG_LABELS: Record<string, string> = {
  sum: '求和',
  avg: '平均',
  count: '计数',
  countDistinct: '去重计数',
  max: '最大',
  min: '最小',
};

export function genId(prefix: string): string {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
