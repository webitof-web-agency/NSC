import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface BrokerDetailsProps<T extends Record<string, any>> {
  brokerName?: string;
  brokerPhone?: string;
  brokerCommissionType?: 'fixed' | 'percentage';
  brokerCommissionValue?: number;
  onChange: (field: keyof T, value: any) => void;
}

const BrokerDetails = <T extends Record<string, any>>({
  brokerName,
  brokerPhone,
  brokerCommissionType,
  brokerCommissionValue,
  onChange
}: BrokerDetailsProps<T>) => {
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () =>
            document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const options = [
        { value: 'fixed', label: 'Fixed Amount' },
        { value: 'percentage', label: 'Percentage (%)' }
    ];

    const selectedLabel =
        options.find(o => o.value === brokerCommissionType)?.label ??
        'Select Commission Type';

    return (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-950 mb-3">
                Broker / Deal Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Broker Name */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Broker Name
                    </label>
                    <input
                        type="text"
                        placeholder="Enter broker name"
                        value={brokerName || ''}
                        onChange={(e) =>
                            onChange('brokerName', e.target.value)
                        }
                        className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                </div>

                {/* Broker Phone */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Broker Phone
                    </label>
                    <input
                        type="text"
                        placeholder="Enter broker phone"
                        value={brokerPhone || ''}
                        onChange={(e) =>
                            onChange('brokerPhone', e.target.value)
                        }
                        className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                </div>

                {/* Commission Type – Custom Dropdown */}
                <div ref={dropdownRef} className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Commission Type
                    </label>

                    <button
                        type="button"
                        onClick={() => setOpen(prev => !prev)}
                        className="flex items-center justify-between border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 bg-white focus:outline-none focus:ring-1 focus:ring-purple-600"
                    >
                        <span className="text-sm">
                            {selectedLabel}
                        </span>
                        <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                                open ? 'rotate-180' : ''
                            }`}
                        />
                    </button>

                    {open && (
                        <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
                            {options.map(option => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        onChange('brokerCommissionType', option.value);
                                        setOpen(false);
                                    }}
                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                                        brokerCommissionType === option.value
                                            ? 'bg-gray-100 font-semibold'
                                            : ''
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Commission Value */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Commission Value
                    </label>
                    <input
                        type="number"
                        min="0"
                        placeholder={
                            brokerCommissionType === 'percentage'
                                ? 'Enter percentage'
                                : 'Enter amount'
                        }
                        value={brokerCommissionValue}
                        onChange={(e) =>
                            onChange(
                                'brokerCommissionValue',
                                Number(e.target.value)
                            )
                        }
                        className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                </div>
            </div>
        </div>
    );
};

export default BrokerDetails;
