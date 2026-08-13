import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import Constants from '@constants/api';
import type { RootState } from '@store/index';
import LoaderSpinner from '@components/admin/LoaderSpinner';
import { toast } from 'react-toastify';
import {
  pageCardClass,
  statusBadgeClass,
  WhatsAppSectionHeader,
  WhatsAppTabs,
} from './WhatsAppShared';
import type { WhatsAppMessageLog } from './WhatsAppShared';

interface AnalyticsPageProps {
  title: string;
  subtitle: string;
  focusStatus: 'delivered' | 'read' | 'replied';
  metricLabel: string;
}

const statusDateKeyMap = {
  delivered: 'deliveredAt',
  read: 'readAt',
  replied: 'repliedAt',
} as const;

const WhatsAppAnalyticsPage = ({ title, subtitle, focusStatus, metricLabel }: AnalyticsPageProps) => {
  const { token } = useSelector((state: RootState) => state.auth);
  const [messages, setMessages] = useState<WhatsAppMessageLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMessages = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(Constants.WHATSAPP_MESSAGES_URL, {
        params: { status: focusStatus },
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(response.data?.data || []);
    } catch (error) {
      console.error(error);
      toast.error(`Unable to load ${title.toLowerCase()} data`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [token, focusStatus]);

  const summary = useMemo(() => {
    const total = messages.length;
    const invoiceCount = messages.filter((message) => message.documentType === 'invoice').length;
    const exchangeCount = messages.filter((message) => message.documentType === 'exchange').length;
    const quotationCount = messages.filter((message) => message.documentType === 'quotation').length;
    return { total, invoiceCount, exchangeCount, quotationCount };
  }, [messages]);

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><LoaderSpinner /></div>;
  }

  const dateKey = statusDateKeyMap[focusStatus];

  return (
    <div className="space-y-6">
      <WhatsAppSectionHeader title={title} subtitle={subtitle} />
      <WhatsAppTabs />

      <div className="grid gap-4 md:grid-cols-4">
        <div className={`${pageCardClass} p-5`}>
          <p className="text-sm text-gray-500">{metricLabel}</p>
          <p className="mt-2 text-3xl font-bold text-gray-950">{summary.total}</p>
        </div>
        <div className={`${pageCardClass} p-5`}>
          <p className="text-sm text-gray-500">Invoices</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">{summary.invoiceCount}</p>
        </div>
        <div className={`${pageCardClass} p-5`}>
          <p className="text-sm text-gray-500">Exchange</p>
          <p className="mt-2 text-3xl font-bold text-sky-700">{summary.exchangeCount}</p>
        </div>
        <div className={`${pageCardClass} p-5`}>
          <p className="text-sm text-gray-500">Quotations</p>
          <p className="mt-2 text-3xl font-bold text-indigo-700">{summary.quotationCount}</p>
        </div>
      </div>

      <div className={`${pageCardClass} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Document</th>
                <th className="px-3 py-3">Amount</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Event Time</th>
                <th className="px-3 py-3">Reply</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((message) => (
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
                  <td className="px-3 py-3">
                    {message[dateKey] ? new Date(message[dateKey] as string).toLocaleString('en-IN') : '-'}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">{message.replyText || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppAnalyticsPage;
