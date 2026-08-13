


// EXPENSES
export const calculateTotalExpenses = (expenses: {
  garageCharges?: number;
  loadingCharges?: number;
  unloadingCharges?: number;
  transportCharges?: number;
  otherCharges?: number;
}) => {
  return (
    Number(expenses.garageCharges || 0) +
    Number(expenses.loadingCharges || 0) +
    Number(expenses.unloadingCharges || 0) +
    Number(expenses.transportCharges || 0) +
    Number(expenses.otherCharges || 0)
  );
};

// BROKER COMMISSION
// ⚠️ Calculated on BASE AMOUNT (itemTotal + expenses)
export const calculateBrokerCommission = (
  baseAmount: number, // ✅ NOT itemTotal anymore
  type: 'fixed' | 'percentage',
  value?: number
) => {
  const commissionValue = Number(value || 0);

  if (type === 'percentage') {
    return (baseAmount * commissionValue) / 100;
  }

  return commissionValue;
};

// FINAL AMOUNT
export const calculateFinalAmount = (
  itemTotal: number,
  expensesTotal: number,
  brokerCommission: number
) => {
  return itemTotal + expensesTotal + brokerCommission;
};

// OPTIONAL: ONE-LINE HELPER (RECOMMENDED)
export const calculatePurchaseTotals = (params: {
  itemTotal: number;
  expenses: {
    garageCharges?: number;
    loadingCharges?: number;
    unloadingCharges?: number;
    transportCharges?: number;
    otherCharges?: number;
  };
  brokerCommissionType: 'fixed' | 'percentage';
  brokerCommissionValue?: number;
}) => {
  const expensesTotal = calculateTotalExpenses(params.expenses);

  const baseAmount = params.itemTotal + expensesTotal;

  const brokerCommission = calculateBrokerCommission(
    baseAmount,
    params.brokerCommissionType,
    params.brokerCommissionValue
  );

  const finalAmount = calculateFinalAmount(
    params.itemTotal,
    expensesTotal,
    brokerCommission
  );

  return {
    itemTotal: params.itemTotal,
    expensesTotal,
    brokerCommission,
    finalAmount
  };
};
