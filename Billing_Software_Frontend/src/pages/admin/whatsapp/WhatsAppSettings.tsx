import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import SubmitButton from '@components/admin/SubmitButton';
import LoaderSpinner from '@components/admin/LoaderSpinner';
import Constants from '@constants/api';
import type { RootState } from '@store/index';
import { pageCardClass, WhatsAppSectionHeader, WhatsAppTabs } from './WhatsAppShared';
import type { WhatsAppSettingsData } from './WhatsAppShared';

const initialSettings: WhatsAppSettingsData = {
  isEnabled: false,
  accessToken: '',
  phoneNumberId: '',
  businessAccountId: '',
  webhookVerifyToken: '',
  apiVersion: 'v18.0',
  autoSendOnInvoice: true,
  autoSendOnExchange: true,
  autoSendOnQuotation: true,
  testRecipientPhone: '',
};

const WhatsAppSettings = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  const [settings, setSettings] = useState<WhatsAppSettingsData>(initialSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(Constants.WHATSAPP_SETTINGS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSettings({ ...initialSettings, ...(response.data?.data || {}) });
    } catch (error) {
      console.error(error);
      toast.error('Unable to load WhatsApp settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [token]);

  const handleToggle = (field: keyof WhatsAppSettingsData) => {
    setSettings((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setIsSaving(true);
      await axios.post(Constants.WHATSAPP_SETTINGS_URL, settings, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('WhatsApp settings saved');
      await loadSettings();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Unable to save WhatsApp settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestSend = async () => {
    try {
      setIsTesting(true);
      await axios.post(
        Constants.WHATSAPP_TEST_SEND_URL,
        { phone: settings.testRecipientPhone },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Test message sent successfully');
      await loadSettings();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Test send failed');
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><LoaderSpinner /></div>;
  }

  return (
    <div className="space-y-6">
      <WhatsAppSectionHeader
        title="WhatsApp Settings"
        subtitle="Store API credentials, control auto-send behavior, and validate the connection."
      />
      <WhatsAppTabs />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className={`${pageCardClass} p-6`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-950">Connection Control</h2>
              <p className="text-sm text-gray-500">Enable or disable WhatsApp sending globally for this account.</p>
            </div>
            <label className="inline-flex items-center gap-3 rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={settings.isEnabled}
                onChange={() => handleToggle('isEnabled')}
              />
              Enable WhatsApp
            </label>
          </div>
          <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            <span className="font-medium text-gray-900">Current state:</span>{' '}
            {settings.isConfigured ? 'Credentials complete and ready for testing.' : 'Credentials are incomplete. Save them before sending.'}
          </div>
        </div>

        <div className={`${pageCardClass} p-6`}>
          <h2 className="text-lg font-semibold text-gray-950">Meta Cloud API Credentials</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-gray-700">
              <span className="font-medium">Access Token</span>
              <input
                type="password"
                value={settings.accessToken}
                onChange={(event) => setSettings((prev) => ({ ...prev, accessToken: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="EAA..."
              />
            </label>
            <label className="space-y-2 text-sm text-gray-700">
              <span className="font-medium">Phone Number ID</span>
              <input
                type="text"
                value={settings.phoneNumberId}
                onChange={(event) => setSettings((prev) => ({ ...prev, phoneNumberId: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-700">
              <span className="font-medium">Business Account ID</span>
              <input
                type="text"
                value={settings.businessAccountId}
                onChange={(event) => setSettings((prev) => ({ ...prev, businessAccountId: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-700">
              <span className="font-medium">Webhook Verify Token</span>
              <input
                type="text"
                value={settings.webhookVerifyToken}
                onChange={(event) => setSettings((prev) => ({ ...prev, webhookVerifyToken: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-700 md:max-w-xs">
              <span className="font-medium">API Version</span>
              <input
                type="text"
                value={settings.apiVersion}
                onChange={(event) => setSettings((prev) => ({ ...prev, apiVersion: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
          </div>
        </div>

        <div className={`${pageCardClass} p-6`}>
          <h2 className="text-lg font-semibold text-gray-950">Auto-Send Rules</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              { key: 'autoSendOnInvoice', label: 'Send on new invoice' },
              { key: 'autoSendOnExchange', label: 'Send on exchange invoice' },
              { key: 'autoSendOnQuotation', label: 'Send on quotation' },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={Boolean(settings[item.key as keyof WhatsAppSettingsData])}
                  onChange={() => handleToggle(item.key as keyof WhatsAppSettingsData)}
                />
                <span className="font-medium">{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className={`${pageCardClass} p-6`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="grid w-full gap-4 md:max-w-xl">
              <label className="space-y-2 text-sm text-gray-700">
                <span className="font-medium">Test Recipient Phone</span>
                <input
                  type="text"
                  value={settings.testRecipientPhone || ''}
                  onChange={(event) => setSettings((prev) => ({ ...prev, testRecipientPhone: event.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="+919876543210"
                />
              </label>
              <p className="text-xs text-gray-500">Use full international format if available. Example: +919876543210</p>
            </div>
            <button
              type="button"
              onClick={handleTestSend}
              disabled={isTesting}
              className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isTesting ? 'Sending Test...' : 'Send Test Message'}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <SubmitButton isDisabled={isSaving} isLoading={isSaving} mode="edit" />
        </div>
      </form>
    </div>
  );
};

export default WhatsAppSettings;
