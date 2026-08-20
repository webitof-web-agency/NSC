import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { UploadCloud } from 'lucide-react';
import SubmitButton from '@components/admin/SubmitButton';
import LoaderSpinner from '@components/admin/LoaderSpinner';
import Constants from '@constants/api';
import type { RootState } from '@store/index';
import { pageCardClass } from './WhatsAppShared';
import type { MetaTemplate } from './MetaTemplatesTab';

const assignmentTypes = ['INVOICE', 'QUOTATION', 'EXCHANGE', 'TEST_MESSAGE', 'ADVERTISEMENT', 'PAYMENT_REMINDER'];

interface TemplateVariableMapping {
  component: 'BODY' | 'HEADER' | 'BUTTONS';
  parameterIndex: number;
  sourceType: 'VARIABLE' | 'FIXED';
  sourceValue: string;
  buttonIndex?: number;
}

const availableVariables: Record<string, { label: string, value: string }[]> = {
  INVOICE: [
    { label: 'Customer Name', value: 'customerName' },
    { label: 'Customer Phone', value: 'customerPhone' },
    { label: 'Invoice Number', value: 'documentNumber' },
    { label: 'Invoice Amount', value: 'amount' },
    { label: 'Invoice Date', value: 'date' },
    { label: 'Company Name', value: 'companyName' },
    { label: 'Invoice Public Share ID', value: 'publicShareId' },
  ],
  QUOTATION: [
    { label: 'Customer Name', value: 'customerName' },
    { label: 'Quotation Number', value: 'documentNumber' },
    { label: 'Amount', value: 'amount' },
    { label: 'Date', value: 'date' },
    { label: 'Company Name', value: 'companyName' },
  ],
  EXCHANGE: [
    { label: 'Customer Name', value: 'customerName' },
    { label: 'Exchange Number', value: 'documentNumber' },
    { label: 'Amount', value: 'amount' },
    { label: 'Date', value: 'date' },
    { label: 'Company Name', value: 'companyName' },
  ],
  TEST_MESSAGE: [
    { label: 'Company Name', value: 'companyName' },
  ],
  ADVERTISEMENT: [
    { label: 'Customer Name', value: 'customerName' },
    { label: 'Company Name', value: 'companyName' },
  ],
  PAYMENT_REMINDER: [
    { label: 'Customer Name', value: 'customerName' },
    { label: 'Invoice Number', value: 'documentNumber' },
    { label: 'Pending Amount', value: 'amount' },
    { label: 'Company Name', value: 'companyName' },
  ]
};

const AssignmentsTab = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  const [activeType, setActiveType] = useState(assignmentTypes[0]);
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([]);
  const [assignment, setAssignment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [headerImagePreview, setHeaderImagePreview] = useState<string | null>(null);
  const [headerImageFile, setHeaderImageFile] = useState<File | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [metaRes, assignRes] = await Promise.all([
        axios.get(`${Constants.BASE_URL}/api/admin/whatsapp/meta-templates`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${Constants.BASE_URL}/api/admin/whatsapp/template-assignments/${activeType}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setMetaTemplates(metaRes.data?.data || []);
      setAssignment(assignRes.data?.data || { isEnabled: true, variableMappings: [], headerMapping: { sourceType: 'NONE' } });
      setHeaderImagePreview(assignRes.data?.data?.headerMapping?.value || null);
      setHeaderImageFile(null);
    } catch (error) {
      toast.error('Failed to load assignments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeType, token]);

  const approvedTemplates = metaTemplates.filter(t => t.status === 'APPROVED');
  const varsForType = availableVariables[activeType] || [];

  const handleTemplateChange = (templateId: string) => {
    const tmpl = approvedTemplates.find(t => t._id === templateId);
    if (!tmpl) return;

    const bodyComponent = tmpl.components.find(c => c.type === 'BODY');
    const headerComponent = tmpl.components.find(c => c.type === 'HEADER');
    const buttonsComponent = tmpl.components.find(c => c.type === 'BUTTONS');

    let requiredVarsCount = 0;
    if (bodyComponent && bodyComponent.text) {
      const matches = bodyComponent.text.match(/\{\{(\d+)\}\}/g);
      if (matches) requiredVarsCount = matches.length;
    }

    const newMappings: TemplateVariableMapping[] = Array.from({ length: requiredVarsCount }).map((_, i) => ({
      component: 'BODY',
      parameterIndex: i + 1,
      sourceType: 'VARIABLE',
      sourceValue: varsForType[0]?.value || '',
    }));

    if (buttonsComponent && buttonsComponent.buttons) {
      buttonsComponent.buttons.forEach((btn: { type?: string; url?: string }, idx: number) => {
        if (btn.type === 'URL' && btn.url && btn.url.includes('{{1}}')) {
          newMappings.push({
            component: 'BUTTONS',
            parameterIndex: 1,
            sourceType: 'VARIABLE',
            sourceValue: 'publicShareId',
            buttonIndex: idx
          });
        }
      });
    }

    setAssignment({
      ...assignment,
      metaTemplateId: tmpl._id,
      metaTemplateName: tmpl.name,
      languageCode: tmpl.language,
      headerMapping: {
        sourceType: headerComponent?.format === 'DOCUMENT' ? 'DOCUMENT_PDF' : (headerComponent?.format === 'IMAGE' ? 'IMAGE_URL' : 'NONE'),
        value: ''
      },
      variableMappings: newMappings,
    });
  };

  const handleSave = async () => {
    if (!assignment?.metaTemplateId) {
      toast.error('Please select a template');
      return;
    }

    const invalidMapping = assignment.variableMappings?.find((m: any) => !m.sourceValue);
    if (invalidMapping) {
      toast.error('Please map all variables before saving');
      return;
    }

    try {
      setIsSaving(true);
      
      const formData = new FormData();
      formData.append('isEnabled', assignment.isEnabled);
      formData.append('metaTemplateId', typeof assignment.metaTemplateId === 'object' ? assignment.metaTemplateId._id : assignment.metaTemplateId);
      formData.append('metaTemplateName', assignment.metaTemplateName || '');
      formData.append('languageCode', assignment.languageCode || 'en');
      formData.append('headerMapping', JSON.stringify(assignment.headerMapping || {}));
      formData.append('variableMappings', JSON.stringify(assignment.variableMappings || []));
      
      if (headerImageFile) {
        formData.append('headerImage', headerImageFile);
      }

      await axios.put(`${Constants.BASE_URL}/api/admin/whatsapp/template-assignments/${activeType}`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success('Assignment saved successfully');
    } catch (error) {
      toast.error('Failed to save assignment');
    } finally {
      setIsSaving(false);
    }
  };

  const updateVariableMapping = (index: number, value: string) => {
    const newMappings = [...assignment.variableMappings];
    newMappings[index].sourceValue = value;
    setAssignment({ ...assignment, variableMappings: newMappings });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, JPEG, PNG, or WEBP files are allowed');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setHeaderImagePreview(reader.result as string);
      setHeaderImageFile(file);
      setAssignment((prev: any) => ({
        ...prev,
        headerMapping: { ...prev.headerMapping, sourceType: 'IMAGE_URL' }
      }));
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) return <div className="flex justify-center p-12"><LoaderSpinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {assignmentTypes.map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              activeType === type
                ? 'bg-emerald-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {type.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className={`${pageCardClass} p-6 max-w-3xl`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">{activeType.replace('_', ' ')} Assignment</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-600 font-medium">Enable</span>
            <input
              type="checkbox"
              checked={assignment?.isEnabled || false}
              onChange={e => setAssignment({...assignment, isEnabled: e.target.checked})}
              className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
            />
          </label>
        </div>

        <div className="space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 block mb-1">Select Meta Template</span>
            <select
              value={(typeof assignment?.metaTemplateId === "object" ? assignment?.metaTemplateId?._id : assignment?.metaTemplateId) || ""}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="" disabled>Select an approved template</option>
              {approvedTemplates.map(t => (
                <option key={t._id} value={t._id}>{t.name} ({t.language})</option>
              ))}
            </select>
          </label>

          {assignment?.metaTemplateId && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
              <h3 className="font-medium text-sm text-gray-800">Variable Mappings</h3>

              {assignment.headerMapping?.sourceType === 'DOCUMENT_PDF' && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">HEADER MAPPING</p>
                  <div className="flex items-center justify-between bg-white p-3 rounded border border-gray-100 text-sm">
                    <span className="font-medium text-gray-600">Header Document</span>
                    <span className="text-gray-900 bg-gray-100 px-3 py-1 rounded">Generated {activeType.replace('_', ' ').toLowerCase()} PDF</span>
                  </div>
                </div>
              )}

              {approvedTemplates.find(t => t._id === (typeof assignment?.metaTemplateId === "object" ? assignment?.metaTemplateId?._id : assignment?.metaTemplateId))?.components?.find((c: any) => c.type === 'HEADER')?.format === 'IMAGE' && assignment.headerMapping?.sourceType !== 'DOCUMENT_PDF' && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">HEADER MAPPING</p>
                  <div className="bg-white p-4 rounded border border-gray-100 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h3 className="font-semibold text-gray-950 text-sm">Header Image</h3>
                        <p className="text-xs text-gray-500 font-medium mt-1">Upload a custom image. If empty, your Company Logo will be used.</p>
                    </div>
                    {headerImagePreview ? (
                        <img src={headerImagePreview} alt="Header Preview" className="w-32 h-auto rounded-md object-contain max-h-32 bg-gray-50 border border-gray-200" />
                    ) : (
                        <div className="relative w-32 h-24 bg-gray-50 rounded-md border border-gray-200 flex items-center justify-center overflow-hidden">
                            <img src="/image/1787201065746-962894716.png" alt="Default Company Logo" className="w-full h-full object-contain opacity-60" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/5">
                                <span className="text-gray-600 text-[10px] font-bold text-center uppercase tracking-wide bg-white/80 px-2 py-1 rounded shadow-sm">Default</span>
                            </div>
                        </div>
                    )}
                    <div className="text-right">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            type="button" 
                            className="inline-flex items-center justify-center px-4 py-2 bg-emerald-600 text-white font-semibold text-sm rounded-md shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors"
                        >
                            <UploadCloud size={16} className="mr-2" />
                            Change Photo
                        </button>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} />
                  </div>
                </div>
              )}

              {assignment.variableMappings?.filter((m: any) => m.component === 'BODY').length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">BODY MAPPINGS</p>
                  <div className="space-y-2">
                    {assignment.variableMappings.map((mapping: any, i: number) => mapping.component === 'BODY' && (
                      <div key={i} className="flex items-center justify-between bg-white p-3 rounded border border-gray-100">
                        <span className="text-sm font-mono text-gray-600 w-16">{`{{${mapping.parameterIndex}}}`}</span>
                        <span className="mx-2 text-gray-400">→</span>
                        <select
                          value={mapping.sourceValue}
                          onChange={(e) => updateVariableMapping(i, e.target.value)}
                          className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm"
                        >
                          <option value="" disabled>Select variable</option>
                          {varsForType.map(v => (
                            <option key={v.value} value={v.value}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {assignment.variableMappings?.filter((m: any) => m.component === 'BUTTONS').length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">BUTTON MAPPINGS</p>
                  <div className="space-y-2">
                    {assignment.variableMappings.map((mapping: any, i: number) => mapping.component === 'BUTTONS' && (
                      <div key={i} className="flex items-center justify-between bg-white p-3 rounded border border-gray-100">
                        <span className="text-sm font-mono text-gray-600 w-32">URL Button {mapping.buttonIndex !== undefined ? `[${mapping.buttonIndex}]` : ''}</span>
                        <span className="text-sm font-mono text-gray-600 w-16 text-center">{`{{${mapping.parameterIndex}}}`}</span>
                        <span className="mx-2 text-gray-400">→</span>
                        <select
                          value={mapping.sourceValue}
                          onChange={(e) => updateVariableMapping(i, e.target.value)}
                          className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm"
                        >
                          <option value="" disabled>Select variable</option>
                          {varsForType.map(v => (
                            <option key={v.value} value={v.value}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!assignment.variableMappings || assignment.variableMappings.length === 0) && assignment.headerMapping?.sourceType !== 'DOCUMENT_PDF' && approvedTemplates.find(t => t._id === (typeof assignment?.metaTemplateId === "object" ? assignment?.metaTemplateId?._id : assignment?.metaTemplateId))?.components?.find((c: any) => c.type === 'HEADER')?.format !== 'IMAGE' && (
                <p className="text-sm text-gray-500">This template does not require any variables.</p>
              )}
            </div>
          )}

          <div className="flex justify-end pt-4">
            <SubmitButton onClick={handleSave} isLoading={isSaving} isDisabled={!assignment?.metaTemplateId}>
              Save Assignment
            </SubmitButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignmentsTab;
