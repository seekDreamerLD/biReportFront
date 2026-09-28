import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button, Empty, Input, message, Select, Space, Table, Tag, Tooltip,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, PlayCircleOutlined, TableOutlined } from '@ant-design/icons';
import {
  createDataset, getDataset, listDatasets, listDatasources, listColumns,
  listTables, previewDataset, updateDataset,
} from '../api';
import type { DatasetField, DatasetItem, DatasourceItem, PreviewData } from '../api/types';

export default function DatasetEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const datasetId = id ? Number(id) : null;

  const [name, setName] = useState('未命名数据集');
  const [datasourceId, setDatasourceId] = useState<number | null>(null);
  const [sqlText, setSqlText] = useState('SELECT * FROM demo_orders LIMIT 100');
  const [fields, setFields] = useState<DatasetField[]>([]);
  const [sources, setSources] = useState<DatasourceItem[]>([]);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [browserTable, setBrowserTable] = useState<string | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [columns, setColumns] = useState<{ name: string; type: string }[]>([]);

  useEffect(() => {
    listDatasources().then(setSources);
  }, []);

  useEffect(() => {
    if (!datasetId) {
      // 从编辑页返回新建时组件实例复用，需重置状态
      setName('未命名数据集');
      setDatasourceId(null);
      setSqlText('SELECT * FROM demo_orders LIMIT 100');
      setFields([]);
      setPreview(null);
      setBrowserTable(null);
      setColumns([]);
      return;
    }
    getDataset(datasetId).then((d) => {
      setName(d.name);
      setDatasourceId(d.datasourceId);
      setSqlText(d.sqlText);
      try { setFields(JSON.parse(d.fieldsJson)); } catch { /* 空 */ }
    });
  }, [datasetId]);

  useEffect(() => {
    if (!datasourceId) return;
    listTables(datasourceId).then(setTables).catch(() => setTables([]));
  }, [datasourceId]);

  useEffect(() => {
    if (!datasourceId || !browserTable) return;
    listColumns(datasourceId, browserTable).then(setColumns).catch(() => setColumns([]));
  }, [datasourceId, browserTable]);

  const runPreview = async () => {
    if (!datasourceId) {
      message.warning('请先选择数据源');
      return;
    }
    setRunning(true);
    try {
      const res = await previewDataset(datasourceId, sqlText);
      setPreview(res);
      // 按预览结果自动补全字段元数据
      autoFillFields(res);
    } catch {
      setPreview(null);
    } finally {
      setRunning(false);
    }
  };

  const autoFillFields = (res: PreviewData) => {
    const existing = new Map(fields.map((f) => [f.name, f]));
    const next: DatasetField[] = res.columns.map((c) => {
      if (existing.has(c.name)) return existing.get(c.name)!;
      const isNumber = res.rows.some((r) => r[res.columns.indexOf(c)] !== null && !Number.isNaN(Number(r[res.columns.indexOf(c)])) && r[res.columns.indexOf(c)] !== '');
      const looksDate = /date|time|日期|时间/i.test(c.name) || res.rows.some((r) => {
        const v = r[res.columns.indexOf(c)];
        return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);
      });
      return {
        name: c.name,
        label: c.name,
        fieldType: looksDate ? 'dimension' : isNumber ? 'measure' : 'dimension',
        dataType: looksDate ? 'date' : isNumber ? 'number' : 'string',
        defaultAgg: isNumber && !looksDate ? 'sum' : undefined,
      };
    });
    setFields(next);
  };

  const save = async () => {
    if (!datasourceId) {
      message.warning('请选择数据源');
      return;
    }
    if (!fields.length) {
      message.warning('请先执行预览生成字段');
      return;
    }
    setSaving(true);
    try {
      if (datasetId) {
        await updateDataset(datasetId, name, sqlText, fields);
        message.success('已保存');
      } else {
        const d = await createDataset(name, datasourceId, sqlText, fields);
        message.success('已创建');
        navigate(`/datasets/${d.id}/edit`, { replace: true });
      }
    } finally {
      setSaving(false);
    }
  };

  const patchField = (idx: number, p: Partial<DatasetField>) => {
    setFields((fs) => fs.map((f, i) => (i === idx ? { ...f, ...p } : f)));
  };

  return (
    <div style={{ padding: 16, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/datasets')} />
        <Input value={name} onChange={(e) => setName(e.target.value)} style={{ width: 240 }} placeholder="数据集名称" />
        <Select
          placeholder="数据源" style={{ width: 220 }} showSearch optionFilterProp="label"
          value={datasourceId} onChange={setDatasourceId}
          options={sources.map((s) => ({ label: s.name, value: s.id }))}
        />
        <div style={{ flex: 1 }} />
        <Button icon={<PlayCircleOutlined />} loading={running} onClick={runPreview}>执行预览</Button>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>保存</Button>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        {/* 表结构浏览 */}
        <div style={{ width: 230, background: '#fff', borderRadius: 8, padding: 10, border: '1px solid #e5e7eb', flexShrink: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
            <TableOutlined style={{ marginRight: 4, color: '#2563eb' }} />表结构
          </div>
          <Select
            placeholder="选择表" style={{ width: '100%' }} showSearch
            value={browserTable} onChange={setBrowserTable}
            options={tables.map((t) => ({ label: t, value: t }))}
          />
          <div style={{ marginTop: 8, maxHeight: 360, overflowY: 'auto' }}>
            {columns.map((c) => (
              <div
                key={c.name}
                onClick={() => setSqlText((s) => s + (s.includes(c.name) ? '' : ''))}
                style={{ padding: '3px 4px', fontSize: 12, borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}
              >
                <span>{c.name}</span>
                <span style={{ color: '#9ca3af' }}>{c.type}</span>
              </div>
            ))}
            {browserTable && !columns.length && <div style={{ color: '#9ca3af', fontSize: 12 }}>无字段信息</div>}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', padding: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>SQL（仅允许 SELECT）</div>
            <Input.TextArea
              value={sqlText}
              onChange={(e) => setSqlText(e.target.value)}
              autoSize={{ minRows: 5, maxRows: 12 }}
              style={{ fontFamily: 'Consolas, Monaco, monospace', fontSize: 13 }}
              placeholder="SELECT ... FROM your_table"
            />
          </div>

          {preview && (
            <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', padding: 10, marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>预览（前 100 行）</div>
              <div style={{ overflow: 'auto', maxHeight: 220 }}>
                <Table
                  size="small" pagination={false} scroll={{ x: true }}
                  columns={preview.columns.map((c) => ({ title: c.name, dataIndex: c.name, key: c.name,
                    render: (v: any) => (typeof v === 'number' ? v : (v ?? '-')) }))}
                  dataSource={preview.rows.map((r, i) => {
                    const obj: Record<string, any> = { key: i };
                    preview.columns.forEach((c, ci) => (obj[c.name] = r[ci]));
                    return obj;
                  })}
                />
              </div>
            </div>
          )}

          <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', padding: 10, marginTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>字段标注（维度参与分组，度量参与聚合）</div>
            {!fields.length ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="执行预览后自动生成" />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {fields.map((f, i) => (
                  <div key={f.name} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, fontSize: 12 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6, wordBreak: 'break-all' }}>{f.name}</div>
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Input size="small" placeholder="显示名" value={f.label} onChange={(e) => patchField(i, { label: e.target.value })} />
                      <Space.Compact style={{ width: '100%' }}>
                        <Select size="small" style={{ flex: 1 }} value={f.fieldType}
                          options={[{ label: '维度', value: 'dimension' }, { label: '度量', value: 'measure' }]}
                          onChange={(v) => patchField(i, { fieldType: v })} />
                        <Select size="small" style={{ flex: 1 }} value={f.dataType}
                          options={[{ label: '文本', value: 'string' }, { label: '数值', value: 'number' }, { label: '日期', value: 'date' }]}
                          onChange={(v) => patchField(i, { dataType: v })} />
                      </Space.Compact>
                      {f.fieldType === 'measure' && (
                        <Select size="small" style={{ width: '100%' }} value={f.defaultAgg || 'sum'}
                          options={[
                            { label: '求和', value: 'sum' }, { label: '平均', value: 'avg' },
                            { label: '计数', value: 'count' }, { label: '去重计数', value: 'countDistinct' },
                            { label: '最大', value: 'max' }, { label: '最小', value: 'min' },
                          ]}
                          onChange={(v) => patchField(i, { defaultAgg: v })} />
                      )}
                    </Space>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
