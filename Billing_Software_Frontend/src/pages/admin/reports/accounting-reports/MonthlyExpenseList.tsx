import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import axios from 'axios';
import Constants from '@constants/api';
import { toast } from 'react-toastify';
import { PlusCircle, Trash2, Edit, DollarSign, Plus, X, Search } from 'lucide-react';
import Modal from '@components/admin/Modal';
import DateInput from '@components/admin/DateInput';
import SearchableDropdown from '@components/admin/SearchableDropdown';
import CustomSelectDropdown from '@components/admin/CustomSelectDropdown';
import StatsCard from '@components/admin/StatsCard';
import ExpenseCategoryManagement from './ExpenseCategoryManagement';
import Table from '@components/admin/Table';
import PaymentModeBadge from '@components/admin/PaymentModeBadge';
import TableRow from '@components/admin/TableRow';
import PaginationWrapper from '@components/admin/PaginationWrapper';

interface MonthlyExpense {
    _id: string;
    expenseCategory: string | { _id: string; title: string };
    amount: number;
    expenseDate: string;
    description: string;
    paymentMode: string;
    invoiceNo?: string;
    transportName?: string;
    transportPhone?: string;
    paymentDate?: string | null;
    paymentDueDate?: string | null;
    customFields?: { key: string; value: string }[];
    createdBy: {
        _id: string;
        firstName: string;
        lastName: string;
    };
}

interface ExpenseCategory {
    _id: string;
    title: string;
}

interface ExpenseSummary {
    _id: string;
    categoryName: string;
    totalAmount: number;
    count: number;
}

interface FormData {
    expenseCategory: string;
    amount: string;
    expenseDate: Date | null;
    description: string;
    paymentMode: string;
    paymentDate: Date | null;
    paymentDueDate: Date | null;
    customFields: { key: string; value: string }[];
}

const MonthlyExpenseList: React.FC = () => {
    const { token } = useSelector((state: RootState) => state.auth);

    // Tab state
    const [activeTab, setActiveTab] = useState<'expenses' | 'categories'>('expenses');

    const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);

    const [summary, setSummary] = useState<{ summary: ExpenseSummary[]; grandTotal: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<MonthlyExpense | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [limit, setLimit] = useState(10);

    // Filters
    const [filters, setFilters] = useState({
        search: '',
        expenseCategory: '',
        paymentMode: '',
    });

    const [formData, setFormData] = useState<FormData>({
        expenseCategory: '',
        amount: '',
        expenseDate: new Date(),
        description: '',
        paymentMode: '',
        paymentDate: null,
        paymentDueDate: null,
        customFields: [],
    });

    const paymentModes = ['Cash', 'Online', 'Cheque', 'RTGS/NEFT'];

    const prevTabRef = React.useRef(activeTab);

    useEffect(() => {
        fetchCategories();
    }, []);

    // Refetch categories only when switching from categories tab to expenses tab
    useEffect(() => {
        if (prevTabRef.current === 'categories' && activeTab === 'expenses') {
            fetchCategories();
        }
        prevTabRef.current = activeTab;
    }, [activeTab]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filters.expenseCategory, filters.paymentMode, filters.search]);

    useEffect(() => {
        fetchExpenses();
        fetchSummary();
    }, [filters, currentPage, limit]);

    const fetchCategories = async () => {
        try {
            const response = await axios.get(Constants.FETCH_EXPENSE_CATEGORIES_WITH_SEARCH_URL, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const fetchedCategories = response.data.data
                .filter((cat: any) => cat._id || cat.id)
                .map((cat: any) => ({
                    _id: String(cat._id || cat.id),
                    title: cat.title,
                }));
            const purchaseCategoryPattern = /^PUR-\d+$/i;
            setCategories(fetchedCategories.filter((cat) => !purchaseCategoryPattern.test(cat.title || "")));
        } catch (error) {
            console.error('Error fetching categories:', error);
            toast.error('Failed to laoad expense categories');
        }
    };

    const fetchExpenses = async () => {
        try {
            setLoading(true);
            const params: any = {
                page: currentPage,
                limit,
                search: filters.search,
            };

            if (filters.expenseCategory) params.expenseCategory = filters.expenseCategory;
            if (filters.paymentMode) params.paymentMode = filters.paymentMode;

            const response = await axios.get(Constants.GET_MONTHLY_EXPENSES_URL, {
                headers: { Authorization: `Bearer ${token}` },
                params,
            });

            setExpenses(response.data.data || []);
            setTotal(response.data.pagination.total);
            setTotalPages(response.data.pagination.pages);

        } catch (error: any) {
            toast.error('Error fetching expenses');
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSummary = async () => {
        try {
            const params: any = {};
            // No date filters for summary

            const response = await axios.get(Constants.GET_MONTHLY_EXPENSE_SUMMARY_URL, {
                headers: { Authorization: `Bearer ${token}` },
                params,
            });

            setSummary(response.data.data || { summary: [], grandTotal: 0 });
        } catch (error) {
            console.error('Error fetching summary:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.expenseCategory || !formData.amount) {
            toast.error('Please fill in required fields');
            return;
        }

        try {
            const payload = {
                expenseCategory: formData.expenseCategory,
                amount: Number(formData.amount),
                expenseDate: formData.expenseDate?.toISOString(),
                description: formData.description,
                paymentMode: formData.paymentMode,
                paymentDate: formData.paymentDate?.toISOString() || null,
                paymentDueDate: formData.paymentDueDate?.toISOString() || null,
                customFields: formData.customFields.filter(f => f.key && f.value),
            };

            if (editingExpense) {
                await axios.put(
                    `${Constants.UPDATE_MONTHLY_EXPENSE_URL}/${editingExpense._id}`,
                    payload,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                toast.success('Expense updated successfully');
                setIsEditModalOpen(false);
            } else {
                await axios.post(Constants.CREATE_MONTHLY_EXPENSE_URL, payload, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                toast.success('Expense created successfully');
                setIsAddModalOpen(false);
            }

            fetchExpenses();
            fetchSummary();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Error saving expense');
        }
    };

    const handleEdit = (expense: MonthlyExpense) => {
        setEditingExpense(expense);

        // Load custom fields from expense data
        const customFields = expense.customFields || [];

        setFormData({
            expenseCategory: typeof expense.expenseCategory === 'object'
                ? expense.expenseCategory._id
                : expense.expenseCategory,
            amount: expense.amount.toString(),
            expenseDate: new Date(expense.expenseDate),
            description: expense.description || '',
            paymentMode: expense.paymentMode || '',
            paymentDate: expense.paymentDate ? new Date(expense.paymentDate) : null,
            paymentDueDate: expense.paymentDueDate ? new Date(expense.paymentDueDate) : null,
            customFields,
        });
        setIsEditModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this expense?')) return;

        try {
            await axios.delete(`${Constants.DELETE_MONTHLY_EXPENSE_URL}/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            toast.success('Expense deleted successfully');
            fetchExpenses();
            fetchSummary();
        } catch (error) {
            toast.error('Error deleting expense');
        }
    };

    const resetForm = () => {
        setFormData({
            expenseCategory: '',
            amount: '',
            expenseDate: new Date(),
            description: '',
            paymentMode: '',
            paymentDate: null,
            paymentDueDate: null,
            customFields: [],
        });
        setEditingExpense(null);
    };

    const handleFormChange = (field: keyof FormData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Custom field management functions
    const addCustomField = () => {
        setFormData(prev => ({
            ...prev,
            customFields: [...prev.customFields, { key: '', value: '' }]
        }));
    };

    const updateCustomField = (index: number, field: 'key' | 'value', value: string) => {
        const updated = [...formData.customFields];
        updated[index][field] = value;
        setFormData(prev => ({ ...prev, customFields: updated }));
    };

    const removeCustomField = (index: number) => {
        setFormData(prev => ({
            ...prev,
            customFields: prev.customFields.filter((_, i) => i !== index)
        }));
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Expense Management</h1>
            </div>

            {/* Tab Navigation */}
            <div className="mb-6">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            onClick={() => setActiveTab('expenses')}
                            className={`${activeTab === 'expenses'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                        >
                            Monthly Expenses
                        </button>
                        <button
                            onClick={() => setActiveTab('categories')}
                            className={`${activeTab === 'categories'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                        >
                            Manage Categories
                        </button>
                    </nav>
                </div>
            </div>

            {/* Conditional Content Based on Active Tab */}
            {activeTab === 'categories' ? (
                <ExpenseCategoryManagement />
            ) : (
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-7xl mx-auto space-y-6">

                        {/* Filters & Stats */}
                        <div className="space-y-6">
                            {/* Search & Filter */}
                            <div className="w-full">
                                {/* Summary Cards with Add Button */}
                                {summary && (
                                    <div className="flex flex-col lg:flex-row items-start justify-between gap-4 mb-6">
                                        <div className="w-full lg:w-50">
                                            <StatsCard
                                                title="Total Expenses"
                                                value={`₹${summary?.grandTotal?.toFixed(2) || '0.00'}`}
                                                difference={0}
                                                icon={<DollarSign size={25} className="text-blue-600" />}
                                                color="blue"
                                            />
                                        </div>

                                        {/* Add Button - Right */}
                                        <div className="w-full lg:w-auto">
                                            <button
                                                onClick={() => {
                                                    resetForm();
                                                    setIsAddModalOpen(true);
                                                }}
                                                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-gray-900 w-full lg:w-auto justify-center"
                                            >
                                                <PlusCircle size={20} />
                                                Add Expense
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Filters */}
                                <div className="flex flex-col md:flex-row gap-4 mb-4">
                                    <div className="flex-1">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={filters.search}
                                                onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                                placeholder="Search..."
                                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600"
                                            />
                                            <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
                                        </div>
                                    </div>
                                    <div className="w-full md:w-auto">
                                        <select
                                            value={limit}
                                            onChange={(e) => setLimit(Number(e.target.value))}
                                            className="w-full md:w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600"
                                        >
                                            <option value={10}>10 / page</option>
                                            <option value={25}>25 / page</option>
                                            <option value={50}>50 / page</option>
                                            <option value={100}>100 / page</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-lg shadow mb-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Removed Search from here as it's moved up */}
                                        <div>
                                            <SearchableDropdown
                                                label="Category"
                                                value={categories.find(cat => cat._id === filters.expenseCategory) ? { id: filters.expenseCategory, name: categories.find(cat => cat._id === filters.expenseCategory)!.title } : null}
                                                options={[{ id: '', name: 'All Categories' }, ...categories.map(cat => ({ id: cat._id, name: cat.title }))]}
                                                onChange={(_, value) => setFilters(prev => ({ ...prev, expenseCategory: value?.id || '' }))}
                                                placeholder="All Categories"
                                            />
                                        </div>
                                        <div>
                                            <SearchableDropdown
                                                label="Payment Mode"
                                                value={filters.paymentMode ? { id: filters.paymentMode, name: filters.paymentMode } : null}
                                                options={[{ id: '', name: 'All Modes' }, ...paymentModes.map(mode => ({ id: mode, name: mode }))]}
                                                onChange={(_, value) => setFilters(prev => ({ ...prev, paymentMode: value?.id || '' }))}
                                                placeholder="All Modes"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {loading ? (
                                    <div className="flex justify-center items-center h-32">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Table */}
                                        <Table headers={['#', 'Date', 'Category', 'Amount', 'Payment Mode', 'Actions']}>
                                            {expenses.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                                                        No expenses found
                                                    </td>
                                                </tr>
                                            ) : (
                                                expenses.map((expense, idx) => (
                                                    <TableRow
                                                        key={expense._id}
                                                        index={(currentPage - 1) * limit + idx + 1}
                                                        row={expense}
                                                        columns={[
                                                            new Date(expense.expenseDate).toLocaleDateString(),
                                                            typeof expense.expenseCategory === 'object' && expense.expenseCategory?.title
                                                                ? expense.expenseCategory.title
                                                                : 'N/A',
                                                            `₹${expense.amount.toFixed(2)}`,
                                                            <PaymentModeBadge mode={expense.paymentMode} />
                                                        ]}
                                                        actions={[
                                                            {
                                                                label: 'Edit',
                                                                icon: <Edit size={18} className="mr-2" />,
                                                                onClick: () => handleEdit(expense),
                                                            },
                                                            {
                                                                label: 'Delete',
                                                                icon: <Trash2 size={18} className="mr-2" />,
                                                                onClick: () => handleDelete(expense._id),
                                                            },
                                                        ]}
                                                    />
                                                ))
                                            )}
                                        </Table>

                                        {/* Pagination */}
                                        {totalPages > 0 && (
                                            <PaginationWrapper
                                                count={totalPages}
                                                page={currentPage}
                                                total={total}
                                                from={(currentPage - 1) * limit + 1}
                                                to={Math.min(currentPage * limit, total)}
                                                onChange={(_, page) => setCurrentPage(page)}
                                            />
                                        )}
                                    </>
                                )}
                            </div>

                            <Modal
                                isOpen={isAddModalOpen || isEditModalOpen}
                                onClose={() => {
                                    setIsAddModalOpen(false);
                                    setIsEditModalOpen(false);
                                    resetForm();
                                }}
                                title={editingExpense ? 'Edit Expense' : 'Add New Expense'}
                            >
                                <form onSubmit={handleSubmit} className="p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Category <span className="text-red-500">*</span>
                                            </label>
                                            <CustomSelectDropdown
                                                value={formData.expenseCategory}
                                                options={categories.map(cat => ({ value: cat._id, label: cat.title }))}
                                                onChange={(value) => handleFormChange('expenseCategory', value)}
                                                placeholder="Select Category"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Total Amount <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={formData.amount}
                                                onChange={e => handleFormChange('amount', e.target.value)}
                                                required
                                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-600"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Expense Date</label>
                                            <DateInput
                                                label=""
                                                value={formData.expenseDate}
                                                onChange={date => handleFormChange('expenseDate', date)}
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                            <textarea
                                                value={formData.description}
                                                onChange={e => handleFormChange('description', e.target.value)}
                                                rows={2}
                                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-600"
                                            />
                                        </div>

                                        <div>
                                            <SearchableDropdown
                                                label="Payment Mode"
                                                value={formData.paymentMode ? { id: formData.paymentMode, name: formData.paymentMode } : null}
                                                options={paymentModes.map(mode => ({ id: mode, name: mode }))}
                                                onChange={(_, value) => handleFormChange('paymentMode', value?.id || '')}
                                                placeholder="Select Payment Mode"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                                            <DateInput
                                                label=""
                                                value={formData.paymentDate}
                                                onChange={date => handleFormChange('paymentDate', date)}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Due Date</label>
                                            <DateInput
                                                label=""
                                                value={formData.paymentDueDate}
                                                onChange={date => handleFormChange('paymentDueDate', date)}
                                            />
                                        </div>

                                        {/* Custom Fields Section */}
                                        <div className="md:col-span-2 border-t border-gray-200 pt-4 mt-2">
                                            <div className="flex justify-between items-center mb-3">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    Custom Fields (Optional)
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={addCustomField}
                                                    className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800"
                                                >
                                                    <Plus size={16} />
                                                    Add Field
                                                </button>
                                            </div>

                                            {formData.customFields.length > 0 && (
                                                <div className="space-y-2">
                                                    {formData.customFields.map((field, index) => (
                                                        <div key={index} className="grid grid-cols-5 gap-2 items-start">
                                                            <div className="col-span-2">
                                                                <input
                                                                    type="text"
                                                                    value={field.key}
                                                                    onChange={e => updateCustomField(index, 'key', e.target.value)}
                                                                    placeholder="Field Name"
                                                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                                                                />
                                                            </div>
                                                            <div className="col-span-2">
                                                                <input
                                                                    type="text"
                                                                    value={field.value}
                                                                    onChange={e => updateCustomField(index, 'value', e.target.value)}
                                                                    placeholder="Value"
                                                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                                                                />
                                                            </div>
                                                            <div className="flex justify-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeCustomField(index)}
                                                                    className="text-red-600 hover:text-red-800 p-1"
                                                                >
                                                                    <X size={18} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {formData.customFields.length === 0 && (
                                                <p className="text-sm text-gray-500 italic">
                                                    No custom fields added. Click "Add Field" to add expense-specific details like transport info, invoice numbers, etc.
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 mt-6">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsAddModalOpen(false);
                                                setIsEditModalOpen(false);
                                                resetForm();
                                            }}
                                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-gray-900"
                                        >
                                            {editingExpense ? 'Update' : 'Create'} Expense
                                        </button>
                                    </div>
                                </form>
                            </Modal>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MonthlyExpenseList;
