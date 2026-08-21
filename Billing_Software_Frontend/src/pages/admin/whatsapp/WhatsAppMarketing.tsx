import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import Constants from '@constants/api';
import type { RootState } from '@store/index';
import { pageCardClass, WhatsAppSectionHeader, WhatsAppTabs } from './WhatsAppShared';

export interface MetaTemplate {
  _id: string;
  metaId: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: Array<{
    type: string;
    text?: string;
    format?: string;
  }>;
}

type EligibilityStatus = 'ELIGIBLE' | 'INVALID_PHONE';

export interface MarketingCustomer {
  _id: string;
  name: string;
  phone: string;
  companyName: string;
  eligible: boolean;
  eligibilityStatus: EligibilityStatus;
}

interface EligibilityStats {
  total: number;
  eligible: number;
  invalidPhone: number;
}

interface VariableMapping {
  component: 'BODY';
  parameterIndex: number;
  sourceType: 'VARIABLE' | 'FIXED';
  sourceValue: string;
}

interface CampaignSummary {
  _id: string;
  name: string;
  status: string;
  totalEligible: number;
  acceptedCount: number;
  sentCount: number;
  failedCount: number;
}

const WhatsAppMarketing = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  const [campaignName, setCampaignName] = useState('');
  
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  
  const [customers, setCustomers] = useState<MarketingCustomer[]>([]);
  const [stats, setStats] = useState<EligibilityStats | null>(null);
  
  const [audienceTarget, setAudienceTarget] = useState<'all' | 'selected'>('all');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [variableMappings, setVariableMappings] = useState<VariableMapping[]>([]);
  
  const [isSending, setIsSending] = useState(false);
  const [campaignHistory, setCampaignHistory] = useState<CampaignSummary[]>([]);

  const loadTemplates = useCallback(async () => {
    try {
      const response = await axios.get(`${Constants.BASE_URL}/api/admin/whatsapp/meta-templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const valid = (response.data?.data || []).filter((t: MetaTemplate) => t.status === 'APPROVED' && t.category === 'MARKETING');
      setTemplates(valid);
    } catch {
      toast.error('Failed to load marketing templates');
    }
  }, [token]);

  const loadEligibleCustomers = useCallback(async () => {
    try {
      const response = await axios.get(`${Constants.BASE_URL}/api/admin/whatsapp/campaigns/eligible-customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const loadedCustomers: MarketingCustomer[] = response.data?.customers || response.data?.eligibleCustomers || [];
      const eligibleCustomerIds = loadedCustomers
        .filter((customer) => customer.eligible)
        .map((customer) => customer._id);
      setCustomers(loadedCustomers);
      setStats(response.data?.stats);
      setSelectedCustomerIds(eligibleCustomerIds);
    } catch {
      toast.error('Failed to load eligible customers');
    }
  }, [token]);

  const loadCampaignHistory = useCallback(async () => {
    try {
      const response = await axios.get(`${Constants.BASE_URL}/api/admin/whatsapp/campaigns`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCampaignHistory(response.data?.data || []);
    } catch {
      // optional
    }
  }, [token]);

  useEffect(() => {
    void loadTemplates();
    void loadEligibleCustomers();
    void loadCampaignHistory();
  }, [loadCampaignHistory, loadEligibleCustomers, loadTemplates]);

  const selectedTemplate = useMemo(() => templates.find(t => t._id === selectedTemplateId), [templates, selectedTemplateId]);

  const handleTemplateSelection = (id: string) => {
    setSelectedTemplateId(id);
    const tmpl = templates.find(t => t._id === id);
    if (!tmpl) return;

    const bodyComponent = tmpl.components.find(c => c.type === 'BODY');
    let requiredVarsCount = 0;
    if (bodyComponent && bodyComponent.text) {
      const matches = bodyComponent.text.match(/\{\{(\d+)\}\}/g);
      if (matches) requiredVarsCount = matches.length;
    }

    const newMappings: VariableMapping[] = Array.from({ length: requiredVarsCount }).map((_, i) => ({
      component: 'BODY',
      parameterIndex: i + 1,
      sourceType: 'VARIABLE',
      sourceValue: 'customerName',
    }));

    setVariableMappings(newMappings);
  };

  const targetCount = audienceTarget === 'all' ? (stats?.eligible || 0) : selectedCustomerIds.length;

  const handleSend = async () => {
    if (!campaignName.trim() || !selectedTemplate) {
      return toast.error('Please complete all steps');
    }
    
    if (audienceTarget === 'selected' && selectedCustomerIds.length === 0) {
      return toast.error('Please select at least one customer');
    }

    if (targetCount === 0) {
      return toast.error('No eligible customers are available for this campaign');
    }

    const confirmed = window.confirm(`Send WhatsApp Marketing campaign to ${targetCount} eligible customers?`);
    if (!confirmed) return;

    try {
      setIsSending(true);
      await axios.post(`${Constants.BASE_URL}/api/admin/whatsapp/campaigns`, {
        name: campaignName.trim(),
        metaTemplateId: selectedTemplate.metaId,
        sendToAllEligible: audienceTarget === 'all',
        selectedCustomerIds: audienceTarget === 'selected' ? selectedCustomerIds : [],
        variableMappings
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Campaign queued successfully');
      setCampaignName('');
      setSelectedTemplateId('');
      setVariableMappings([]);
      await loadCampaignHistory();
    } catch (error: unknown) {
      const message = axios.isAxiosError(error) ? error.response?.data?.message : '';
      toast.error(message || 'Failed to start campaign');
    } finally {
      setIsSending(false);
    }
  };

  const updateMapping = (
    index: number,
    updates: Partial<Pick<VariableMapping, 'sourceType' | 'sourceValue'>>,
  ) => {
    setVariableMappings((current) => current.map((mapping, mappingIndex) => (
      mappingIndex === index ? { ...mapping, ...updates } : mapping
    )));
  };

  const visibleCustomers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) return customers;
    return customers.filter((customer) => (
      customer.name.toLowerCase().includes(normalizedSearch)
      || customer.phone.includes(normalizedSearch)
    ));
  }, [customers, searchTerm]);

  const selectVisibleCustomers = () => {
    const visibleIds = visibleCustomers
      .filter((customer) => customer.eligible)
      .map((customer) => customer._id);
    setSelectedCustomerIds(Array.from(new Set([...selectedCustomerIds, ...visibleIds])));
  };

  const eligibilityLabel: Record<EligibilityStatus, string> = {
    ELIGIBLE: 'Eligible',
    INVALID_PHONE: 'Invalid phone',
  };

  return (
    <div className="space-y-6">
      <WhatsAppSectionHeader
        title="WhatsApp Marketing"
        subtitle="Broadcast promotional templates and bulk messages to eligible customers."
      />
      <WhatsAppTabs />

      <div className="grid md:grid-cols-[2fr_1fr] gap-6">
        <div className={`${pageCardClass} p-6 space-y-6`}>
          <h2 className="text-xl font-semibold text-gray-900">New Marketing Campaign</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
              <input
                type="text"
                value={campaignName}
                onChange={e => setCampaignName(e.target.value)}
                placeholder="e.g. Diwali Sale 2026"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marketing Template</label>
              <select
                value={selectedTemplateId}
                onChange={e => handleTemplateSelection(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="" disabled>Select an approved marketing template</option>
                {templates.map(t => (
                  <option key={t._id} value={t._id}>{t.name} ({t.language})</option>
                ))}
              </select>
            </div>

            {selectedTemplate && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                <h3 className="font-medium text-sm text-gray-800">Variable Mappings</h3>
                {variableMappings.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white p-3 border border-gray-200 rounded">
                    <span className="font-mono text-sm text-gray-600 w-12">{`{{${m.parameterIndex}}}`}</span>
                    <select
                      value={m.sourceType}
                      onChange={e => updateMapping(i, { sourceType: e.target.value as VariableMapping['sourceType'] })}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      <option value="VARIABLE">Customer Field</option>
                      <option value="FIXED">Custom Value</option>
                    </select>
                    {m.sourceType === 'VARIABLE' ? (
                      <select
                        value={m.sourceValue}
                        onChange={e => updateMapping(i, { sourceValue: e.target.value })}
                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        <option value="customerName">Customer Name</option>
                        <option value="customerPhone">Customer Phone</option>
                        <option value="companyName">Company Name</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={m.sourceValue}
                        onChange={e => updateMapping(i, { sourceValue: e.target.value })}
                        placeholder="Enter value"
                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm outline-none"
                      />
                    )}
                  </div>
                ))}
                {variableMappings.length === 0 && <p className="text-sm text-gray-500">No variables needed for this template.</p>}
              </div>
            )}

            {stats && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <h3 className="font-medium text-sm text-blue-800 mb-2">Recipient Eligibility</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>Total Customers: {stats.total}</li>
                  <li>Eligible for WhatsApp Marketing: <span className="font-bold">{stats.eligible}</span></li>
                  <li>Invalid/Missing Phone: {stats.invalidPhone}</li>
                </ul>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Audience Targeting</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="audience" value="all" checked={audienceTarget === 'all'} onChange={() => setAudienceTarget('all')} className="accent-emerald-600" />
                  <span className="text-sm text-gray-800">All Eligible Customers ({stats?.eligible || 0})</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="audience" value="selected" checked={audienceTarget === 'selected'} onChange={() => setAudienceTarget('selected')} className="accent-emerald-600" />
                  <span className="text-sm text-gray-800">Selected Customers</span>
                </label>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Customer Selection</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Customers with a valid phone number can receive a marketing campaign.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="min-w-56 flex-1 text-sm border-b border-gray-200 pb-2 outline-none"
                />
                {audienceTarget === 'selected' && (
                  <>
                    <button
                      type="button"
                      onClick={selectVisibleCustomers}
                      className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700"
                    >
                      Select Visible
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCustomerIds([])}
                      className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700"
                    >
                      Clear All
                    </button>
                  </>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {visibleCustomers.map((customer) => (
                  <div
                    key={customer._id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 p-2 text-sm hover:bg-gray-50"
                  >
                    {audienceTarget === 'selected' && (
                      <input
                        type="checkbox"
                        className="accent-emerald-600"
                        disabled={!customer.eligible}
                        checked={customer.eligible && selectedCustomerIds.includes(customer._id)}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedCustomerIds([...selectedCustomerIds, customer._id]);
                          } else {
                            setSelectedCustomerIds(selectedCustomerIds.filter(id => id !== customer._id));
                          }
                        }}
                      />
                    )}
                    <div className="min-w-44 flex-1">
                      <p className="font-medium text-gray-900">{customer.name || 'Customer'}</p>
                      <p className="text-xs text-gray-500">{customer.phone || 'No phone'}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                      customer.eligible
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {eligibilityLabel[customer.eligibilityStatus]}
                    </span>
                  </div>
                ))}
                {visibleCustomers.length === 0 && (
                  <p className="py-3 text-center text-xs text-gray-500">No customers match this search.</p>
                )}
              </div>
              {audienceTarget === 'selected' && (
                <div className="text-xs text-gray-500">
                  {selectedCustomerIds.length} customer(s) selected
                </div>
              )}
            </div>

            <button
              onClick={handleSend}
              disabled={isSending || !selectedTemplate || targetCount === 0}
              className="w-full bg-emerald-600 text-white rounded-lg px-4 py-3 font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSending ? 'Starting Campaign...' : `Send Campaign to ${targetCount} Customers`}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className={`${pageCardClass} p-6`}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Campaigns</h2>
            <div className="space-y-3">
              {campaignHistory.slice(0, 5).map(c => (
                <div key={c._id} className="p-3 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-sm text-gray-900">{c.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                      c.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>{c.status}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2 grid grid-cols-2 gap-1">
                    <span>Target: {c.totalEligible}</span>
                    <span>Accepted: {c.acceptedCount}</span>
                    <span>Sent: {c.sentCount}</span>
                    <span>Failed: {c.failedCount}</span>
                  </div>
                </div>
              ))}
              {campaignHistory.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No recent campaigns</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppMarketing;
