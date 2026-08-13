import { CirclePlusIcon, EditIcon, ShieldUser, Trash2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Table from "@components/admin/Table";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import Constants from "@constants/api";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import TableRow from "@components/admin/TableRow";
import PaginationWrapper from "@components/admin/PaginationWrapper";
import DeleteConfirmationModal from "@components/admin/DeleteConfirmationModal";
import Modal from "@components/admin/Modal";
import useDateFormatter from "@hooks/useDateFormatter";
import { hasPermission } from "@utils/hasPermission";
import PermissionGuard from "@components/admin/PermissionGuard";
import type { PermissionAction } from "@models/permissions";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import SubmitButton from "@components/admin/SubmitButton";
import { useDebouncedSearchParam } from "@hooks/useDebouncedSearchParam";

interface PaginationData {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

interface RoleList {
    id: string;
    roleName: string;
    status: boolean;
    hideFromAttendance: boolean;
    createdAt: string;
}

interface RoleFormData {
    roleName: string;
}

const initialFormData: RoleFormData = {
    roleName: '',
}
const RolesList: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [roles, setRoles] = useState<RoleList[]>([]);
    const [pagination, setPagination] = useState<PaginationData>({ total: 0, page: 1, limit: 10, totalPages: 1 });
    const [isRoleModalOpen, setRoleModalOpen] = useState<boolean>(false);
    const [formData, setFormData] = useState<RoleFormData>(initialFormData);
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
    const [isDeleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
    const [editItem, setEditItem] = useState<RoleList | null>(null);
    const [deleteItem, setDeleteItem] = useState<RoleList | null>(null);
    const search = searchParams.get('search') || '';
    const limit = Number(searchParams.get('limit') || 10);
    const page = Number(searchParams.get('page') || 1);
    const [searchInput, setSearchInput] = useDebouncedSearchParam({ search, limit, setSearchParams });
    const { token } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const permissions = systemSettings?.permissions || [];
    const { formatDate } = useDateFormatter();
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const navigate = useNavigate();

    const handleCreateClick = () => {
        setFormData(initialFormData);
        setEditItem(null);
        setFormErrors({});
        setRoleModalOpen(true);
    };

    const fetchRoles = useCallback(async (search?: string, limit?: number, page?: number) => {
        try {
            setIsLoading(true);
            const response = await axios.get(Constants.FETCH_ROLES_FOR_LIST_URL, {
                params: { search, limit, page },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setRoles(response.data.data.roles || []);
            setPagination(response.data.data.pagination);
        } catch {
            toast.error("Failed to fetch roles.");
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchRoles(search, limit, page);
    }, [fetchRoles, search, limit, page]);

    const handleEditClick = (item: RoleList) => {
        setFormData(item);
        setEditItem(item);
        setFormErrors({});
        setRoleModalOpen(true);
    }
    const handleSearch = (keyword: string) => {
        setSearchInput(keyword);
    };

    const handlePageLengthChange = (newLimit: number) => {
        setSearchParams({ search, limit: String(newLimit), page: '1' });
    };

    const handlePageChange = (newPage: number) => {
        setSearchParams({ search, limit: String(limit), page: String(newPage) });
    };

    const handleDeleteClick = async (item: RoleList) => {
        setDeleteItem(item);
        setDeleteModalOpen(true);
    }

    const handleConfirmDelete = async () => {
        if (deleteItem) {
            try {
                setIsDeleting(true);
                await axios.delete(`${Constants.DELETE_ROLE_URL}/${deleteItem.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                toast.success("Role deleted successfully.");
                fetchRoles(search, limit, page);
                setDeleteModalOpen(false);
            } catch (error) {
                console.error("Error deleting role:", error);
                toast.error("Failed to delete role.");
            } finally {
                setIsDeleting(false);
            }
        }
    }

    const validateForm = () => {
        const errors: { [key: string]: string } = {};
        const { roleName } = formData;
        if (!roleName.trim()) {
            errors.roleName = 'Role name is required.';
        } else if (roleName.length < 3 || roleName.length > 50) {
            errors.roleName = 'Name must be between 3-50 characters.';
        }
        setFormErrors(errors);
        return !Object.keys(errors).length;
    }
    const handleRoleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormErrors({});
        if (!validateForm()) return;
        try {
            setIsSaving(true);
            if (editItem) {
                await axios.put(`${Constants.UPDATE_ROLE_URL}/${editItem.id}`, formData, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } else {
                await axios.post(Constants.CREATE_ROLE_URL, formData, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            }
            if (editItem) {
                toast.success('Role updated successfully.');
            } else {
                toast.success('Role created successfully.');
            }
            fetchRoles(search, limit, page);
            setRoleModalOpen(false);
        } catch {
            toast.error('Failed to create role.');
        } finally {
            setIsSaving(false);
        }
    }

    const handlePermissionsClick = (item: RoleList) => {
        navigate(`/admin/roles/permissions/${item.id}`);
    }

    const handleAttendanceVisibilityToggle = async (role: RoleList) => {
        const nextValue = !role.hideFromAttendance;
        setRoles(prev => prev.map(item =>
            item.id === role.id ? { ...item, hideFromAttendance: nextValue } : item
        ));

        try {
            await axios.put(`${Constants.UPDATE_ROLE_URL}/${role.id}`, {
                hideFromAttendance: nextValue
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast.success(nextValue ? 'Role hidden from attendance.' : 'Role shown in attendance.');
        } catch {
            setRoles(prev => prev.map(item =>
                item.id === role.id ? { ...item, hideFromAttendance: role.hideFromAttendance } : item
            ));
            toast.error('Failed to update attendance visibility.');
        }
    };

    // Calculate pagination display text
    const from = (pagination.page - 1) * pagination.limit + 1;
    const to = Math.min(pagination.page * pagination.limit, pagination.total);

    const tableHeaders = ['#', 'Role Name', 'Hide Attendance', 'Created On', 'Actions'];
    const restrictedActions: PermissionAction[] = ['edit', 'delete'];
    const allowedActions = restrictedActions.filter((action) => hasPermission(permissions, 'roles-permissions', action));
    if (allowedActions.length === 0) {
        tableHeaders.pop();
    }
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-950 ">Roles</h1>
                {hasPermission(permissions, 'roles-permissions', 'create') &&
                    <button
                        onClick={() => { handleCreateClick(); }}
                        className="bg-primary hover:bg-gray-950 text-white px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2">
                        <CirclePlusIcon size={14} /> New Role
                    </button>
                }
            </div>
            {/* Search Input & PageLength */}
            <div className="flex justify-between items-center">
                <input
                    type="text"
                    placeholder="Search..."
                    value={searchInput}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="border border-gray-300 rounded-md px-4 py-2 w-full md:w-64  text-gray-950  focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <select
                    value={limit}
                    onChange={(e) => handlePageLengthChange(Number(e.target.value))}
                    className="border border-gray-300 px-3 py-2 rounded-md bg-white  text-gray-950  focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                >
                    {[10, 25, 50].map((num) => (
                        <option className="text-gray-950 " key={num} value={num}>{num} / page</option>
                    ))}
                </select>
            </div>
            {/* Table */}
            <Table headers={tableHeaders}>
                {!isLoading && roles && roles.map((role: RoleList, index: number) => (
                    <TableRow
                        key={role.id}
                        index={index + 1}
                        row={role}
                        columns={[
                            <span className="text-indigo-600">{role.roleName}</span>,
                            <PermissionGuard moduleSlug="roles-permissions" action="edit">
                                <button
                                    type="button"
                                    onClick={() => handleAttendanceVisibilityToggle(role)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${role.hideFromAttendance ? 'bg-primary' : 'bg-gray-300'}`}
                                    aria-pressed={role.hideFromAttendance}
                                    title={role.hideFromAttendance ? 'Hidden from attendance' : 'Shown in attendance'}
                                >
                                    <span
                                        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${role.hideFromAttendance ? 'translate-x-5' : 'translate-x-1'}`}
                                    />
                                </button>
                            </PermissionGuard>,
                            formatDate(role.createdAt, systemSettings?.dateFormat.format || "d-y-m"),
                            allowedActions.length > 0 ? (
                                <div className="flex gap-3">
                                    {/* {role.roleName !== "Staff" && ( */}
                                        <PermissionGuard moduleSlug="roles-permissions" action="edit">
                                            {role.roleName.toLowerCase() !== 'staff' && (
                                                <button
                                                    onClick={() => handleEditClick(role)}
                                                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-sm border border-gray-300 hover:bg-gray-100 hover:text-gray-950 transition-colors cursor-pointer"
                                                >
                                                    <EditIcon size={16} />
                                                    Edit Role
                                                </button>
                                            )}
                                        </PermissionGuard>
                                    {/* )} */}

                                    {/* {role.roleName !== "Staff" && ( */}
                                        <PermissionGuard moduleSlug="roles-permissions" action="delete">
                                            {role.roleName.toLowerCase() !== 'staff' && (
                                                <button
                                                    onClick={() => handleDeleteClick(role)}
                                                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-sm border border-gray-300 hover:bg-gray-100 hover:text-gray-950 transition-colors cursor-pointer"
                                                >
                                                    <Trash2 size={16} />
                                                    Delete Role
                                                </button>
                                            )}
                                        </PermissionGuard>
                                    {/* )} */}

                                    <PermissionGuard moduleSlug="roles-permissions" action="edit">
                                        <button
                                            onClick={() => handlePermissionsClick(role)}
                                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-sm border border-gray-300 hover:bg-gray-100 hover:text-gray-950 transition-colors cursor-pointer"
                                        >
                                            <ShieldUser size={16} />
                                            Permissions
                                        </button>
                                    </PermissionGuard>
                                </div>
                            ) : null,
                        ].filter(Boolean)}
                    />
                ))}

                {!isLoading && !roles.length &&
                    <tr>
                        <td colSpan={8} className="text-center text-gray-950  py-2 font-semibold">No Roles Found</td>
                    </tr>
                }

                {isLoading && (
                    <tr key="table-loader">
                        <td className="text-center py-2 text-gray-950  font-semibold" colSpan={8}>
                            <LoaderSpinner />
                        </td>
                    </tr>
                )}
            </Table>

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

            <Modal isOpen={isRoleModalOpen} onClose={() => setRoleModalOpen(false)} title={editItem ? 'Edit Role' : 'New Role'}>
                <form onSubmit={handleRoleFormSubmit}>
                    <div className="flex">
                        <div className="w-full mr-4">
                            <label className="block text-gray-600 font-semibold mb-2">Role Name <em className="text-red-500 text-sm">*</em></label>
                            <input
                                type="text"
                                value={formData.roleName}
                                onChange={(e) => setFormData({ ...formData, roleName: e.target.value })}
                                className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600"
                            />
                            {formErrors.roleName && <span className="text-red-500 text-sm">{formErrors.roleName}</span>}
                        </div>
                    </div>
                    {/* submit */}
                    <div className="flex justify-end mt-4">
                        <button
                            type="button"
                            onClick={() => setRoleModalOpen(false)}
                            className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-md shadow cursor-pointer mr-2"
                        >
                            Cancel
                        </button>
                        <SubmitButton isDisabled={isSaving} isLoading={isSaving} mode={editItem ? "edit" : "create"} />
                    </div>
                </form>
            </Modal>
            <DeleteConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                isDeleting={isDeleting}
                title="Delete Role"
                message="Are you sure you want to delete this role? This action cannot be undone."
            />
        </div>
    );
}

export default RolesList;
