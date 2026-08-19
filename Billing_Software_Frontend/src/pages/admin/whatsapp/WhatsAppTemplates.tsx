import { useState } from 'react';
import { WhatsAppSectionHeader, WhatsAppTabs } from './WhatsAppShared';
import MetaTemplatesTab from './MetaTemplatesTab';
import AssignmentsTab from './AssignmentsTab';

const WhatsAppTemplates = () => {
  const [activeTab, setActiveTab] = useState<'META' | 'ASSIGNMENTS'>('META');

  return (
    <div className="space-y-6">
      <WhatsAppSectionHeader
        title="WhatsApp Templates"
        subtitle="Manage your approved Meta templates and map them to application events."
      />
      <WhatsAppTabs />

      <div className="flex border-b border-gray-200">
        <button
          className={`px-4 py-3 font-medium text-sm transition-colors ${
            activeTab === 'META'
              ? 'border-b-2 border-emerald-600 text-emerald-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('META')}
        >
          Meta Templates
        </button>
        <button
          className={`px-4 py-3 font-medium text-sm transition-colors ${
            activeTab === 'ASSIGNMENTS'
              ? 'border-b-2 border-emerald-600 text-emerald-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('ASSIGNMENTS')}
        >
          Assignments
        </button>
      </div>

      <div className="pt-4">
        {activeTab === 'META' && <MetaTemplatesTab />}
        {activeTab === 'ASSIGNMENTS' && <AssignmentsTab />}
      </div>
    </div>
  );
};

export default WhatsAppTemplates;
