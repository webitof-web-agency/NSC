import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { RefreshCw } from 'lucide-react';
import Constants from '@constants/api';
import type { RootState } from '@store/index';
import LoaderSpinner from '@components/admin/LoaderSpinner';
import { toast } from 'react-toastify';
import {
  pageCardClass,
  WhatsAppSectionHeader,
  WhatsAppTabs,
  statusBadgeClass,
} from './WhatsAppShared';
import type { WhatsAppMessageLog } from './WhatsAppShared';

interface StatsData {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  failed: number;
}

const emptyStats: StatsData = {
  total: 0,
  sent: 0,
  delivered: 0,
  read: 0,
  replied: 0,
  failed: 0,
};

const WhatsAppDashboard = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  const [stats, setStats] = useState<StatsData>(emptyStats);
  const [messages, setMessages] = useState<WhatsAppMessageLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const [statsRes, messagesRes] = await Promise.all([
        axios.get(Constants.WHATSAPP_MESSAGE_STATS_URL, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(Constants.WHATSAPP_MESSAGES_URL, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setStats({ ...emptyStats, ...(statsRes.data?.data || {}) });
      setMessages(messagesRes.data?.data || []);
    } catch (error) {
      console.error(error);
      toast.error('Unable to load WhatsApp dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [token]);

  const chartData = useMemo(() => {
    const days: { date: string; label: string; messages: number }[] = [];
    const today = new Date();
    for (let index = 29; index >= 0; index -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - index);
      const key = day.toISOString().slice(0, 10);
      days.push({
        date: key,
        label: day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        messages: 0,
      });
    }

    messages.forEach((message) => {
      const key = new Date(message.createdAt).toISOString().slice(0, 10);
      const found = days.find((entry) => entry.date === key);
      if (found) {
        found.messages += 1;
      }
    });

    return days;
  }, [messages]);

  const documentBreakdown = useMemo(() => {
    return ['invoice', 'exchange', 'quotation'].map((type) => ({
      type,
      count: messages.filter((message) => message.documentType === type).length,
    }));
  }, [messages]);

  const rates = useMemo(() => {
    const total = stats.total || 1;
    return {
      delivered: ((stats.delivered / total) * 100).toFixed(1),
      read: ((stats.read / total) * 100).toFixed(1),
      replied: ((stats.replied / total) * 100).toFixed(1),
    };
  }, [stats]);

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><LoaderSpinner /></div>;
  }

  return (
    <div className="space-y-6">
      <WhatsAppSectionHeader
        title="WhatsApp Dashboard"
        subtitle="Track message activity, delivery quality, and recent customer communication."
      />
      <WhatsAppTabs />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Sent', value: stats.sent, tone: 'text-emerald-700 bg-emerald-50' },
          { label: 'Delivered %', value: `${rates.delivered}%`, tone: 'text-sky-700 bg-sky-50' },
          { label: 'Read %', value: `${rates.read}%`, tone: 'text-indigo-700 bg-indigo-50' },
          { label: 'Reply Rate', value: `${rates.replied}%`, tone: 'text-amber-700 bg-amber-50' },
        ].map((card) => (
          <div key={card.label} className={`${pageCardClass} p-5`}>
            <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${card.tone}`}>{card.label}</div>
            <p className="mt-4 text-3xl font-bold text-gray-950">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className={`${pageCardClass} p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-950">Last 30 Days Activity</h2>
              <p className="text-sm text-gray-500">Message volume across the last 30 calendar days.</p>
            </div>
            <button
              onClick={loadDashboard}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="messages" stroke="#16a34a" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${pageCardClass} p-5`}>
          <h2 className="text-lg font-semibold text-gray-950">Document Breakdown</h2>
          <div className="mt-4 space-y-3">
            {documentBreakdown.map((item) => (
              <div key={item.type} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium capitalize text-gray-700">{item.type}</p>
                  <p className="text-xs text-gray-400">Messages triggered from {item.type} documents</p>
                </div>
                <span className="text-xl font-semibold text-gray-950">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`${pageCardClass} p-5`}>
        <h2 className="text-lg font-semibold text-gray-950">Recent Messages</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Document</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {messages.slice(0, 8).map((message) => (
                <tr key={message._id} className="border-b border-gray-100 text-gray-700">
                  <td className="px-3 py-3">
                    <p className="font-medium text-gray-950">{message.customerName || 'Customer'}</p>
                    <p className="text-xs text-gray-400">{message.customerPhone || 'No phone'}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium capitalize">{message.documentType}</p>
                    <p className="text-xs text-gray-400">{message.documentNumber}</p>
                  </td>
                  <td className="px-3 py-3">Rs {Number(message.amount || 0).toFixed(2)}</td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(message.status)}`}>
                      {message.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">{new Date(message.createdAt).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppDashboard;
