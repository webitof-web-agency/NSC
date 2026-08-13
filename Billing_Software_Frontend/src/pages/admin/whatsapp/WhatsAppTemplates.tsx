import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import SubmitButton from '@components/admin/SubmitButton';
import LoaderSpinner from '@components/admin/LoaderSpinner';
import Constants from '@constants/api';
import type { RootState } from '@store/index';
import {
  defaultTemplates,
  pageCardClass,
  renderTemplatePreview,
  WhatsAppSectionHeader,
  WhatsAppTabs,
} from './WhatsAppShared';
import type { WhatsAppDocumentType, WhatsAppTemplateData } from './WhatsAppShared';

const templateTypes: WhatsAppDocumentType[] = ['invoice', 'exchange', 'quotation'];

const WhatsAppTemplates = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  const [activeType, setActiveType] = useState<WhatsAppDocumentType>('invoice');
  const [templates, setTemplates] = useState<Record<WhatsAppDocumentType, WhatsAppTemplateData>>(defaultTemplates);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(Constants.WHATSAPP_TEMPLATES_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const nextTemplates = { ...defaultTemplates };
      (response.data?.data || []).forEach((template: WhatsAppTemplateData) => {
        nextTemplates[template.type] = { ...nextTemplates[template.type], ...template };
      });
      setTemplates(nextTemplates);
    } catch (error) {
      console.error(error);
      toast.error('Unable to load WhatsApp templates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [token]);

  const currentTemplate = useMemo(() => templates[activeType], [templates, activeType]);

  const updateCurrent = (patch: Partial<WhatsAppTemplateData>) => {
    setTemplates((prev) => ({
      ...prev,
      [activeType]: { ...prev[activeType], ...patch },
    }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await axios.post(Constants.WHATSAPP_TEMPLATES_URL, currentTemplate, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('WhatsApp template saved');
      await loadTemplates();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Unable to save template');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><LoaderSpinner /></div>;
  }

  return (
    <div className="space-y-6">
      <WhatsAppSectionHeader
        title="WhatsApp Templates"
        subtitle="Control the message copy for invoices, exchange invoices, and quotations."
      />
      <WhatsAppTabs />

      <div className="flex flex-wrap gap-2">
        {templateTypes.map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`rounded-xl px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeType === type
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className={`${pageCardClass} p-6`}>
          <div className="grid gap-4">
            <label className="space-y-2 text-sm text-gray-700">
              <span className="font-medium">Header Text</span>
              <input
                type="text"
                value={currentTemplate.headerText}
                onChange={(event) => updateCurrent({ headerText: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            <label className="space-y-2 text-sm text-gray-700">
              <span className="font-medium">Body Text</span>
              <textarea
                rows={8}
                value={currentTemplate.bodyText}
                onChange={(event) => updateCurrent({ bodyText: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
              <p className="font-medium text-gray-900">Available variables</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {['{{customerName}}', '{{documentNumber}}', '{{amount}}', '{{date}}', '{{companyName}}'].map((tokenText) => (
                  <span key={tokenText} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 border border-gray-200">
                    {tokenText}
                  </span>
                ))}
              </div>
            </div>
            <label className="space-y-2 text-sm text-gray-700">
              <span className="font-medium">Footer Text</span>
              <input
                type="text"
                value={currentTemplate.footerText}
                onChange={(event) => updateCurrent({ footerText: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={currentTemplate.includeDocument}
                  onChange={(event) => updateCurrent({ includeDocument: event.target.checked })}
                  className="h-4 w-4"
                />
                Include document PDF
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={currentTemplate.isActive}
                  onChange={(event) => updateCurrent({ isActive: event.target.checked })}
                  className="h-4 w-4"
                />
                Template active
              </label>
            </div>
            <div className="flex justify-end">
              <SubmitButton isDisabled={isSaving} isLoading={isSaving} mode="edit" onClick={handleSave} />
            </div>
          </div>
        </div>

        <div className={`${pageCardClass} p-6`}>
          <h2 className="text-lg font-semibold text-gray-950">Live Preview</h2>
          <p className="mt-1 text-sm text-gray-500">This shows how the WhatsApp message will look with sample data.</p>
          <div className="mt-5 rounded-[28px] bg-[#e7ffdb] p-4 shadow-inner">
            <div className="rounded-2xl bg-white p-4 text-sm leading-6 text-gray-800 shadow-sm whitespace-pre-wrap">
              {renderTemplatePreview(currentTemplate)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppTemplates;
