import {
  MessageCircle,
  MessagesSquare,
  Settings2,
  LayoutDashboard,
  FileText,
  CheckCheck,
  Eye,
  Reply,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

export type WhatsAppDocumentType = 'invoice' | 'exchange' | 'quotation';

export interface WhatsAppSettingsData {
  _id?: string;
  isEnabled: boolean;
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  webhookVerifyToken: string;
  apiVersion: string;
  autoSendOnInvoice: boolean;
  autoSendOnExchange: boolean;
  autoSendOnQuotation: boolean;
  testRecipientPhone?: string;
  lastTestedAt?: string | null;
  isConfigured?: boolean;
}

export interface WhatsAppTemplateData {
  _id?: string;
  type: WhatsAppDocumentType;
  headerText: string;
  bodyText: string;
  footerText: string;
  includeDocument: boolean;
  isActive: boolean;
}

export interface WhatsAppMessageLog {
  _id: string;
  customerName: string;
  customerPhone: string;
  documentType: WhatsAppDocumentType;
  documentNumber: string;
  amount: number;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'replied';
  renderedMessage: string;
  errorMessage?: string;
  replyText?: string;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  repliedAt?: string | null;
  createdAt: string;
}

const tabs = [
  { to: '/admin/whatsapp', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/whatsapp/settings', label: 'Settings', icon: Settings2 },
  { to: '/admin/whatsapp/templates', label: 'Templates', icon: FileText },
  { to: '/admin/whatsapp/messages', label: 'Messages', icon: MessagesSquare },
  { to: '/admin/whatsapp/delivered', label: 'Delivered', icon: CheckCheck },
  { to: '/admin/whatsapp/read', label: 'Read', icon: Eye },
  { to: '/admin/whatsapp/replies', label: 'Reply Rate', icon: Reply },
];

export const defaultTemplates: Record<WhatsAppDocumentType, WhatsAppTemplateData> = {
  invoice: {
    type: 'invoice',
    headerText: 'Invoice Ready',
    bodyText: 'Hello {{customerName}}, your invoice {{documentNumber}} for Rs {{amount}} is ready. {{companyName}} has attached your bill here.',
    footerText: 'Thank you for shopping with us.',
    includeDocument: true,
    isActive: true,
  },
  exchange: {
    type: 'exchange',
    headerText: 'Exchange Invoice Ready',
    bodyText: 'Hello {{customerName}}, your exchange invoice {{documentNumber}} for Rs {{amount}} is ready. {{companyName}} has attached your bill here.',
    footerText: 'Thank you for shopping with us.',
    includeDocument: true,
    isActive: true,
  },
  quotation: {
    type: 'quotation',
    headerText: 'Quotation Ready',
    bodyText: 'Hello {{customerName}}, your quotation {{documentNumber}} for Rs {{amount}} is ready. {{companyName}} has attached it here.',
    footerText: 'Reply to this message if you need any changes.',
    includeDocument: true,
    isActive: true,
  },
};

export const pageCardClass = 'rounded-xl border border-gray-200 bg-white shadow-sm';

export const statusBadgeClass = (status: WhatsAppMessageLog['status']) => {
  switch (status) {
    case 'sent':
      return 'bg-sky-100 text-sky-700';
    case 'delivered':
      return 'bg-emerald-100 text-emerald-700';
    case 'read':
      return 'bg-teal-100 text-teal-700';
    case 'replied':
      return 'bg-indigo-100 text-indigo-700';
    case 'failed':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-amber-100 text-amber-700';
  }
};

export function renderTemplatePreview(template: WhatsAppTemplateData) {
  const variables: Record<string, string> = {
    customerName: 'Ananya Sharma',
    documentNumber: template.type === 'quotation' ? 'QT-000321' : 'INV-000321',
    amount: '12500.00',
    companyName: 'Naresh Saree Collection',
  };

  const fill = (value: string) =>
    value.replace(/{{\s*(\w+)\s*}}/g, (_, key) => variables[key] || '');

  return [template.headerText, template.bodyText, template.footerText]
    .filter(Boolean)
    .map((entry) => fill(entry))
    .join('\n\n');
}

export const WhatsAppSectionHeader = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) => (
  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
    <div>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <MessageCircle size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-950">{title}</h1>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>
    </div>
  </div>
);

export const WhatsAppTabs = () => (
  <div className="flex flex-wrap gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
    {tabs.map((tab) => {
      const Icon = tab.icon;
      return (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/admin/whatsapp'}
          className={({ isActive }) =>
            `inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950'
            }`
          }
        >
          <Icon size={16} />
          {tab.label}
        </NavLink>
      );
    })}
  </div>
);
