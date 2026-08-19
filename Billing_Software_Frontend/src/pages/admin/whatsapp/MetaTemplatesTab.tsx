import { useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import LoaderSpinner from '@components/admin/LoaderSpinner';
import Constants from '@constants/api';
import type { RootState } from '@store/index';
import { pageCardClass } from './WhatsAppShared';

export interface MetaTemplate {
  _id: string;
  metaId: string;
  name: string;
  language: string;
  category: string;
  status: string;
  qualityScore: string;
  rejectionReason?: string;
  components: any[];
}

const MetaTemplatesTab = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${Constants.BASE_URL}/api/admin/whatsapp/meta-templates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTemplates(response.data?.data || []);
    } catch (error) {
      console.error(error);
      toast.error('Unable to load Meta templates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [token]);

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      await axios.post(`${Constants.BASE_URL}/api/admin/whatsapp/meta-templates/sync`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Successfully synced templates from Meta');
      await loadTemplates();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-emerald-100 text-emerald-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      case 'PAUSED': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-12"><LoaderSpinner /></div>;
  }

  return (
    <div className={`${pageCardClass} p-6`}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Synced Meta Templates</h2>
          <p className="text-sm text-gray-500">Templates available in your WhatsApp Business Account.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            {isSyncing ? 'Syncing...' : 'Sync from Meta'}
          </button>
          <button
            onClick={() => {
              const url = 'https://business.facebook.com/latest/whatsapp_manager/message_templates/?business_id=1145936193778918&tab=message-templates&filters=%7B%22date_range%22%3A7%2C%22language%22%3A[]%2C%22quality%22%3A[]%2C%22search_text%22%3A%22%22%2C%22status%22%3A[%22APPROVED%22%2C%22IN_APPEAL%22%2C%22PAUSED%22%2C%22PENDING%22%2C%22REJECTED%22]%2C%22tag%22%3A[]%7D&nav_ref=whatsapp_manager&asset_id=1405743491510453';
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Create Template
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-xs uppercase text-gray-700">
            <tr>
              <th className="px-4 py-3">Template Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Language</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Quality</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {templates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No templates found. Click "Sync from Meta" to load them.
                </td>
              </tr>
            ) : (
              templates.map((tmpl) => (
                <tr key={tmpl._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{tmpl.name}</td>
                  <td className="px-4 py-3 capitalize">{tmpl.category.toLowerCase()}</td>
                  <td className="px-4 py-3">{tmpl.language}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(tmpl.status)}`}>
                      {tmpl.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{tmpl.qualityScore}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MetaTemplatesTab;
