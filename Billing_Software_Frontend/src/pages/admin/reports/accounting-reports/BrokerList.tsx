import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import axios from 'axios';
import Constants from '@constants/api';
import { toast } from 'react-toastify';
import { useDebounce } from '@hooks/useDebounce';
import { PlusCircle, Pencil, Upload, Trash2 } from 'lucide-react';
import Modal from '@components/admin/Modal';
import DeleteConfirmationModal from '@components/admin/DeleteConfirmationModal';
import Table from "@components/admin/Table";
import TableRow from "@components/admin/TableRow";
import CustomCheckbox from "@components/admin/CustomCheckbox";
import PaginationWrapper from "@components/admin/PaginationWrapper";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import CustomSelectDropdown from '@components/admin/CustomSelectDropdown';
import SmartDropdown from '@components/admin/SmartDropdown';

interface FormData {
    name: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    country: string;
    commissionType: 'Percentage' | 'Fixed';
    commissionValue: string;
}

const BrokerList: React.FC = () => {
    const navigate = useNavigate();
    const { token } = useSelector((state: RootState) => state.auth);


    // Main List State (Aggregated)
    const [brokers, setBrokers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [brokerToDelete, setBrokerToDelete] = useState<any | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    const [isAllSelected, setIsAllSelected] = useState(false);

    // Modal & Detail State
    const [isBrokerModalOpen, setIsBrokerModalOpen] = useState(false);

    // We only need Master fields here now
    const [editingBroker, setEditingBroker] = useState<{ name: string, phone: string, address?: string, city?: string, state?: string, country?: string, _id?: string } | null>(null);

    // Search and Pagination State
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const allSelected = isAllSelected;
    const handleToggleSelectAll = (checked: boolean) => {
        setSelectedIds(checked ? brokers.map((broker) => broker._id) : []);
        setIsAllSelected(checked);
    };
    const handleRowSelect = (id: string, checked: boolean) => {
        if (isAllSelected) {
            setIsAllSelected(false);
        }
        setSelectedIds((prev) =>
            checked ? Array.from(new Set([...prev, id])) : prev.filter((itemId) => itemId !== id)
        );
    };
    const [limit, setLimit] = useState(10);
    // Debounce search
    const [debouncedSearch, setDebouncedSearch] = useState('');

    const [formData, setFormData] = useState<FormData>({
        name: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        country: '',
        commissionType: 'Percentage',
        commissionValue: '',
    });
    const [countryOptions, setCountryOptions] = useState<{ id: string; name: string }[]>([]);
    const [stateOptions, setStateOptions] = useState<{ id: string; name: string }[]>([]);
    const [cityOptions, setCityOptions] = useState<{ id: string; name: string }[]>([]);
    const [countrySearchKeyword, setCountrySearchKeyword] = useState('');
    const [stateSearchKeyword, setStateSearchKeyword] = useState('');
    const [citySearchKeyword, setCitySearchKeyword] = useState('');
    const debouncedCountrySearch = useDebounce(countrySearchKeyword, 300);
    const debouncedStateSearch = useDebounce(stateSearchKeyword, 300);
    const debouncedCitySearch = useDebounce(citySearchKeyword, 300);
    const [selectedCountryId, setSelectedCountryId] = useState<string>('');
    const [selectedStateId, setSelectedStateId] = useState<string>('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        fetchBrokers();
    }, [debouncedSearch]); // Refetch when search changes

    useEffect(() => {
        const fetchCountries = async () => {
            try {
                const response = await axios.get(Constants.FETCH_COUNTRIES_URL, {
                    params: { search: debouncedCountrySearch },
                    headers: { Authorization: `Bearer ${token}` },
                });
                const formatted = (response.data || []).map((country: any) => ({
                    id: country._id,
                    name: country.name,
                }));
                setCountryOptions(formatted);
            } catch {
                setCountryOptions([]);
            }
        };
        fetchCountries();
    }, [debouncedCountrySearch, token]);

    useEffect(() => {
        if (!selectedCountryId) {
            setStateOptions([]);
            return;
        }
        const fetchStates = async () => {
            try {
                const response = await axios.get(`${Constants.FETCH_STATES_URL}/${selectedCountryId}`, {
                    params: { search: debouncedStateSearch },
                    headers: { Authorization: `Bearer ${token}` },
                });
                const formatted = (response.data || []).map((state: any) => ({
                    id: String(state._id),
                    name: state.name,
                }));
                setStateOptions(formatted);
            } catch {
                setStateOptions([]);
            }
        };
        fetchStates();
    }, [debouncedStateSearch, selectedCountryId, token]);

    useEffect(() => {
        if (!selectedStateId) {
            setCityOptions([]);
            return;
        }
        const fetchCities = async () => {
            try {
                const response = await axios.get(`${Constants.FETCH_CITIES_URL}/${selectedStateId}`, {
                    params: { search: debouncedCitySearch },
                    headers: { Authorization: `Bearer ${token}` },
                });
                const formatted = (response.data || []).map((city: any) => ({
                    id: String(city._id),
                    name: city.name,
                }));
                setCityOptions(formatted);
            } catch {
                setCityOptions([]);
            }
        };
        fetchCities();
    }, [debouncedCitySearch, selectedStateId, token]);

    useEffect(() => {
        if (!formData.country || countryOptions.length === 0) return;
        const match = countryOptions.find(c => c.name === formData.country);
        if (match && match.id !== selectedCountryId) {
            setSelectedCountryId(match.id);
        }
    }, [formData.country, countryOptions, selectedCountryId]);

    useEffect(() => {
        if (!formData.state || stateOptions.length === 0) return;
        const match = stateOptions.find(s => s.name === formData.state);
        if (match && match.id !== selectedStateId) {
            setSelectedStateId(match.id);
        }
    }, [formData.state, stateOptions, selectedStateId]);


    const fetchBrokers = async () => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams();
            queryParams.append('aggregated', 'true');
            if (debouncedSearch) queryParams.append('search', debouncedSearch);

            const response = await axios.get(`${Constants.GET_BROKERS_URL}?${queryParams.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setBrokers(response.data.brokers || []);
        } catch (error: any) {
            toast.error('Error fetching broker list');
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };


    // --- Handlers ---

    const handleEditBroker = (brokerAgg: any) => {
        setEditingBroker({
            name: brokerAgg.name,
            phone: brokerAgg.phone,
            address: brokerAgg.address || '',
            city: brokerAgg.city || '',
            state: brokerAgg.state || '',
            country: brokerAgg.country || ''
        });
        setFormData(prev => ({
            ...prev,
            name: brokerAgg.name,
            phone: brokerAgg.phone,
            address: brokerAgg.address || '',
            city: brokerAgg.city || '',
            state: brokerAgg.state || '',
            country: brokerAgg.country || '',
            commissionType: brokerAgg.commissionType || 'Percentage',
            commissionValue: brokerAgg.commissionValue || ''
        }));
        setCountrySearchKeyword(brokerAgg.country || '');
        setStateSearchKeyword(brokerAgg.state || '');
        setCitySearchKeyword(brokerAgg.city || '');
        setIsBrokerModalOpen(true);
    };

    const handleAddNewBroker = () => {
        setEditingBroker(null);
        resetForm();
        setCountrySearchKeyword('');
        setStateSearchKeyword('');
        setCitySearchKeyword('');
        setSelectedCountryId('');
        setSelectedStateId('');
        setIsBrokerModalOpen(true);
    };

    const handleViewDeals = (brokerAgg: any) => {
        // Navigate to the new deals page - using Broker ID (_id)
        if (!brokerAgg._id) {
            toast.error("Invalid broker information");
            return;
        }
        navigate(`/admin/reports/view-broker-deals/${brokerAgg._id}`);
    };

    const handleDeleteBroker = async (brokerAgg: any) => {
        if (!brokerAgg?._id) {
            toast.error("Invalid broker information");
            return;
        }
        setBrokerToDelete(brokerAgg);
        setShowDeleteModal(true);
    };

    const confirmDeleteBroker = async () => {
        if (!brokerToDelete?._id) return;
        try {
            setIsDeleting(true);
            await axios.delete(`${Constants.DELETE_BROKER_MASTER_URL}/${brokerToDelete._id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            toast.success("Broker deleted permanently");
            setShowDeleteModal(false);
            setBrokerToDelete(null);
            fetchBrokers();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || "Error deleting broker");
        } finally {
            setIsDeleting(false);
        }
    };

    const confirmBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        try {
            setIsBulkDeleting(true);
            const response = await axios.post(Constants.BULK_DELETE_BROKER_MASTER_URL, {
                ids: selectedIds
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const deletedCount = response.data?.deletedCount ?? selectedIds.length;
            const failedCount = selectedIds.length - deletedCount;
            if (failedCount > 0) {
                toast.error(`Failed to delete ${failedCount} broker(s).`);
            } else {
                toast.success(`Deleted ${deletedCount} broker(s).`);
            }
            setShowBulkDeleteModal(false);
            setSelectedIds([]);
            setIsAllSelected(false);
            fetchBrokers();
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const handleBrokerSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                name: formData.name,
                phone: formData.phone,
                previousPhone: editingBroker?.phone,
                address: formData.address,
                city: formData.city,
                state: formData.state,
                country: formData.country,
                commissionType: formData.commissionType,
                commissionValue: Number(formData.commissionValue),
                isMasterUpdate: !!editingBroker // Flag to update master info
            };

            // Using create endpoint which handles upsert/update logic for masters
            await axios.post(Constants.CREATE_BROKER_URL, payload, {
                headers: { Authorization: `Bearer ${token}` },
            });

            toast.success(editingBroker ? 'Broker details updated' : 'Broker created successfully');
            setIsBrokerModalOpen(false);
            resetForm();
            fetchBrokers();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Error saving broker');
        }
    };

    // handleDelete and handleDealSubmit removed as they are in BrokerDeals page now

    const resetForm = () => {
        // We DON'T setEditingBroker(null) here automatically, as it breaks the flow if we just close one modal
        setFormData({
            name: '',
            phone: '',
            address: '',
            city: '',
            state: '',
            country: '',
            commissionType: 'Percentage',
            commissionValue: '',
        });
    };


    // Calculate estimated commission


    // Search and Pagination Logic
    // Server side search is implemented, so we filter from the 'brokers' list which should already be filtered by server if debouncedSearch is active.
    // However, for pagination, we still paginate the 'brokers' array client side if server returns all matches.
    // Assuming backend returns ALL matches for the search query (not paginated response yet).
    const filteredBrokers = useMemo(() => {
        // If we relied purely on server side, we just return 'brokers'.
        // But let's keep it safe. If search is empty, return all (which is brokers).
        return brokers;
    }, [brokers]);

    const paginatedBrokers = useMemo(() => {
        const start = (page - 1) * limit;
        return filteredBrokers.slice(start, start + limit);
    }, [filteredBrokers, page, limit]);

    const totalPages = Math.ceil(filteredBrokers.length / limit);
    const from = (page - 1) * limit + 1;
    const to = Math.min(page * limit, filteredBrokers.length);

    // Columns for MAIN Table (Aggregated)
    const mainTableHeaders = [
        "#",
        <CustomCheckbox
            checked={allSelected}
            onChange={handleToggleSelectAll}
            disabled={brokers.length === 0}
            name="select-all-brokers"
        />,
        "Broker Name",
        "Phone",
        "Total Purchases Deals",
        "Actions",
    ];

    const getMainTableActions = () => {
        return [
            {
                label: 'Edit Broker',
                icon: <Pencil size={16} />,
                onClick: (row: any) => handleEditBroker(row)
            },
            {
                label: 'View Deals', // New Action
                icon: <PlusCircle size={16} />,
                onClick: (row: any) => handleViewDeals(row)
            },
            {
                label: 'Delete Broker',
                icon: <Trash2 size={16} />,
                onClick: (row: any) => handleDeleteBroker(row)
            }
        ];
    };

    // Columns for HISTORY Table (Inside Modal)


    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-950">Broker Details</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setShowBulkDeleteModal(true)}
                        disabled={selectedIds.length === 0}
                        className={`px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2 ${selectedIds.length === 0
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-red-100 hover:bg-red-200 text-red-600"
                            }`}
                    >
                        <Trash2 size={14} />
                        Bulk Delete {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
                    </button>
                    <button
                        onClick={() => navigate('/admin/reports/broker-details/import')}
                        className="border border-gray-100 bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2"
                    >
                        <Upload size={14} />
                        Upload Excel
                    </button>
                    <button
                        onClick={handleAddNewBroker}
                        className="bg-primary hover:bg-gray-950 text-white px-2 py-1 rounded-md shadow cursor-pointer flex items-center gap-2"
                    >
                        <PlusCircle size={14} />
                        Add Broker
                    </button>
                </div>
            </div>

            {/* Search and Limit */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1); // Reset to first page on search
                    }}
                    className="border border-gray-300 rounded-md px-4 py-2 w-full md:w-64 text-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <select
                    value={limit}
                    onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1); // Reset to first page on limit change
                    }}
                    className="border border-gray-300 px-3 py-2 rounded-md bg-white text-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent w-full md:w-auto"
                >
                    {[10, 25, 50].map((num) => (
                        <option className="text-gray-950" key={num} value={num}>{num} / page</option>
                    ))}
                </select>
            </div>

            <div className="w-full overflow-x-auto">
                <Table headers={mainTableHeaders}>
                    {!loading && paginatedBrokers.map((broker, index) => (
                        <TableRow
                            key={broker._id || index} // _id is phone number here
                            index={(page - 1) * limit + index + 1}
                            row={broker}
                            columns={[
                                <CustomCheckbox
                                    checked={selectedIds.includes(broker._id)}
                                    onChange={(checked) => handleRowSelect(broker._id, checked)}
                                    name={`select-broker-${broker._id}`}
                                />,
                                <span className="font-medium text-gray-900">{broker.name}</span>,
                                <span className="text-gray-900">{broker.phone}</span>,
                                <span className="font-medium text-gray-900">{broker.totalDeals}</span>,
                            ]}
                            actions={getMainTableActions()}
                        />
                    ))}

                    {!loading && paginatedBrokers.length === 0 && (
                        <tr>
                            <td colSpan={6} className="text-center py-4 text-gray-950 font-semibold">
                                No broker records found
                            </td>
                        </tr>
                    )}

                    {loading && (
                        <tr key="table-loader">
                            <td className="text-center py-2 text-gray-950 font-semibold" colSpan={6}>
                                <LoaderSpinner />
                            </td>
                        </tr>
                    )}
                </Table>
            </div>

            <PaginationWrapper
                count={totalPages}
                page={page}
                from={from}
                to={to}
                total={filteredBrokers.length}
                onChange={(_, newPage) => setPage(newPage)}
                paginationVariant="outlined"
                paginationShape="rounded"
            />
            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setBrokerToDelete(null);
                }}
                onConfirm={confirmDeleteBroker}
                isDeleting={isDeleting}
                title="Confirm Deletion"
                message="Are you sure you want to delete this broker? This will permanently delete the broker and all deals."
            />
            <DeleteConfirmationModal
                isOpen={showBulkDeleteModal}
                onClose={() => setShowBulkDeleteModal(false)}
                onConfirm={confirmBulkDelete}
                isDeleting={isBulkDeleting}
                title="Confirm Bulk Deletion"
                message={`Are you sure you want to delete ${selectedIds.length} broker(s)?`}
            />

            <Modal
                isOpen={isBrokerModalOpen}
                onClose={() => setIsBrokerModalOpen(false)}
                title={editingBroker ? "Edit Broker Details" : "Add New Broker"}
                size="md"
            >
                <div className="p-6">
                    <form onSubmit={handleBrokerSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Broker Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text" value={formData.name}
                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    required
                                    placeholder="Enter broker name"
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600 placeholder:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Broker Phone <span className="text-red-500">*</span></label>
                                <input
                                    type="tel" value={formData.phone}
                                    onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                    required
                                    placeholder="Enter phone number"
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600 placeholder:text-sm"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                                <SmartDropdown
                                    items={countryOptions}
                                    value={countrySearchKeyword}
                                    onChange={setCountrySearchKeyword}
                                    onSelect={(item) => {
                                        const selected = item as { id: string; name: string } | null;
                                        const countryId = selected?.id || '';
                                        setSelectedCountryId(countryId);
                                        setSelectedStateId('');
                                        setStateOptions([]);
                                        setCityOptions([]);
                                        setStateSearchKeyword('');
                                        setCitySearchKeyword('');
                                        setFormData(prev => ({
                                            ...prev,
                                            country: selected?.name || '',
                                            state: '',
                                            city: ''
                                        }));
                                    }}
                                    placeholder="Type to search country"
                                    selectedItem={countryOptions.find(c => c.name === formData.country) || null}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                <SmartDropdown
                                    items={stateOptions}
                                    value={stateSearchKeyword}
                                    onChange={setStateSearchKeyword}
                                    onSelect={(item) => {
                                        const selected = item as { id: string; name: string } | null;
                                        const stateId = selected?.id || '';
                                        setSelectedStateId(stateId);
                                        setCityOptions([]);
                                        setCitySearchKeyword('');
                                        setFormData(prev => ({
                                            ...prev,
                                            state: selected?.name || '',
                                            city: ''
                                        }));
                                    }}
                                    placeholder="Type to search state"
                                    selectedItem={stateOptions.find(s => s.name === formData.state) || null}
                                    disabled={!selectedCountryId}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                <SmartDropdown
                                    items={cityOptions}
                                    value={citySearchKeyword}
                                    onChange={setCitySearchKeyword}
                                    onSelect={(item) => {
                                        const selected = item as { id: string; name: string } | null;
                                        setFormData(prev => ({ ...prev, city: selected?.name || '' }));
                                    }}
                                    placeholder="Type to search city"
                                    selectedItem={cityOptions.find(c => c.name === formData.city) || null}
                                    disabled={!selectedStateId}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                            <input
                                type="text"
                                value={formData.address}
                                onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                placeholder="Enter address"
                                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600 placeholder:text-sm"
                            />
                        </div>

                        <div className="border-t pt-4 mt-2">
                            <h4 className="text-sm font-semibold mb-3">Commission Settings</h4>
                            <div className="grid grid-cols-2 gap-4 flex items-center">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                                    <CustomSelectDropdown
                                        value={formData.commissionType}
                                        onChange={(val) => setFormData(prev => ({ ...prev, commissionType: val as any }))}
                                        options={[
                                            { value: 'Percentage', label: 'Percentage' },
                                            { value: 'Fixed', label: 'Fixed' }
                                        ]}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Default Value</label>
                                    <input
                                        type="number" step="0.01" value={formData.commissionValue}
                                        onChange={e => setFormData(prev => ({ ...prev, commissionValue: e.target.value }))}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-purple-600 placeholder:text-sm"
                                        placeholder="e.g. 10"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button type="button" onClick={() => setIsBrokerModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md mr-2">Cancel</button>
                            <button type="submit" className="bg-primary text-white px-4 py-2 rounded-md hover:bg-gray-900">
                                {editingBroker ? 'Update Broker' : 'Create Broker'}
                            </button>
                        </div>
                    </form>
                </div>
            </Modal>

        </div>
    );
};

export default BrokerList;
