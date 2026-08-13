import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import LoaderSpinner from '@components/admin/LoaderSpinner';
import Constants from '@constants/api';
import type { RootState } from '@store/index';
import { toast } from 'react-toastify';
import { pageCardClass, statusBadgeClass, WhatsAppSectionHeader, WhatsAppTabs } from './WhatsAppShared';
import type { WhatsAppMessageLog } from './WhatsAppShared';

const WhatsAppMessages = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  const [messages, setMessages] = useState<WhatsAppMessageLog[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [documentTypeFilter, setDocumentTypeFilter] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<WhatsAppMessageLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadMessages = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(Constants.WHATSAPP_MESSAGES_URL, {
        params: {
          status: statusFilter || undefined,
          documentType: documentTypeFilter || undefined,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = response.data?.data || [];
      setMessages(list);
      setSelectedMessage((current) => {
        if (!current) return list[0] || null;
        return list.find((message: WhatsAppMessageLog) => message._id === current._id) || list[0] || null;
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to load WhatsApp messages');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [token, statusFilter, documentTypeFilter]);

  const summary = useMemo(() => ({
    failed: messages.filter((item) => item.status === 'failed').length,
    replied: messages.filter((item) => item.status === 'replied').length,
  }), [messages]);

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><LoaderSpinner /></div>;
  }

  return (
    <div className="space-y-6">
      <WhatsAppSectionHeader
        title="WhatsApp Messages"
        subtitle="Review send history, delivery outcomes, replies, and error details."
      />
      <WhatsAppTabs />

      <div className="grid gap-4 md:grid-cols-3">
        <div className={`${pageCardClass} p-5`}>
          <p className="text-sm text-gray-500">Current result set</p>
          <p className="mt-2 text-3xl font-bold text-gray-950">{messages.length}</p>
        </div>
        <div className={`${pageCardClass} p-5`}>
          <p className="text-sm text-gray-500">Failed sends</p>
          <p className="mt-2 text-3xl font-bold text-red-600">{summary.failed}</p>
        </div>
        <div className={`${pageCardClass} p-5`}>
          <p className="text-sm text-gray-500">Replies received</p>
          <p className="mt-2 text-3xl font-bold text-indigo-600">{summary.replied}</p>
        </div>
      </div>

      <div className={`${pageCardClass} p-5`}>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            type="text"
            placeholder="Search customer, phone, doc number"
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            onChange={(event) => {
              const value = event.target.value.toLowerCase();
              if (!value) {
                loadMessages();
                return;
              }
              setMessages((current) =>
                current.filter((message) =>
                  [message.customerName, message.customerPhone, message.documentNumber]
                    .join(' ')
                    .toLowerCase()
                    .includes(value)
                )
              );
            }}
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All statuses</option>
            <option value="queued">Queued</option>
            <option value="sent">Sent</option>
            <option value="delivered">Delivered</option>
            <option value="read">Read</option>
            <option value="replied">Replied</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={documentTypeFilter}
            onChange={(event) => setDocumentTypeFilter(event.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All document types</option>
            <option value="invoice">Invoice</option>
            <option value="exchange">Exchange Invoice</option>
            <option value="quotation">Quotation</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className={`${pageCardClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Document</th>
                  <th className="px-3 py-3">Amount</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((message) => (
                  <tr
                    key={message._id}
                    onClick={() => setSelectedMessage(message)}
                    className={`cursor-pointer border-b border-gray-100 text-gray-700 hover:bg-gray-50 ${selectedMessage?._id === message._id ? 'bg-emerald-50' : ''}`}
                  >
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

        <div className={`${pageCardClass} p-5`}>
          <h2 className="text-lg font-semibold text-gray-950">Message Detail</h2>
          {selectedMessage ? (
            <div className="mt-4 space-y-4 text-sm text-gray-600">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Customer</p>
                <p className="mt-1 font-medium text-gray-950">{selectedMessage.customerName}</p>
                <p>{selectedMessage.customerPhone}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Rendered Message</p>
                <div className="mt-1 whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-gray-800">
                  {selectedMessage.renderedMessage || 'No message body stored'}
                </div>
              </div>
              {selectedMessage.replyText && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Customer Reply</p>
                  <div className="mt-1 whitespace-pre-wrap rounded-xl bg-indigo-50 p-4 text-indigo-900">
                    {selectedMessage.replyText}
                  </div>
                </div>
              )}
              {selectedMessage.errorMessage && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Error</p>
                  <div className="mt-1 rounded-xl bg-red-50 p-4 text-red-700">
                    {selectedMessage.errorMessage}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">Select a message to inspect its details.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppMessages;
