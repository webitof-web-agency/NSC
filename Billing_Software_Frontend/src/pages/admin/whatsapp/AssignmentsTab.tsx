import { useCallback, useEffect, useState, useRef } from 'react';
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

const assignmentTypes = ['INVOICE', 'QUOTATION', 'EXCHANGE', 'TEST_MESSAGE', 'PAYMENT_REMINDER'];

interface TemplateVariableMapping {
  component: 'BODY' | 'HEADER' | 'BUTTONS';
  parameterIndex: number;
  sourceType: 'VARIABLE' | 'FIXED';
  sourceValue: string;
  buttonIndex?: number;
}

interface MetaTemplateButton {
  type?: string;
  url?: string;
}

interface MetaTemplateComponent {
  type?: string;
  format?: string;
  text?: string;
  buttons?: MetaTemplateButton[];
}

interface TemplateAssignment {
  isEnabled: boolean;
  metaTemplateId?: string | { _id: string };
  metaTemplateName?: string;
  languageCode?: string;
  headerMapping: {
    sourceType: string;
    value?: string;
  };
  variableMappings: TemplateVariableMapping[];
}

const getTemplateComponents = (template?: MetaTemplate): MetaTemplateComponent[] => (
  (template?.components || []) as MetaTemplateComponent[]
);

const getTemplateId = (assignment?: TemplateAssignment | null) => (
  typeof assignment?.metaTemplateId === 'object'
    ? assignment.metaTemplateId._id
    : assignment?.metaTemplateId || ''
);

interface MappingSource {
  label: string;
  value: string;
}

const bodyVariables: Record<string, MappingSource[]> = {
  INVOICE: [
    { label: 'Customer Name', value: 'customerName' },
    { label: 'Customer Phone', value: 'customerPhone' },
    { label: 'Invoice Number', value: 'documentNumber' },
    { label: 'Invoice Amount', value: 'amount' },
    { label: 'Invoice Date', value: 'date' },
    { label: 'Company Name', value: 'companyName' },
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
    { label: 'Invoice Number', value: 'documentNumber' },
    { label: 'Amount', value: 'amount' },
    { label: 'Date', value: 'date' },
    { label: 'Company Name', value: 'companyName' },
  ],
  TEST_MESSAGE: [
    { label: 'Company Name', value: 'companyName' },
  ],
  PAYMENT_REMINDER: [
    { label: 'Customer Name', value: 'customerName' },
    { label: 'Invoice Number', value: 'documentNumber' },
    { label: 'Pending Amount', value: 'amount' },
    { label: 'Company Name', value: 'companyName' },
  ]
};

const buttonVariables: Record<string, MappingSource[]> = {
  INVOICE: [{ label: 'Invoice Public Share ID', value: 'publicShareId' }],
  QUOTATION: [{ label: 'Quotation Public Share ID', value: 'quotationPublicShareId' }],
  EXCHANGE: [{ label: 'Exchange Public Share ID', value: 'exchangePublicShareId' }],
};

const getPlaceholderIndexes = (text?: string) => Array.from(
  new Set(Array.from(String(text || '').matchAll(/\{\{(\d+)\}\}/g), (match) => Number(match[1]))),
).sort((left, right) => left - right);

const normalizeLoadedMappings = (
  messageType: string,
  mappings: TemplateVariableMapping[] = [],
) => mappings.map((mapping) => {
  if (mapping.component !== 'BUTTONS' || mapping.sourceValue !== 'publicShareId') return mapping;
  if (messageType === 'QUOTATION') return { ...mapping, sourceValue: 'quotationPublicShareId' };
  if (messageType === 'EXCHANGE') return { ...mapping, sourceValue: 'exchangePublicShareId' };
  return mapping;
});

const getAssignmentMappingError = (
  messageType: string,
  template: MetaTemplate | undefined,
  mappings: TemplateVariableMapping[] = [],
) => {
  if (!template) return 'Please select an approved Meta template';

  const allowedBodySources = new Set((bodyVariables[messageType] || []).map((source) => source.value));
  const requiredButtonSource = buttonVariables[messageType]?.[0];
  const templateComponents = getTemplateComponents(template);
  const bodyComponent = templateComponents.find((component) => component.type === 'BODY');

  for (const parameterIndex of getPlaceholderIndexes(bodyComponent?.text)) {
    const mapping = mappings.find((candidate) => (
      candidate.component === 'BODY' && candidate.parameterIndex === parameterIndex
    ));
    if (!mapping?.sourceValue) return `BODY {{${parameterIndex}}} requires a mapping before saving.`;
    if (mapping.sourceType === 'VARIABLE' && !allowedBodySources.has(mapping.sourceValue)) {
      return `BODY {{${parameterIndex}}} has an invalid ${messageType} data source.`;
    }
  }

  const buttonsComponent = templateComponents.find((component) => component.type === 'BUTTONS');
  for (const [buttonIndex, button] of (buttonsComponent?.buttons || []).entries()) {
    if (button.type !== 'URL') continue;
    for (const parameterIndex of getPlaceholderIndexes(button.url)) {
      const mapping = mappings.find((candidate) => (
        candidate.component === 'BUTTONS'
        && candidate.parameterIndex === parameterIndex
        && Number(candidate.buttonIndex || 0) === buttonIndex
      ));
      if (
        !mapping
        || mapping.sourceType !== 'VARIABLE'
        || mapping.sourceValue !== requiredButtonSource?.value
      ) {
        return `URL button {{${parameterIndex}}} must map to ${requiredButtonSource?.label || 'a valid public share ID'}.`;
      }
    }
  }

  return null;
};

const AssignmentsTab = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  const [activeType, setActiveType] = useState(assignmentTypes[0]);
  const [metaTemplates, setMetaTemplates] = useState<MetaTemplate[]>([]);
  const [assignment, setAssignment] = useState<TemplateAssignment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [headerImagePreview, setHeaderImagePreview] = useState<string | null>(null);
  const [headerImageFile, setHeaderImageFile] = useState<File | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [metaRes, assignRes] = await Promise.all([
        axios.get(`${Constants.BASE_URL}/api/admin/whatsapp/meta-templates`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${Constants.BASE_URL}/api/admin/whatsapp/template-assignments/${activeType}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setMetaTemplates(metaRes.data?.data || []);
      const loadedAssignment = assignRes.data?.data as TemplateAssignment | null;
      setAssignment(loadedAssignment
        ? {
            ...loadedAssignment,
            variableMappings: normalizeLoadedMappings(activeType, loadedAssignment.variableMappings),
          }
        : { isEnabled: true, variableMappings: [], headerMapping: { sourceType: 'NONE' } });
      setHeaderImagePreview(assignRes.data?.data?.headerMapping?.value || null);
      setHeaderImageFile(null);
    } catch {
      toast.error('Failed to load assignments');
    } finally {
      setIsLoading(false);
    }
  }, [activeType, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const approvedTemplates = metaTemplates.filter(t => t.status === 'APPROVED');
  const bodyVariablesForType = bodyVariables[activeType] || [];
  const buttonVariablesForType = buttonVariables[activeType] || [];
  const selectedTemplate = approvedTemplates.find((template) => template._id === getTemplateId(assignment));
  const selectedHeaderComponent = getTemplateComponents(selectedTemplate)
    .find((component) => component.type === 'HEADER');

  const handleTemplateChange = (templateId: string) => {
    const tmpl = approvedTemplates.find(t => t._id === templateId);
    if (!tmpl) return;

    const templateComponents = getTemplateComponents(tmpl);
    const bodyComponent = templateComponents.find((component) => component.type === 'BODY');
    const headerComponent = templateComponents.find((component) => component.type === 'HEADER');
    const buttonsComponent = templateComponents.find((component) => component.type === 'BUTTONS');

    const newMappings: TemplateVariableMapping[] = getPlaceholderIndexes(bodyComponent?.text).map((parameterIndex) => ({
      component: 'BODY',
      parameterIndex,
      sourceType: 'VARIABLE',
      sourceValue: '',
    }));

    if (buttonsComponent && buttonsComponent.buttons) {
      buttonsComponent.buttons.forEach((btn, idx) => {
        if (btn.type === 'URL') {
          getPlaceholderIndexes(btn.url).forEach((parameterIndex) => {
          newMappings.push({
            component: 'BUTTONS',
            parameterIndex,
            sourceType: 'VARIABLE',
            sourceValue: '',
            buttonIndex: idx
          });
          });
        }
      });
    }

    setAssignment({
      isEnabled: assignment?.isEnabled ?? true,
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

    const mappingError = getAssignmentMappingError(
      activeType,
      selectedTemplate,
      assignment.variableMappings,
    );
    if (mappingError) {
      toast.error(mappingError);
      return;
    }

    try {
      setIsSaving(true);
      
      const formData = new FormData();
      formData.append('isEnabled', String(assignment.isEnabled));
      formData.append('metaTemplateId', getTemplateId(assignment));
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
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : '';
      toast.error(message || 'Failed to save assignment');
    } finally {
      setIsSaving(false);
    }
  };

  const updateVariableMapping = (index: number, value: string) => {
    if (!assignment) return;
    const newMappings = [...assignment.variableMappings];
    newMappings[index].sourceValue = value;
    setAssignment({ ...assignment, variableMappings: newMappings });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, JPEG, or PNG files are allowed');
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
      setAssignment((previous) => previous ? ({
        ...previous,
        headerMapping: { ...previous.headerMapping, sourceType: 'IMAGE_URL' }
      }) : previous);
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) return <div className="flex justify-center p-12"><LoaderSpinner /></div>;

  // Build a preview of the body text with variable labels substituted
  const previewBodyText = (() => {
    const bodyComponent = getTemplateComponents(selectedTemplate).find((c) => c.type === 'BODY');
    if (!bodyComponent?.text) return null;
    let text = bodyComponent.text;
    (assignment?.variableMappings || []).forEach((m) => {
      if (m.component !== 'BODY') return;
      const label = bodyVariablesForType.find((v) => v.value === m.sourceValue)?.label;
      text = text.replace(new RegExp(`\\{\\{${m.parameterIndex}\\}\\}`, 'g'), label ? `[${label}]` : `{{${m.parameterIndex}}}`);
    });
    return text;
  })();

  const previewHeaderComponent = getTemplateComponents(selectedTemplate).find((c) => c.type === 'HEADER');
  const previewFooterComponent = getTemplateComponents(selectedTemplate).find((c) => c.type === 'FOOTER');
  const previewButtonsComponent = getTemplateComponents(selectedTemplate).find((c) => c.type === 'BUTTONS');

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

      {/* Two-column: form on left, preview on right */}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        {/* ── Left: assignment form ── */}
        <div className={`${pageCardClass} p-6`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">{activeType.replace('_', ' ')} Assignment</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-gray-600 font-medium">Enable</span>
              <input
                type="checkbox"
                checked={assignment?.isEnabled || false}
                onChange={(event) => setAssignment((previous) => previous
                  ? { ...previous, isEnabled: event.target.checked }
                  : previous)}
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
              />
            </label>
          </div>

          <div className="space-y-5">
            <label className="block">
              <span className="text-sm font-medium text-gray-700 block mb-1">Select Meta Template</span>
              <select
                value={getTemplateId(assignment)}
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

                {selectedHeaderComponent?.format === 'IMAGE' && assignment.headerMapping?.sourceType !== 'DOCUMENT_PDF' && (
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
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg,image/png" onChange={handleImageChange} />
                    </div>
                  </div>
                )}

                {assignment.variableMappings.filter((mapping) => mapping.component === 'BODY').length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">BODY MAPPINGS</p>
                    <div className="space-y-2">
                      {assignment.variableMappings.map((mapping, i) => mapping.component === 'BODY' && (
                        <div key={i} className="flex items-center justify-between bg-white p-3 rounded border border-gray-100">
                          <span className="text-sm font-mono text-gray-600 w-16">{`{{${mapping.parameterIndex}}}`}</span>
                          <span className="mx-2 text-gray-400">→</span>
                          <select
                            value={mapping.sourceValue}
                            onChange={(e) => updateVariableMapping(i, e.target.value)}
                            className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm"
                          >
                            <option value="" disabled>Select variable</option>
                            {bodyVariablesForType.map(v => (
                              <option key={v.value} value={v.value}>{v.label}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {assignment.variableMappings.filter((mapping) => mapping.component === 'BUTTONS').length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">BUTTON MAPPINGS</p>
                    <div className="space-y-2">
                      {assignment.variableMappings.map((mapping, i) => mapping.component === 'BUTTONS' && (
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
                            {buttonVariablesForType.map(v => (
                              <option key={v.value} value={v.value}>{v.label}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {assignment.variableMappings.length === 0 && assignment.headerMapping?.sourceType !== 'DOCUMENT_PDF' && selectedHeaderComponent?.format !== 'IMAGE' && (
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

        {/* ── Right: WhatsApp template preview ── */}
        <div className={`${pageCardClass} p-5 flex flex-col`}>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Template Preview</p>

          {!selectedTemplate ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-10">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                {/* WhatsApp icon placeholder */}
                <svg viewBox="0 0 24 24" fill="#25D366" className="w-6 h-6"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.558 4.122 1.533 5.857L.057 23.57a.5.5 0 0 0 .624.624l5.713-1.476A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 0 1-5.032-1.385l-.36-.214-3.732.965.992-3.614-.235-.374A9.773 9.773 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
              </div>
              <p className="text-sm text-gray-400">Select a template to preview</p>
            </div>
          ) : (
            /* WhatsApp chat bubble */
            <div className="flex-1 flex flex-col bg-[#ece5dd] rounded-xl p-4 overflow-y-auto gap-2" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=\"20\" height=\"20\" viewBox=\"0 0 20 20\" xmlns=\"http://www.w3.org/2000/svg\"\u003e%3Ccircle cx=\"1\" cy=\"1\" r=\"1\" fill=\"rgba(0,0,0,0.04)\"/%3E%3C/svg%3E')" }}>
              <div className="ml-auto max-w-[90%] w-full">
                {/* Bubble */}
                <div className="bg-[#dcf8c6] rounded-2xl rounded-tr-sm shadow-sm overflow-hidden">

                  {/* Header */}
                  {previewHeaderComponent && (
                    <div className="bg-emerald-600/10 border-b border-emerald-100 px-3 py-2 flex items-center gap-2">
                      {previewHeaderComponent.format === 'IMAGE' && (
                        <>
                          <div className="w-8 h-8 rounded bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          </div>
                          {headerImagePreview ? (
                            <img src={headerImagePreview} alt="Header" className="w-full max-h-32 object-cover rounded" />
                          ) : (
                            <span className="text-xs text-emerald-700 font-medium">Image Header (Company Logo)</span>
                          )}
                        </>
                      )}
                      {previewHeaderComponent.format === 'DOCUMENT' && (
                        <>
                          <div className="w-8 h-8 rounded bg-red-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </div>
                          <span className="text-xs text-gray-700 font-medium">{activeType.replace('_', ' ')} PDF</span>
                        </>
                      )}
                      {previewHeaderComponent.format === 'TEXT' && previewHeaderComponent.text && (
                        <span className="text-sm font-bold text-gray-900">{previewHeaderComponent.text}</span>
                      )}
                    </div>
                  )}

                  {/* Body */}
                  <div className="px-3 py-3">
                    <p className="text-[13px] leading-relaxed text-gray-900 whitespace-pre-wrap">
                      {previewBodyText || <span className="italic text-gray-400">No body text</span>}
                    </p>
                  </div>

                  {/* Footer */}
                  {previewFooterComponent?.text && (
                    <div className="px-3 pb-2">
                      <p className="text-[11px] text-gray-400">{previewFooterComponent.text}</p>
                    </div>
                  )}

                  {/* Timestamp mock */}
                  <div className="px-3 pb-2 flex justify-end">
                    <span className="text-[10px] text-gray-400">12:00 PM ✓✓</span>
                  </div>
                </div>

                {/* Buttons */}
                {previewButtonsComponent?.buttons && previewButtonsComponent.buttons.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {(previewButtonsComponent.buttons as MetaTemplateButton[]).map((btn, i) => (
                      <div
                        key={i}
                        className="bg-white rounded-xl py-2 px-3 text-center text-[13px] font-medium text-[#00a884] shadow-sm border border-white/60"
                      >
                        {(btn as any).text || (btn.type === 'URL' ? '🔗 Open Link' : btn.type === 'PHONE_NUMBER' ? '📞 Call' : btn.type)}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Template name badge */}
              <div className="text-center">
                <span className="inline-block bg-white/60 text-gray-500 text-[10px] px-3 py-1 rounded-full">
                  {selectedTemplate.name} · {selectedTemplate.language} · {selectedTemplate.category}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignmentsTab;
