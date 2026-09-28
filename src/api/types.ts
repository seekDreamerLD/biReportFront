// 前后端共享的配置类型定义（与后端 DTO 对应）

export interface DatasetField {
  name: string;
  label?: string;
  fieldType: 'dimension' | 'measure';
  dataType: 'string' | 'number' | 'date';
  defaultAgg?: string;
}

export interface ChartDim {
  field: string;
  label?: string;
  dateLevel?: 'year' | 'quarter' | 'month' | 'week' | 'day' | '';
}

export interface ChartMeasure {
  field: string;
  label?: string;
  agg: 'sum' | 'avg' | 'count' | 'countDistinct' | 'max' | 'min';
  /** 混合图中该度量的系列类型 */
  seriesType?: 'bar' | 'line';
  /** 混合图中该度量绑定的 Y 轴（0 左轴 / 1 右轴） */
  yAxis?: 0 | 1;
}

export type FilterOp =
  | 'eq' | 'ne' | 'in' | 'notIn' | 'like'
  | 'gt' | 'gte' | 'lt' | 'lte' | 'between';

export interface DataFilter {
  field: string;
  op: FilterOp;
  values: (string | number)[];
}

export type ChartType =
  | 'bar' | 'line' | 'area' | 'pie' | 'table' | 'kpi' | 'detail'
  | 'bubble' | 'combo';

export interface ChartStyle {
  showTitle?: boolean;
  title?: string;
  palette?: string;
  showLegend?: boolean;
  kpiColor?: string;
  limit?: number;
  /** 饼图：南丁格尔玫瑰模式 */
  rose?: boolean;
  /** 饼图：中心显示总计 */
  showTotal?: boolean;
}

export interface ChartConfig {
  chartType: ChartType;
  dims: ChartDim[];
  measures: ChartMeasure[];
  filters: DataFilter[];
  sort?: { field: string; dir: 'asc' | 'desc' } | null;
  limit?: number;
  style?: ChartStyle;
  detailFields?: string[];
}

export interface QueryResultData {
  columns: { name: string; type: string }[];
  rows: (string | number | null)[][];
  costMs: number;
}

export interface ChatAnswer {
  explanation: string;
  chartName: string;
  datasetId: number;
  datasetName: string;
  config: ChartConfig;
  result: QueryResultData;
  sql: string;
  retried: boolean;
}

export interface CanvasComponent {
  id: string;
  type: 'chart' | 'text' | 'image' | 'clock' | 'rect' | 'dateFilter' | 'selectFilter';
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  props: {
    chartId?: number;
    title?: string;
    text?: string;
    src?: string;
    field?: string;
    bindChartIds?: number[];
    drillFields?: string[];
    options?: string[];
  };
  style: {
    bgColor?: string;
    fontColor?: string;
    fontSize?: number;
    align?: 'left' | 'center' | 'right';
    borderColor?: string;
    borderRadius?: number;
    padding?: number;
    showTitle?: boolean;
    bold?: boolean;
    /** 兼容旧配置：组件标题也可以放在 style 上 */
    title?: string;
  };
}

export interface LinkRule {
  source: string;
  sourceField: string;
  targets: { component: string; field: string }[];
}

export interface DashboardConfig {
  canvas: { width: number; height: number; theme: 'light' | 'dark'; bgColor?: string };
  components: CanvasComponent[];
  links: LinkRule[];
}

// ===== 后端通用返回 =====

export interface Result<T> {
  code: number;
  msg: string;
  data: T;
}

export interface UserInfo {
  id: number;
  username: string;
  nickname: string;
  role: 'admin' | 'editor' | 'viewer';
}

export interface DatasourceItem {
  id: number;
  name: string;
  type: 'builtin_demo' | 'mysql' | 'upload';
  configJson: string;
  ownerId: number;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetItem {
  id: number;
  name: string;
  datasourceId: number;
  sqlText: string;
  fieldsJson: string;
  ownerId: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChartItem {
  id: number;
  name: string;
  datasetId: number;
  configJson: string;
  ownerId: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardItem {
  id: number;
  name: string;
  configJson: string;
  shareToken: string | null;
  shareEnabled: number;
  ownerId: number;
  createdAt: string;
  updatedAt: string;
}

export interface PreviewData {
  columns: { name: string; type: string }[];
  rows: (string | number | null)[][];
}
