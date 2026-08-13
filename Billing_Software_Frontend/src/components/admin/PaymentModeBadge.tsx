import React from 'react';
import {
  DollarSign,
  CreditCard,
  Banknote,
  HelpCircle,
  Combine,
  Timer,
} from 'lucide-react';
import UPI from '@assets/images/upi.svg';

interface PaymentModeBadgeProps {
  mode?: string | null;
}

export const modeConfig: Record<
  string,
  {
    label: string;
    icon: React.ReactNode;
    className: string;
    colorName: string;
  }
> = {
  cash: {
    label: 'Cash',
    icon: <DollarSign size={14} className="ml-1 text-green-600" />,
    className: 'bg-green-100 text-green-700',
    colorName: 'green',
  },
  card: {
    label: 'Card',
    icon: <CreditCard size={14} className="ml-1 text-violet-600" />,
    className: 'bg-violet-100 text-violet-700',
    colorName: 'purple',
  },
  cheque: {
    label: 'Cheque',
    icon: <CreditCard size={14} className="ml-1 text-primary" />,
    className: 'bg-third text-primary',
    colorName: 'purple',
  },
  'rtgs/neft': {
    label: 'RTGS/NEFT',
    icon: <Banknote size={14} className="ml-1 text-blue-600" />,
    className: 'bg-blue-100 text-blue-700',
    colorName: 'blue',
  },
  online: {
    label: 'Online',
    icon: <img src={UPI} alt="UPI" className="h-4 ml-1" />,
    className: 'bg-blue-100 text-blue-700',
    colorName: 'blue',
  },
  bank: {
    label: 'Bank',
    icon: <Banknote size={14} className="ml-1 text-blue-600" />,
    className: 'bg-blue-100 text-blue-700',
    colorName: 'blue',
  },
  upi: {
    label: 'UPI',
    icon: <img src={UPI} alt="UPI" className="h-4 ml-1" />,
    className: 'bg-blue-100 text-blue-700',
    colorName: 'blue',
  },
  'bank deposit': {
    label: 'Bank Deposit',
    icon: <Banknote size={14} className="ml-1 text-blue-600" />,
    className: 'bg-blue-100 text-blue-700',
    colorName: 'blue',
  },
  'bank transfer': {
    label: 'Bank Transfer',
    icon: <Banknote size={14} className="ml-1 text-blue-600" />,
    className: 'bg-blue-100 text-blue-700',
    colorName: 'blue',
  },
  'petty cash': {
    label: 'Petty Cash',
    icon: <Banknote size={14} className="ml-1 text-blue-600" />,
    className: 'bg-blue-100 text-blue-700',
    colorName: 'blue',
  },
  phonepe: {
    label: 'UPI',
    icon: <img src={UPI} alt="PhonePe" className="h-4 ml-1" />,
    className: 'bg-blue-100 text-blue-700',
    colorName: 'blue',
  },
  mixed: {
    label: 'Mixed',
    icon: <Combine size={14} className="ml-1 text-blue-600" />,
    className: 'bg-blue-100 text-blue-700',
    colorName: 'blue',
  },
  credit: {
    label: 'Credit',
    icon: <Timer size={14} className="ml-1 text-orange-600" />,
    className: 'bg-orange-100 text-orange-700',
    colorName: 'yellow',
  },
};

const PaymentModeBadge: React.FC<PaymentModeBadgeProps> = ({ mode }) => {
  const normalized = String(mode || "").toLowerCase().trim();
  const config = modeConfig[normalized] || {
    label: mode,
    icon: <HelpCircle size={14} className="ml-1 text-gray-600" />,
    className: 'bg-gray-100 text-gray-700',
    colorName: 'gray'
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-sm text-xs font-medium ${config.className}`}
    >
      {config.label}
      {config.icon}
    </span>
  );
};

export default PaymentModeBadge;
