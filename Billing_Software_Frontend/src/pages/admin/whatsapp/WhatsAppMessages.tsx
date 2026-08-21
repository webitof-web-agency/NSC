import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import LoaderSpinner from '@components/admin/LoaderSpinner';
import Constants from '@constants/api';
import type { RootState } from '@store/index';
import { toast } from 'react-toastify';
import { pageCardClass, statusBadgeClass, WhatsAppSectionHeader, WhatsAppTabs } from './WhatsAppShared';
import type { WhatsAppMessageLog } from './WhatsAppShared';

interface WhatsAppMessageStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  failed: number;
}

const emptyStats: WhatsAppMessageStats = {
  total: 0,
  sent: 0,
  delivered: 0,
  read: 0,
  replied: 0,
  failed: 0,
};

const WhatsAppMessages = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<WhatsAppMessageLog[]>([]);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [documentTypeFilter, setDocumentTypeFilter] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<WhatsAppMessageLog | null>(null);
  const [stats, setStats] = useState<WhatsAppMessageStats>(emptyStats);
  const [isLoading, setIsLoading] = useState(true);

  const loadMessages = useCallback(async () => {
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
  }, [documentTypeFilter, statusFilter, token]);

  const loadStats = useCallback(async () => {
    try {
      const response = await axios.get(Constants.WHATSAPP_MESSAGE_STATS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats({ ...emptyStats, ...(response.data?.data || {}) });
    } catch (error) {
      console.error(error);
      toast.error('Unable to load WhatsApp message totals');
    }
  }, [token]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const applyStatusFilter = (status: string) => {
    setStatusFilter(status);
    const nextParams = new URLSearchParams(searchParams);
    if (status) nextParams.set('status', status);
    else nextParams.delete('status');
    setSearchParams(nextParams, { replace: true });
  };

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className={`${pageCardClass} p-5`}>
          <p className="text-sm text-gray-500">Current result set</p>
          <p className="mt-2 text-3xl font-bold text-gray-950">{messages.length}</p>
        </div>
        <button
          type="button"
          aria-pressed={statusFilter === 'delivered'}
          onClick={() => applyStatusFilter('delivered')}
          className={`${pageCardClass} p-5 text-left transition-colors hover:border-emerald-300 ${statusFilter === 'delivered' ? 'border-emerald-500 ring-2 ring-emerald-100' : ''}`}
        >
          <p className="text-sm text-gray-500">Delivered</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">{stats.delivered}</p>
        </button>
        <button
          type="button"
          aria-pressed={statusFilter === 'read'}
          onClick={() => applyStatusFilter('read')}
          className={`${pageCardClass} p-5 text-left transition-colors hover:border-teal-300 ${statusFilter === 'read' ? 'border-teal-500 ring-2 ring-teal-100' : ''}`}
        >
          <p className="text-sm text-gray-500">Read</p>
          <p className="mt-2 text-3xl font-bold text-teal-700">{stats.read}</p>
        </button>
        <button
          type="button"
          aria-pressed={statusFilter === 'failed'}
          onClick={() => applyStatusFilter('failed')}
          className={`${pageCardClass} p-5 text-left transition-colors hover:border-red-300 ${statusFilter === 'failed' ? 'border-red-500 ring-2 ring-red-100' : ''}`}
        >
          <p className="text-sm text-gray-500">Failed</p>
          <p className="mt-2 text-3xl font-bold text-red-600">{stats.failed}</p>
        </button>
        <button
          type="button"
          aria-pressed={statusFilter === 'replied'}
          onClick={() => applyStatusFilter('replied')}
          className={`${pageCardClass} p-5 text-left transition-colors hover:border-indigo-300 ${statusFilter === 'replied' ? 'border-indigo-500 ring-2 ring-indigo-100' : ''}`}
        >
          <p className="text-sm text-gray-500">Replies</p>
          <p className="mt-2 text-3xl font-bold text-indigo-600">{stats.replied}</p>
        </button>
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
            onChange={(event) => applyStatusFilter(event.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All statuses</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="accepted">Accepted</option>
            <option value="sent">Sent</option>
            <option value="delivered">Delivered</option>
            <option value="read">Read</option>
            <option value="replied">Replied</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
            <option value="delivery_unknown">Delivery Unknown</option>
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
          {/* Sticky header + scrollable body */}
          <div className="max-h-[80vh] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10">
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

              {/* ── WhatsApp bubble preview ── */}
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Rendered Message</p>
                {(() => {
                  const tc = selectedMessage.metadata?.templateComponents;
                  const templateName = selectedMessage.metadata?.templateName;

                  // New-style: metadata has template components
                  if (tc) {
                    return (
                      <div className="rounded-xl bg-[#ece5dd] p-3">
                        <div className="ml-auto max-w-full">
                          {/* Bubble */}
                          <div className="bg-[#dcf8c6] rounded-2xl rounded-tr-sm shadow-sm overflow-hidden">

                            {/* Header */}
                            {tc.headerFormat && (
                              <div className="bg-emerald-600/10 border-b border-emerald-100 px-3 py-2 flex items-center gap-2">
                                {tc.headerFormat === 'IMAGE' && (
                                  <>
                                    <div className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                      <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </div>
                                    <span className="text-xs text-emerald-700 font-medium">Image</span>
                                  </>
                                )}
                                {tc.headerFormat === 'DOCUMENT' && (
                                  <>
                                    <div className="w-6 h-6 rounded bg-red-100 flex items-center justify-center flex-shrink-0">
                                      <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </div>
                                    <span className="text-xs text-gray-700 font-medium">PDF Document</span>
                                  </>
                                )}
                                {tc.headerFormat === 'TEXT' && tc.headerText && (
                                  <span className="text-sm font-bold text-gray-900">{tc.headerText}</span>
                                )}
                              </div>
                            )}

                            {/* Body */}
                            <div className="px-3 py-3">
                              <p className="text-[13px] leading-relaxed text-gray-900 whitespace-pre-wrap">
                                {tc.body || <span className="italic text-gray-400">No body text</span>}
                              </p>
                            </div>

                            {/* Footer */}
                            {tc.footer && (
                              <div className="px-3 pb-1">
                                <p className="text-[11px] text-gray-400">{tc.footer}</p>
                              </div>
                            )}

                            {/* Timestamp */}
                            <div className="px-3 pb-2 flex justify-end items-center gap-1">
                              <span className="text-[10px] text-gray-400">
                                {new Date(selectedMessage.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {selectedMessage.status === 'READ' && <span className="text-[10px] text-[#4fc3f7]">✓✓</span>}
                              {selectedMessage.status === 'DELIVERED' && <span className="text-[10px] text-gray-400">✓✓</span>}
                              {(selectedMessage.status === 'SENT' || selectedMessage.status === 'ACCEPTED') && <span className="text-[10px] text-gray-400">✓</span>}
                            </div>
                          </div>

                          {/* Buttons */}
                          {tc.buttons && tc.buttons.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {tc.buttons.map((btn, i) => (
                                <div key={i} className="bg-white rounded-xl py-1.5 px-3 text-center text-[12px] font-medium text-[#00a884] shadow-sm">
                                  {btn.text || (btn.type === 'URL' ? '🔗 Open Link' : btn.type === 'PHONE_NUMBER' ? '📞 Call' : btn.type)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Template name badge */}
                        {templateName && (
                          <div className="text-center mt-2">
                            <span className="inline-block bg-white/70 text-gray-400 text-[10px] px-2 py-0.5 rounded-full">{templateName}</span>
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Legacy: plain text fallback for old log entries
                  return (
                    <div className="whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-gray-800 text-[13px]">
                      {selectedMessage.renderedMessage || 'No message body stored'}
                    </div>
                  );
                })()}
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
