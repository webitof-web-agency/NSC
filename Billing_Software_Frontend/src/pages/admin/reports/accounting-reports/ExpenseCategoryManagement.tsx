import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import axios from 'axios';
import Constants from '@constants/api';
import { toast } from 'react-toastify';
import { PlusCircle, Trash2, Edit } from 'lucide-react';
import Modal from '@components/admin/Modal';
import Table from '@components/admin/Table';
import TableRow from '@components/admin/TableRow';
import PaginationWrapper from '@components/admin/PaginationWrapper';

interface ExpenseCategory {
    _id: string;
    title: string;
    description: string;
    status: boolean;
    createdAt: string;
}

interface FormData {
    title: string;
    description: string;
    status: boolean;
}

const ExpenseCategoryManagement: React.FC = () => {
    const { token } = useSelector((state: RootState) => state.auth);

    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [limit, setLimit] = useState(10);

    // Search filter
    const [searchTerm, setSearchTerm] = useState('');

    const [formData, setFormData] = useState<FormData>({
        title: '',
        description: '',
        status: true,
    });

    useEffect(() => {
        fetchCategories();
    }, [currentPage, searchTerm, limit]);

    const fetchCategories = async () => {
        try {
            setLoading(true);
            const params: any = {
                page: currentPage,
                limit,
                search: searchTerm,
            };

            const response = await axios.get(Constants.FETCH_EXPENSE_CATEGORIES_WITH_SEARCH_URL, {
                headers: { Authorization: `Bearer ${token}` },
                params,
            });

            if (response.data.success) {
                const categoryData = response.data.data || [];
                // Ensure each category has an _id field
                const mappedCategories = categoryData.map((cat: any) => ({
                    _id: cat._id || cat.id,
                    title: cat.title,
                    description: cat.description || '',
                    status: cat.status !== undefined ? cat.status : true,
                    createdAt: cat.createdAt || new Date().toISOString(),
                }));
                const purchaseCategoryPattern = /^PUR-\d+$/i;
                setCategories(mappedCategories.filter((cat) => !purchaseCategoryPattern.test(cat.title || "")));
                setTotal(response.data.pagination?.total || mappedCategories.length);
                setTotalPages(response.data.pagination?.pages || 1);
            } else {
                setCategories([]);
                setTotal(0);
                setTotalPages(1);
            }
        } catch (error: any) {
            console.error('Error fetching categories:', error);
            toast.error('Failed to load expense categories');
            setCategories([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title.trim()) {
            toast.error('Please provide a category title');
            return;
        }

        try {
            const payload = {
                title: formData.title.trim(),
                description: formData.description.trim(),
                status: formData.status,
            };

            if (editingCategory) {
                await axios.put(
                    `${Constants.UPDATE_EXPENSE_CATEGORY_URL}/${editingCategory._id}`,
                    payload,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                toast.success('Category updated successfully');
                setIsEditModalOpen(false);
            } else {
                await axios.post(Constants.CREATE_NEW_EXPENSE_CATEGORY_URL, payload, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                toast.success('Category created successfully');
                setIsAddModalOpen(false);
            }

            resetForm();
            fetchCategories();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Error saving category');
        }
    };

    const handleEdit = (category: ExpenseCategory) => {
        setEditingCategory(category);
        setFormData({
            title: category.title,
            description: category.description || '',
            status: category.status,
        });
        setIsEditModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!id) {
            toast.error('Invalid category ID');
            return;
        }

        if (!confirm('Are you sure you want to delete this expense category?')) return;

        try {
            await axios.delete(`${Constants.DELETE_EXPENSE_CATEGORY_URL}/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            toast.success('Category deleted successfully');
            fetchCategories();
        } catch (error: any) {
            console.error('Error deleting expense category:', error);
            toast.error(error.response?.data?.message || 'Error deleting category');
        }
    };


    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            status: true,
        });
        setEditingCategory(null);
    };

    const handleFormChange = (field: keyof FormData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Expense Categories</h1>
                <button
                    onClick={() => {
                        resetForm();
                        setIsAddModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-gray-900 w-full md:w-auto justify-center"
                >
                    <PlusCircle size={20} />
                    Add Category
                </button>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="flex-1">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search by category name..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-3 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-600"
                        />
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

            <div className="w-full overflow-x-auto">
                <Table headers={['#', 'Category Name', 'Description', 'Created Date', 'Actions']}>
                    {loading ? (
                        <tr>
                            <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                                Loading...
                            </td>
                        </tr>
                    ) : categories.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                                No categories found
                            </td>
                        </tr>
                    ) : (
                        categories.map((category, idx) => (
                            <TableRow
                                key={category._id}
                                index={(currentPage - 1) * limit + idx + 1}
                                row={category}
                                columns={[
                                    category.title,
                                    category.description || '-',
                                    new Date(category.createdAt).toLocaleDateString()
                                ]}
                                actions={[
                                    {
                                        label: 'Edit',
                                        icon: <Edit size={18} className="mr-2" />,
                                        onClick: () => handleEdit(category),
                                    },
                                    {
                                        label: 'Delete',
                                        icon: <Trash2 size={18} className="mr-2" />,
                                        onClick: () => handleDelete(category._id),
                                    },
                                ]}
                            />
                        ))
                    )}
                </Table>
            </div>

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

            <Modal
                isOpen={isAddModalOpen || isEditModalOpen}
                onClose={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                    resetForm();
                }}
                title={editingCategory ? 'Edit Expense Category' : 'Add New Expense Category'}
            >
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Category Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={e => handleFormChange('title', e.target.value)}
                                required
                                placeholder="e.g., Clothes, Shipping, Transport"
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-600"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={e => handleFormChange('description', e.target.value)}
                                rows={3}
                                placeholder="Optional description for this category"
                                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-600"
                            />
                        </div>

                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="status"
                                checked={formData.status}
                                onChange={e => handleFormChange('status', e.target.checked)}
                                className="h-4 w-4 text-purple-600 focus:ring-purple-600 border-gray-300 rounded"
                            />
                            <label htmlFor="status" className="ml-2 block text-sm text-gray-900">
                                Active
                            </label>
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
                            {editingCategory ? 'Update' : 'Create'} Category
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ExpenseCategoryManagement;
