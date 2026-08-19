import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import Constants from '@constants/api';
import { Download, Instagram, ShoppingBag, CheckCircle2 } from 'lucide-react';

interface PublicInvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  status: string;
  totalAmount: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  roundOff: number;
  customer: {
    name: string;
    phone: string;
    address: string;
    state: string;
    gstNumber: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    rate: number;
    amount: number;
    discount: number;
    taxAmount: number;
    hsnCode: string;
  }>;
  business: {
    name: string;
    logo: string;
    phone: string;
    email: string;
    address: string;
    state: string;
    gstNumber: string;
    instagram: string;
    website: string;
  };
}

const PublicInvoice = () => {
  const { publicShareId } = useParams<{ publicShareId: string }>();
  const [invoice, setInvoice] = useState<PublicInvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchPublicInvoice = async () => {
      try {
        const res = await axios.get(`${Constants.BASE_URL}/api/public/invoices/${publicShareId}`);
        if (res.data.success) {
          setInvoice(res.data.data);
        } else {
          setError(true);
        }
      } catch (err) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    if (publicShareId) {
      fetchPublicInvoice();
    }
  }, [publicShareId]);

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      const res = await axios.get(`${Constants.BASE_URL}/api/public/invoices/${publicShareId}/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invoice-${invoice?.invoiceNumber || 'Download'}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("Failed to download PDF");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
          <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingBag size={24} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invoice Not Found</h2>
          <p className="text-gray-500 mb-6">The invoice you are looking for does not exist or the link has expired.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (invoice) {
      document.title = `Invoice ${invoice.invoiceNumber} - ${invoice.business.name}`;
      // Set a generic meta noindex in case the server header is missed by any crawler (defense in depth)
      let meta = document.querySelector('meta[name="robots"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'robots');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', 'noindex,nofollow');
    }
  }, [invoice]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 font-sans text-gray-900 pb-24">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Header / Thank You Card */}
        <div className="bg-white rounded-3xl p-6 text-center shadow-sm border border-gray-100">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h1 className="text-2xl font-bold mb-1">Thank You!</h1>
          <p className="text-gray-500 text-sm">Thank you for shopping with</p>
          <p className="font-semibold text-gray-900">{invoice.business.name}</p>
        </div>

        {/* Invoice Details Card */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-8">
            <div>
              <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1">Invoice Amount</p>
              <p className="text-3xl font-bold text-emerald-600">{formatCurrency(invoice.totalAmount)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1">Invoice No</p>
              <p className="font-medium">{invoice.invoiceNumber}</p>
              <p className="text-sm text-gray-500">{new Date(invoice.date).toLocaleDateString('en-IN')}</p>
            </div>
          </div>

          <div className="mb-8 p-4 bg-gray-50 rounded-2xl">
            <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-2">Billed To</p>
            <p className="font-semibold">{invoice.customer.name}</p>
            {invoice.customer.phone && <p className="text-sm text-gray-600">{invoice.customer.phone}</p>}
          </div>

          <div className="space-y-4 mb-8">
            <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Order Items</p>
            <div className="space-y-3">
              {invoice.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="flex-1 pr-4">
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.quantity} x {formatCurrency(item.rate)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">{formatCurrency(item.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.taxAmount > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <span>{formatCurrency(invoice.taxAmount)}</span>
              </div>
            )}
            {invoice.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span>-{formatCurrency(invoice.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 mt-2 border-t border-gray-100">
              <span>Total</span>
              <span>{formatCurrency(invoice.totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white p-4 rounded-2xl font-medium transition-colors disabled:opacity-70"
          >
            {downloading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Download size={20} />
            )}
            Download PDF
          </button>
          
          {invoice.business.website && (
            <a
              href={invoice.business.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 p-4 rounded-2xl font-medium transition-colors"
            >
              <ShoppingBag size={20} />
              Shop Online
            </a>
          )}
        </div>

        {invoice.business.instagram && (
          <a
            href={invoice.business.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-pink-600 p-4 rounded-2xl font-medium transition-colors"
          >
            <Instagram size={20} />
            Follow us on Instagram
          </a>
        )}

      </div>
    </div>
  );
};

export default PublicInvoice;
