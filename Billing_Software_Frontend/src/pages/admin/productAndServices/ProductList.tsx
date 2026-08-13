import { useEffect, useState } from "react";
import type { FC, ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Constants from "@constants/api";
import axios from "axios";
import Table from "@components/admin/Table";
import PaginationWrapper from "@components/admin/PaginationWrapper";
import { CirclePlusIcon, Edit, Trash2Icon, Upload, Download } from "lucide-react";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import TableRow from "@components/admin/TableRow";
import DeleteConfirmationModal from "@components/admin/DeleteConfirmationModal";
import CustomCheckbox from "@components/admin/CustomCheckbox";
import type { PermissionAction } from "@models/permissions";
import { hasPermission } from "@utils/hasPermission";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import type { RootState } from "@store/index";
import SupplierProfileCard from "@components/SupplierProfileImage";

interface Brand {
    _id: string;
    brand_name: string;
}

interface Category {
    _id: string;
    category_name: string;
}

interface Product {
    _id: string;
    name?: string;
    code: string;
    status: boolean;
    brand: Brand | null;
    category: Category | null;
}

interface ProductPagination {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

const ProductList: FC = () => {
    const navigate = useNavigate();
    const { token } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const permissions = systemSettings?.permissions || [];
    const [searchParams, setSearchParams] = useSearchParams();

    const [products, setProducts] = useState<Product[]>([]);
    const [pagination, setPagination] = useState<ProductPagination>({ total: 0, page: 1, limit: 10, totalPages: 1 });
    const [itemToDelete, setItemToDelete] = useState<Product | null>(null);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);

    const search = searchParams.get('search') || '';
    const limit = Number(searchParams.get('limit') || 10);
    const page = Number(searchParams.get('page') || 1);
    const [searchInput, setSearchInput] = useState<string>(search);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const fetchProducts = async (search?: string, limit?: number, page?: number, signal?: AbortSignal) => {
        try {
            setIsLoading(true);
            const response = await axios.get(Constants.FETCH_PRODUCTS_URL, {
                params: { search, limit, page },
                headers: { 'Authorization': `Bearer ${token}` },
                signal
            });
            const uniqueProducts = Array.from(
                new Map((response.data.data.products || []).map((product: Product) => [product._id, product])).values()
            ) as Product[];
            setProducts(uniqueProducts);
            setPagination(response.data.data.pagination);
        } catch (error) {
            if (axios.isCancel(error)) return;
            console.error("Error fetching products:", error);
            toast.error("Failed to fetch products.");
        } finally {
            if (!signal?.aborted) {
                setIsLoading(false);
            }
        }
    };

    useEffect(() => {
        const controller = new AbortController();
        fetchProducts(search, limit, page, controller.signal);
        return () => controller.abort();
    }, [search, limit, page, token]);

    useEffect(() => {
        setSearchInput(search);
    }, [search]);

    useEffect(() => {
        if (searchInput === search) return;

        const timeout = window.setTimeout(() => {
            setSearchParams({ search: searchInput, limit: String(limit), page: '1' });
        }, 350);

        return () => window.clearTimeout(timeout);
    }, [searchInput, search, limit, setSearchParams]);

    const handleSearch = (keyword: string) => {
        setSearchInput(keyword);
    };

    const handlePageLengthChange = (newLimit: number) => {
        setSearchParams({ search, limit: String(newLimit), page: '1' });
    };

    const handlePageChange = (newPage: number) => {
        setSearchParams({ search, limit: String(limit), page: String(newPage) });
    };

    const allSelected = products.length > 0 && products.every(product => selectedIds.includes(product._id));

    const handleToggleSelectAll = (checked: boolean) => {
        if (!checked) {
            setSelectedIds(prev => prev.filter(id => !products.some(p => p._id === id)));
        } else {
            const newIds = new Set(selectedIds);
            products.forEach(p => newIds.add(p._id));
            setSelectedIds(Array.from(newIds));
        }
    };
    const handleRowSelect = (id: string, checked: boolean) => {
        setSelectedIds((prev) =>
            checked ? Array.from(new Set([...prev, id])) : prev.filter((itemId) => itemId !== id)
        );
    };

    const handleEditClick = (product: Product) => {
        navigate(`/admin/products/edit/${product._id}`);
    };

    const handleDeleteClick = (product: Product) => {
        setItemToDelete(product);
        setDeleteModalOpen(true);
    };

    const tableActions = [
        {
            label: 'Edit',
            icon: <Edit size={14} />,
            onClick: (item: Product) => { handleEditClick(item) }
        },
        {
            label: 'Delete',
            icon: <Trash2Icon size={14} />,
            onClick: (item: Product) => { handleDeleteClick(item) }
        }
    ]
    const restrictedActions = ['edit', 'delete'];
    const allowedActions = tableActions.filter((action) => {
        const actionKey = action.label.toLowerCase() as PermissionAction;

        if (!restrictedActions.includes(actionKey)) {
            return true;
        }

        return hasPermission(permissions, 'product-services', actionKey);
    });

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            setIsDeleting(true);
            await axios.delete(`${Constants.DELETE_PRODUCT_URL}/${itemToDelete._id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            toast.success('Product deleted successfully');
            fetchProducts(search, limit, page);
            setDeleteModalOpen(false);
            setItemToDelete(null);
        } catch (error) {
            console.error('Failed to delete product:', error);
            toast.error('Failed to delete product.');
        } finally {
            setIsDeleting(false);
        }
    };

    const confirmBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        try {
            setIsBulkDeleting(true);
            const response = await axios.post(Constants.BULK_DELETE_PRODUCT_URL, {
                ids: selectedIds
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const deletedCount = response.data?.deletedCount ?? selectedIds.length;
            const failedCount = selectedIds.length - deletedCount;
            if (failedCount > 0) {
                toast.error(`Failed to delete ${failedCount} product(s).`);
            } else {
                toast.success(`Deleted ${deletedCount} product(s).`);
            }
            setShowBulkDeleteModal(false);
            setSelectedIds([]);
            fetchProducts(search, limit, page);
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const handleExportClick = async () => {
        try {
            const exportSelectedOnly = selectedIds.length > 0;
            const response = await axios.get(Constants.EXPORT_PRODUCTS_EXCEL_URL, {
                params: exportSelectedOnly
                    ? { ids: selectedIds.join(',') }
                    : { search },
                headers: { 'Authorization': `Bearer ${token}` },
                responseType: 'blob'
            });

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const today = new Date().toISOString().split('T')[0];
            link.download = `Products_Export_${today}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast.success(selectedIds.length > 0 ? 'Selected products exported successfully!' : 'Products exported successfully!');
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Failed to export products');
        }
    };

    const from = (pagination.page - 1) * pagination.limit + 1;
    const to = Math.min(pagination.page * pagination.limit, pagination.total);

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-950 ">Products</h1>
                <div className="flex flex-wrap gap-2">
                    {hasPermission(permissions, 'product-services', 'delete') && (
                        <button
                            onClick={() => setShowBulkDeleteModal(true)}
                            disabled={selectedIds.length === 0}
                            className={`px-3 py-1.5 rounded-md shadow-sm cursor-pointer flex items-center gap-2 ${selectedIds.length === 0
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-red-100 hover:bg-red-200 text-red-600"
                                }`}
                        >
                            <Trash2Icon size={14} /> Bulk Delete {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
                        </button>
                    )}
                    {hasPermission(permissions, 'product-services', 'create') && (
                        <>
                            <button
                                onClick={handleExportClick}
                                className="bg-emerald-100 hover:bg-emerald-200 text-emerald-600 px-3 py-1.5 rounded-md shadow-sm cursor-pointer flex items-center gap-2"
                            >
                                <Download size={16} /> {selectedIds.length > 0 ? `Export Selected (${selectedIds.length})` : 'Export Excel'}
                            </button>
                            <button
                                onClick={() => navigate('/admin/products/bulk-upload')}
                                className="border border-gray-100 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md shadow-sm cursor-pointer flex items-center gap-2"
                            >
                                <Upload size={16} /> Upload Excel
                            </button>
                            <button
                                onClick={() => navigate('/admin/products/new')}
                                className="bg-primary hover:bg-gray-950 text-white px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2"
                            >
                                <CirclePlusIcon size={14} /> New Product
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex flex-col md:flex-row justify-between gap-4">
                <input
                    type="text"
                    placeholder="Search by brand, category..."
                    value={searchInput}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
                    className="border border-gray-300 rounded-md px-4 py-2 w-full md:w-1/3    focus:outline-none focus:ring-2 focus:ring-purple-600 text-gray-950"
                />
                <select
                    value={limit}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => handlePageLengthChange(Number(e.target.value))}
                    className="border border-gray-300 px-3 py-2 rounded-md bg-white  text-gray-950   focus:outline-none focus:ring-2 focus:ring-purple-600 w-full md:w-auto"
                >
                    {[10, 25, 50].map((num) => <option key={num} value={num}>{num} / page</option>)}
                </select>
            </div>

            <div className="w-full overflow-x-auto">
                <Table
                    headers={[
                        "#",
                        <CustomCheckbox
                            checked={allSelected}
                            onChange={handleToggleSelectAll}
                            disabled={products.length === 0}
                            name="select-all-products"
                        />,
                        "Brand",
                        "Category",
                        ...(allowedActions.length > 0 ? ["Actions"] : [])
                    ]}
                >
                    {!isLoading && products && products.map((product, index) => (
                        <TableRow
                            key={product._id}
                            index={index + 1}
                            row={product}
                            columns={[
                                <CustomCheckbox
                                    checked={selectedIds.includes(product._id)}
                                    onChange={(checked) => handleRowSelect(product._id, checked)}
                                    name={`select-product-${product._id}`}
                                />,
                                <p className="capitalize">{product.brand?.brand_name || 'N/A'}</p>,
                                <p className="capitalize">{product.category?.category_name || 'N/A'}</p>,
                            ]}
                            actions={allowedActions.length > 0 ? allowedActions : undefined}
                        />
                    ))
                    }
                    {!isLoading && products.length === 0 && <tr><td colSpan={allowedActions.length > 0 ? 5 : 4} className="text-center py-4">No products found.</td></tr>}

                    {isLoading && (
                        <tr key="table-loader">
                            <td className="text-center py-2 text-gray-950  font-semibold" colSpan={allowedActions.length > 0 ? 5 : 4}>
                                <LoaderSpinner />
                            </td>
                        </tr>
                    )}
                </Table>
            </div>
            <div className="sticky bottom-0 z-10 flex items-center justify-between rounded-md border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-sm">
                <span>Total Products</span>
                <span>{pagination.total}</span>
            </div>

            <PaginationWrapper
                count={pagination.totalPages}
                page={page}
                from={from}
                to={to}
                total={pagination.total}
                onChange={(_, newPage) => handlePageChange(newPage)}
                paginationVariant="outlined"
                paginationShape="rounded"
            />
            <DeleteConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Confirm Deletion"
                message="Are you sure you want to delete this product?"
                isDeleting={isDeleting}
            >
            </DeleteConfirmationModal>
            <DeleteConfirmationModal
                isOpen={showBulkDeleteModal}
                onClose={() => setShowBulkDeleteModal(false)}
                onConfirm={confirmBulkDelete}
                title="Confirm Bulk Deletion"
                message={`Are you sure you want to delete ${selectedIds.length} product(s)?`}
                isDeleting={isBulkDeleting}
            >
            </DeleteConfirmationModal>

        </div >
    );
};

export default ProductList;
