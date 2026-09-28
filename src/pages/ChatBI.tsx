import { useEffect, useRef, useState } from 'react';
import {
  Button, Empty, Input, Modal, Select, Space, Tag, Tooltip, message,
} from 'antd';
import {
  RobotOutlined, UserOutlined, SendOutlined, SaveOutlined,
  CodeOutlined, SyncOutlined, DeleteOutlined,
} from '@ant-design/icons';
import ChartRenderer from '../components/ChartRenderer';
import { askChatBi, createChart, listDatasets } from '../api';
import type { ChatAnswer, DatasetItem } from '../api/types';
import { formatNumber } from '../utils/fmt';

interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
  answer?: ChatAnswer;
  failed?: boolean;
  loading?: boolean;
}

const SUGGESTIONS = [
  '最近三个月每个月的销售额趋势',
  '各品类销售额占比',
  '各大区的利润对比，从高到低',
  '总的订单量是多少',
  '各城市的销售额和利润、订单量关系',
];

export default function ChatBI() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [datasetId, setDatasetId] = useState<number | undefined>();
  const [active, setActive] = useState<ChatAnswer | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listDatasets().then(setDatasets);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const ask = async (q?: string) => {
    const question = (q ?? input).trim();
    if (!question || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: question }, { role: 'assistant', text: '', loading: true }]);
    setLoading(true);
    try {
      const answer = await askChatBi(question, datasetId);
      setActive(answer);
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = {
          role: 'assistant',
          text: answer.explanation || '已为你生成图表',
          answer,
        };
        return next;
      });
    } catch (e: any) {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { role: 'assistant', text: e?.message || '生成失败，请重试', failed: true };
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  const saveAsChart = async () => {
    if (!active) return;
    await createChart(saveName || active.chartName, active.datasetId, active.config);
    message.success('已保存到图表列表');
    setSaveOpen(false);
  };

  return (
    <div style={{ display: 'flex', height: '100%', gap: 12, padding: 12, overflow: 'hidden' }}>
      {/* 左：对话区 */}
      <div
        style={{
          width: 400, flexShrink: 0, background: '#fff', borderRadius: 10,
          border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <RobotOutlined style={{ color: '#2563eb', fontSize: 18 }} />
          <b>AI 问数</b>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>自然语言 · 自动生成图表</span>
          <div style={{ flex: 1 }} />
          {messages.length > 0 && (
            <Tooltip title="清空对话">
              <Button size="small" type="text" icon={<DeleteOutlined />} onClick={() => { setMessages([]); setActive(null); }} />
            </Tooltip>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 30 }}>
              <RobotOutlined style={{ fontSize: 40, color: '#c7d2fe' }} />
              <div style={{ color: '#6b7280', fontSize: 13, margin: '12px 0 4px' }}>
                试试这样问：
              </div>
              <Space direction="vertical" size={6} style={{ marginTop: 8 }}>
                {SUGGESTIONS.map((s) => (
                  <Button
                    key={s} size="small" style={{ borderColor: '#c7d2fe', color: '#4f46e5' }}
                    onClick={() => ask(s)}
                  >
                    {s}
                  </Button>
                ))}
              </Space>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', gap: 8, marginBottom: 12 }}>
              <div
                style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: m.role === 'user' ? '#2563eb' : m.failed ? '#fee2e2' : '#eef2ff',
                  color: m.role === 'user' ? '#fff' : m.failed ? '#b91c1c' : '#4f46e5',
                }}
              >
                {m.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
              </div>
              <div
                style={{
                  maxWidth: '80%', padding: '8px 12px', borderRadius: 10, fontSize: 13,
                  lineHeight: 1.7,
                  background: m.role === 'user' ? '#2563eb' : m.failed ? '#fef2f2' : '#f6f7f9',
                  color: m.role === 'user' ? '#fff' : m.failed ? '#b91c1c' : '#1f2937',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {m.loading ? (
                  <span><SyncOutlined spin /> 正在分析数据集并生成图表...</span>
                ) : m.text}
                {m.answer && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
                    「{m.answer.chartName}」 · 数据集：{m.answer.datasetName}
                    {m.answer.result && ` · ${m.answer.result.rows.length} 行 · ${m.answer.result.costMs}ms`}
                    {m.answer.retried && ' · 已自动纠错'}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div style={{ padding: 10, borderTop: '1px solid #f0f0f0' }}>
          <Select
            size="small" allowClear placeholder="自动选择数据集" style={{ width: '100%', marginBottom: 8 }}
            value={datasetId} onChange={setDatasetId}
            options={datasets.map((d) => ({ label: d.name, value: d.id }))}
          />
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="例如：最近三个月每个月的销售额趋势"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPressEnter={() => ask()}
              disabled={loading}
            />
            <Button type="primary" icon={<SendOutlined />} loading={loading} onClick={() => ask()}>
              发送
            </Button>
          </Space.Compact>
        </div>
      </div>

      {/* 右：图表结果区 */}
      <div
        style={{
          flex: 1, background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb',
          display: 'flex', flexDirection: 'column', minWidth: 0,
        }}
      >
        {active ? (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <b style={{ fontSize: 15 }}>{active.chartName}</b>
              <Tag color="blue">{active.datasetName}</Tag>
              <Tag>{active.config?.chartType}</Tag>
              {active.result && <span style={{ fontSize: 12, color: '#9ca3af' }}>{active.result.costMs}ms</span>}
              <div style={{ flex: 1 }} />
              <Tooltip title={showSql ? '隐藏 SQL' : '查看生成的 SQL'}>
                <Button size="small" icon={<CodeOutlined />} onClick={() => setShowSql(!showSql)} />
              </Tooltip>
              <Button size="small" type="primary" ghost icon={<SaveOutlined />} onClick={() => { setSaveName(active.chartName); setSaveOpen(true); }}>
                保存为图表
              </Button>
            </div>
            {showSql && (
              <pre
                style={{
                  margin: '10px 16px 0', padding: 10, background: '#0f172a', color: '#7dd3fc',
                  borderRadius: 8, fontSize: 12, overflow: 'auto', maxHeight: 160,
                }}
              >
                {active.sql}
              </pre>
            )}
            <div style={{ flex: 1, minHeight: 0, padding: 12 }}>
              <ChartRenderer config={active.config} data={active.result} />
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
            <RobotOutlined style={{ fontSize: 56, color: '#e5e7eb' }} />
            <div style={{ marginTop: 12, fontSize: 13 }}>提问后，生成的图表会显示在这里</div>
            <div style={{ marginTop: 4, fontSize: 12, color: '#c7cdd8' }}>
              AI 会自动选择数据集 · 生成图表配置 · 查询数据并渲染
            </div>
          </div>
        )}
      </div>

      <Modal
        open={saveOpen}
        onCancel={() => setSaveOpen(false)}
        onOk={saveAsChart}
        title="保存为图表"
        okText="保存"
      >
        <Input
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          placeholder="图表名称"
          onPressEnter={saveAsChart}
        />
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
          保存后可在「图表」列表查看，并可在仪表板设计器中通过图表组件引用。
        </div>
      </Modal>
    </div>
  );
}
