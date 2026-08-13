import React from 'react';

interface PurchaseExpensesProps<T extends Record<string, any>> {
  garageCharges?: number;
  loadingCharges?: number;
  unloadingCharges?: number;
  transportCharges?: number;
  otherCharges?: number;
  expenseNotes?: string;
  onChange: (field: keyof T, value: any) => void;
}

const PurchaseExpenses = <T extends Record<string, any>>({
  garageCharges,
  loadingCharges,
  unloadingCharges,
  transportCharges,
  otherCharges,
  expenseNotes,
  onChange
}: PurchaseExpensesProps<T>) => {

    return (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-950 mb-3">
                Expenses
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Garage Charges
                    </label>
                    <input
                        type="number"
                        min="0"
                        placeholder="Enter garage charges"
                        value={garageCharges || 0}
                        onChange={(e) =>
                            onChange(
                                'garageCharges',
                                Number(e.target.value)
                            )
                        }
                        className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Loading Charges
                    </label>
                    <input
                        type="number"
                        min="0"
                        placeholder="Enter loading charges"
                        value={loadingCharges || 0}
                        onChange={(e) =>
                            onChange(
                                'loadingCharges',
                                Number(e.target.value)
                            )
                        }
                        className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unloading Charges
                    </label>
                    <input
                        type="number"
                        min="0"
                        placeholder="Enter unloading charges"
                        value={unloadingCharges || 0}
                        onChange={(e) =>
                            onChange(
                                'unloadingCharges',
                                Number(e.target.value)
                            )
                        }
                        className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Transport Charges
                    </label>
                    <input
                        type="number"
                        min="0"
                        placeholder="Enter transport charges"
                        value={transportCharges || 0}
                        onChange={(e) =>
                            onChange(
                                'transportCharges',
                                Number(e.target.value)
                            )
                        }
                        className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                </div>

                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Other Charges
                    </label>
                    <input
                        type="number"
                        min="0"
                        placeholder="Enter other charges"
                        value={otherCharges || 0}
                        onChange={(e) =>
                            onChange(
                                'otherCharges',
                                Number(e.target.value)
                            )
                        }
                        className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                    />
                </div>
            </div>

            <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expense Notes
                </label>
                <textarea
                    rows={3}
                    placeholder="Optional notes about expenses"
                    value={expenseNotes || ''}
                    onChange={(e) =>
                        onChange('expenseNotes', e.target.value)
                    }
                    className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                />
            </div>
        </div>
    );
};

export default PurchaseExpenses;
