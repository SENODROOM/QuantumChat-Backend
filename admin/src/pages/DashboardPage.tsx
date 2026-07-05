import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, type Analytics, type Website } from '../api';
import { useTheme } from '../context/ThemeContext';

const CHART_COLORS = ['#3B82F6', '#06B6D4', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899'];
const PIE_COLORS = ['#3B82F6', '#06B6D4', '#8B5CF6', '#10B981'];

function useChartStyles() {
  const { theme } = useTheme();
  const style = getComputedStyle(document.documentElement);
  return {
    tooltip: {
      contentStyle: {
        background: style.getPropertyValue('--qc-tooltip-bg').trim(),
        border: `1px solid ${style.getPropertyValue('--qc-tooltip-border').trim()}`,
        borderRadius: 12,
      },
      labelStyle: { color: style.getPropertyValue('--qc-muted').trim() },
      itemStyle: { color: style.getPropertyValue('--qc-text').trim() },
    },
    grid: style.getPropertyValue('--qc-chart-grid').trim(),
    axis: style.getPropertyValue('--qc-muted').trim(),
    key: theme,
  };
}

export function DashboardPage() {
  const chart = useChartStyles();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await api.getWebsites();
        if (!active) return;
        setWebsites(data);
        if (data.length > 0) setSelectedId(data[0]._id);
        else setLoading(false);
      } catch (err) {
        console.error(err);
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setLoading(true);
    api.getAnalytics(selectedId)
      .then((stats) => { if (active) setAnalytics(stats); })
      .catch(console.error)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedId]);

  const website = websites.find((w) => w._id === selectedId);

  const stats = analytics
    ? [
        { label: 'Total Users', value: analytics.users, accent: 'from-blue-500 to-blue-600' },
        { label: 'Conversations', value: analytics.conversations, accent: 'from-cyan-500 to-blue-500' },
        { label: 'Total Messages', value: analytics.messages, accent: 'from-indigo-500 to-blue-600' },
        { label: 'Online Now', value: analytics.onlineUsers, accent: 'from-emerald-500 to-teal-600' },
        { label: 'Messages (7d)', value: analytics.recentMessages, accent: 'from-violet-500 to-indigo-600' },
      ]
    : [];

  return (
    <div>
      <div
        className="mb-6 rounded-xl border px-4 py-3 text-sm"
        style={{
          background: 'rgba(59, 130, 246, 0.08)',
          borderColor: 'rgba(59, 130, 246, 0.25)',
          color: 'var(--qc-muted)',
        }}
      >
        <strong className="text-qc-text">Controlled admin access:</strong> you can view analytics, manage sites,
        and manage users. Personal conversations and message content are private and not available here.
      </div>

      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="qc-page-title">Dashboard</h1>
          <p className="qc-page-subtitle">
            {website ? `Analytics for ${website.name}` : 'Platform analytics and activity'}
          </p>
        </div>
        {websites.length > 1 && (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="qc-admin-input max-w-xs"
          >
            {websites.map((w) => (
              <option key={w._id} value={w._id}>{w.name}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="qc-admin-card p-12 flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-qc-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : analytics && website ? (
        <div className="space-y-6">
          <div className="qc-admin-card p-6" style={{ borderColor: 'var(--qc-accent-glow)' }}>
            <p className="text-sm text-qc-muted mb-1">Total Registered Users</p>
            <p className="text-5xl font-bold text-qc-text">{analytics.users.toLocaleString()}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="qc-admin-card p-5 hover:border-brand/30 transition-colors">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.accent} mb-3 opacity-90`} />
                <p className="text-2xl font-bold text-qc-text">{s.value.toLocaleString()}</p>
                <p className="text-xs text-qc-muted mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="qc-admin-card p-6">
              <h2 className="text-lg font-semibold text-qc-text mb-4">Messages — Last 7 Days</h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={analytics.charts.messagesByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                  <XAxis dataKey="label" stroke={chart.axis} fontSize={12} />
                  <YAxis stroke={chart.axis} fontSize={12} allowDecimals={false} />
                  <Tooltip {...chart.tooltip} />
                  <Line type="monotone" dataKey="count" name="Messages" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="qc-admin-card p-6">
              <h2 className="text-lg font-semibold text-qc-text mb-4">New Signups — Last 7 Days</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={analytics.charts.signupsByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                  <XAxis dataKey="label" stroke={chart.axis} fontSize={12} />
                  <YAxis stroke={chart.axis} fontSize={12} allowDecimals={false} />
                  <Tooltip {...chart.tooltip} />
                  <Bar dataKey="count" name="Signups" fill="#06B6D4" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="qc-admin-card p-6">
              <h2 className="text-lg font-semibold text-qc-text mb-4">Users by Role</h2>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={analytics.charts.usersByRole}
                    dataKey="count"
                    nameKey="role"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={{ stroke: '#64748B' }}
                  >
                    {analytics.charts.usersByRole.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...chart.tooltip} />
                  <Legend wrapperStyle={{ color: chart.axis, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="qc-admin-card p-6">
              <h2 className="text-lg font-semibold text-qc-text mb-4">Platform Activity</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={analytics.charts.activity} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                  <XAxis type="number" stroke={chart.axis} fontSize={12} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke={chart.axis} fontSize={12} width={100} />
                  <Tooltip {...chart.tooltip} />
                  <Bar dataKey="value" name="Count" radius={[0, 6, 6, 0]}>
                    {analytics.charts.activity.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="qc-admin-card p-10 text-center">
          <p className="text-qc-text font-medium mb-2">No websites yet</p>
          <p className="text-qc-muted text-sm">Create a website from the Sites page to see analytics.</p>
        </div>
      )}
    </div>
  );
}
