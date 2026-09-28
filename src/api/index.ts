import client from './client';
import type {
  ChartConfig,
  ChartItem,
  ChatAnswer,
  DashboardConfig,
  DashboardItem,
  DataFilter,
  DatasetField,
  DatasetItem,
  DatasourceItem,
  PreviewData,
  QueryResultData,
  UserInfo,
} from './types';

// ===== 认证 =====
export const login = (username: string, password: string) =>
  client.post<{ token: string; user: UserInfo }>('/auth/login', { username, password });
export const register = (username: string, password: string, nickname?: string) =>
  client.post<UserInfo>('/auth/register', { username, password, nickname });
export const getMe = () => client.get<UserInfo>('/auth/me');
export const logout = () => client.post('/auth/logout');

// ===== 数据源 =====
export const listDatasources = () => client.get<DatasourceItem[]>('/datasources/list');
export const createDatasource = (name: string, type: string, config: Record<string, unknown>) =>
  client.post<DatasourceItem>('/datasources/create', { name, type, config });
export const updateDatasource = (id: number, name?: string, config?: Record<string, unknown>) =>
  client.put<DatasourceItem>(`/datasources/${id}`, { name, config });
export const deleteDatasource = (id: number) => client.delete(`/datasources/${id}`);
export const testDatasource = (type: string, config: Record<string, unknown>) =>
  client.post('/datasources/test', { type, config });
export const uploadDatasource = (file: File, name?: string) => {
  const form = new FormData();
  form.append('file', file);
  if (name) form.append('name', name);
  return client.post<DatasourceItem>('/datasources/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const listTables = (dsId: number) => client.get<string[]>(`/datasources/${dsId}/tables`);
export const listColumns = (dsId: number, table: string) =>
  client.get<{ name: string; type: string }[]>(`/datasources/${dsId}/columns`, { params: { table } });

// ===== 数据集 =====
export const listDatasets = () => client.get<DatasetItem[]>('/datasets/list');
export const getDataset = (id: number) => client.get<DatasetItem>(`/datasets/${id}`);
export const createDataset = (name: string, datasourceId: number, sqlText: string, fields: DatasetField[]) =>
  client.post<DatasetItem>('/datasets/create', { name, datasourceId, sqlText, fields });
export const updateDataset = (id: number, name: string, sqlText: string, fields: DatasetField[]) =>
  client.put<DatasetItem>(`/datasets/${id}`, { name, sqlText, fields });
export const deleteDataset = (id: number) => client.delete(`/datasets/${id}`);
export const previewDataset = (datasourceId: number, sqlText: string) =>
  client.post<PreviewData>('/datasets/preview', { datasourceId, sqlText });

// ===== 图表 =====
export const listCharts = () => client.get<ChartItem[]>('/charts/list');
export const getChart = (id: number) => client.get<ChartItem>(`/charts/${id}`);
export const createChart = (name: string, datasetId: number, config: ChartConfig) =>
  client.post<ChartItem>('/charts/create', { name, datasetId, config });
export const updateChart = (id: number, name: string, config: ChartConfig) =>
  client.put<ChartItem>(`/charts/${id}`, { name, config });
export const deleteChart = (id: number) => client.delete(`/charts/${id}`);
export const queryChart = (chartId: number, extraFilters: DataFilter[] = []) =>
  client.post<QueryResultData>('/query', { chartId, extraFilters });
export const queryDistinct = (chartId: number, field: string) =>
  client.post<QueryResultData>('/query/distinct', { chartId, field });

// ===== 仪表板 =====
export const listDashboards = () => client.get<DashboardItem[]>('/dashboards/list');
export const getDashboard = (id: number) => client.get<DashboardItem>(`/dashboards/${id}`);
export const createDashboard = (name: string, configJson: string) =>
  client.post<DashboardItem>('/dashboards/create', { name, configJson });
export const updateDashboard = (id: number, name?: string, configJson?: string) =>
  client.put<DashboardItem>(`/dashboards/${id}`, { name, configJson });
export const deleteDashboard = (id: number) => client.delete(`/dashboards/${id}`);
export const publishDashboard = (id: number) => client.post<DashboardItem>(`/dashboards/${id}/publish`);
export const unpublishDashboard = (id: number) => client.post<DashboardItem>(`/dashboards/${id}/unpublish`);

// ===== AI 问数 =====
export const askChatBi = (question: string, datasetId?: number) =>
  client.post<ChatAnswer>('/chatbi/ask', { question, datasetId });

// ===== 公开嵌入 =====
export const getPublishedDashboard = (token: string) =>
  client.get<{ id: number; name: string; config: string; updatedAt: string }>(
    `/public/dashboards/${token}`,
  );
export const publicQuery = (shareToken: string, chartId: number, extraFilters: DataFilter[] = []) =>
  client.post<QueryResultData>('/public/query', { shareToken, chartId, extraFilters });
export const publicDistinct = (shareToken: string, chartId: number, field: string) =>
  client.post<QueryResultData>('/public/query/distinct', { shareToken, chartId, field });
