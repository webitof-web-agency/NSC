import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import axios from 'axios';
import Constants from '@constants/api';
import { toast } from 'react-toastify';
import { PlusCircle, Trash2, ArrowLeft } from 'lucide-react';
import Modal from '@components/admin/Modal';
import SearchableDropdown from '@components/admin/SearchableDropdown';
import { useCurrencyFormatter } from '@hooks/useCurrencyFormatter';
import Table from "@components/admin/Table";
import TableRow from "@components/admin/TableRow";
import LoaderSpinner from "@components/admin/LoaderSpinner";

interface Broker {
    _id: string;
    name: string;
    phone: string;
    commissionType: 'Fixed' | 'Percentage';
    commissionValue: number;
    commissionAmount: number;
    purchaseId: {
        _id: string;
        purchaseId: string;
        finalAmount: number;
        totalAmount: number;
        purchaseDate: string;
    };
    purchaseNumber: string;
    createdAt: string;
}

interface BrokerDetail {
    name: string;
    phone: string;
    commissionType: 'Fixed' | 'Percentage';
    commissionValue: number;
}

interface Purchase {
    id: string;
    purchaseId: string;
    finalAmount: number;
    totalAmount: number;
}

const BrokerDeals: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { token } = useSelector((state: RootState) => state.auth);
    const { format } = useCurrencyFormatter(true);

    const [deals, setDeals] = useState<Broker[]>([]);
    const [master, setMaster] = useState<BrokerDetail | null>(null);
    const [loading, setLoading] = useState(true);

    // Add Deal Modal State
    const [isDealModalOpen, setIsDealModalOpen] = useState(false);
    const [purchases, setPurchases] = useState<Purchase[]>([]);

    // Form Data
    const [formData, setFormData] = useState({
        commissionType: 'Percentage',
        commissionValue: '',
        purchaseId: '',
    });
    const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

    useEffect(() => {
        if (id) {
            fetchBrokerDeals();
        }
    }, [id]);

    useEffect(() => {
        if (isDealModalOpen) {
            fetchPurchases();
            // Pre-fill from master defaults if available
            if (master) {
                setFormData(prev => ({
                    ...prev,
                    commissionType: master.commissionType,
                    commissionValue: master.commissionValue ? String(master.commissionValue) : ''
                }));
            }
        }
    }, [isDealModalOpen, master]);

    const fetchBrokerDeals = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${Constants.GET_BROKERS_URL}-deals/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setDeals(response.data.deals || []);
            setMaster(response.data.master || null);
        } catch (error) {
            console.error("Error fetching deals:", error);
            toast.error("Failed to load broker deals");
        } finally {
            setLoading(false);
        }
    };

    const fetchPurchases = async () => {
        try {
            const response = await axios.get(`${Constants.GET_PURCHASE_URL}?limit=1000`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setPurchases(response.data.data?.purchases || []);
        } catch (error) {
            console.error('Error fetching purchases:', error);
        }
    };

    const handleAddDealClick = () => {
        setFormData({
            commissionType: master?.commissionType || 'Percentage',
            commissionValue: master?.commissionValue ? String(master.commissionValue) : '',
            purchaseId: ''
        });
        setSelectedPurchase(null);
        setIsDealModalOpen(true);
    };

    const handleDealSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.commissionValue || !formData.purchaseId) {
            toast.error('Please fill in required fields');
            return;
        }

        try {
            await axios.post(Constants.CREATE_BROKER_URL, {
                // We send name/phone from master to ensure consistency
                name: master?.name,
                phone: master?.phone,
                commissionType: formData.commissionType,
                commissionValue: Number(formData.commissionValue),
                purchaseId: formData.purchaseId
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });

            toast.success('Deal added successfully');
            setIsDealModalOpen(false);
            fetchBrokerDeals();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Error adding deal');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(`Are you sure you want to delete this transaction record?`)) return;
        try {
            await axios.delete(`${Constants.DELETE_BROKER_URL}/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            toast.success('Deal deleted successfully');
            fetchBrokerDeals();
        } catch (error) {
            toast.error('Error deleting deal');
        }
    };

    // Calculate estimated commission
    const estimatedCommission = useMemo(() => {
        if (!selectedPurchase || !formData.commissionValue) return 0;
        const baseAmount = selectedPurchase.finalAmount || selectedPurchase.totalAmount || 0;
        const commissionValue = Number(formData.commissionValue);
        return formData.commissionType === 'Percentage'
            ? (baseAmount * commissionValue) / 100
            : commissionValue;
    }, [selectedPurchase, formData.commissionValue, formData.commissionType]);

    const purchaseOptions = useMemo(() => {
        // Get list of purchase IDs that already have deals
        const usedPurchaseIds = deals.map(deal => deal.purchaseId?._id || deal.purchaseId).filter(Boolean);

        // Filter out purchases that already have deals
        const availablePurchases = purchases.filter(p => !usedPurchaseIds.includes(p.id));

        return availablePurchases.map(p => ({
            id: p.id,
            name: `${p.purchaseId} - ${format(p.finalAmount || p.totalAmount)}`
        }));
    }, [purchases, deals, format]);

    const handlePurchaseChange = (_: any, value: any) => {
        if (value) {
            setFormData(prev => ({ ...prev, purchaseId: value.id }));
            const purchase = purchases.find(p => p.id === value.id);
            setSelectedPurchase(purchase || null);
        } else {
            setFormData(prev => ({ ...prev, purchaseId: '' }));
            setSelectedPurchase(null);
        }
    };

    const selectedPurchaseValue = useMemo(() => {
        return purchaseOptions.find(p => p.id === formData.purchaseId) || null;
    }, [formData.purchaseId, purchaseOptions]);

    const tableHeaders = ["#", "Date", "Purchase ID", "Purchase Amount", "Comm. Type", "Comm. Value", "Comm. Amount", "Action"];

    if (loading && !master) return <LoaderSpinner />;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-950">
                            {master?.name || 'Broker Deals'}
                        </h1>
                        <p className="text-gray-500 text-sm">
                            {master?.phone} • Default: {master?.commissionValue}{master?.commissionType === 'Percentage' ? '%' : ''} ({master?.commissionType})
                        </p>
                    </div>
                </div>
                <div className="md:ml-auto w-full md:w-auto">
                    <button
                        onClick={handleAddDealClick}
                        className="bg-primary hover:bg-gray-900 text-white px-4 py-2 rounded-md shadow flex items-center justify-center gap-2 w-full md:w-auto"
                    >
                        <PlusCircle size={16} />
                        Add Deal
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto w-full">
                <div className="min-w-full">
                    <Table headers={tableHeaders}>
                        {!loading && deals.map((deal, idx) => (
                            <TableRow
                                key={deal._id}
                                index={idx + 1}
                                row={deal}
                                columns={[
                                    <span className="text-gray-600 text-sm">{deal.createdAt ? new Date(deal.createdAt).toLocaleDateString() : '-'}</span>,
                                    <span className="font-medium text-gray-900">{deal.purchaseId?.purchaseId || deal.purchaseNumber}</span>,
                                    <span className="text-gray-900">{format(deal.purchaseId?.finalAmount || deal.purchaseId?.totalAmount || 0)}</span>,
                                    <span className="text-gray-900">{deal.commissionType}</span>,
                                    <span className="text-gray-900">{deal.commissionType === 'Percentage' ? `${deal.commissionValue}%` : format(deal.commissionValue)}</span>,
                                    <span className="font-bold text-green-600">{format(deal.commissionAmount)}</span>,
                                ]}
                                actions={[
                                    {
                                        label: 'Delete',
                                        icon: <Trash2 size={16} className="text-red-500" />,
                                        onClick: (r: Broker) => handleDelete(r._id)
                                    }
                                ]}
                            />
                        ))}
                        {!loading && deals.length === 0 && (
                            <tr><td colSpan={8} className="text-center py-8 text-gray-500">No deals found for this broker</td></tr>
                        )}
                    </Table>
                </div>
            </div>

            <Modal
                isOpen={isDealModalOpen}
                onClose={() => setIsDealModalOpen(false)}
                title="Add New Deal"
                size="xl"
            >
                <form onSubmit={handleDealSubmit} className="p-6 space-y-4">
                    <div className="p-3 bg-gray-50 rounded mb-4 border border-gray-200">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-gray-500">Broker:</span> <span className="font-medium text-gray-900">{master?.name}</span></div>
                            <div><span className="text-gray-500">Phone:</span> <span className="font-medium text-gray-900">{master?.phone}</span></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <SearchableDropdown
                                label="Purchase Number"
                                value={selectedPurchaseValue}
                                options={purchaseOptions}
                                onChange={handlePurchaseChange}
                                placeholder="Select Purchase"
                                required
                            />
                            {selectedPurchase && (
                                <p className="mt-1 text-sm text-gray-500">
                                    Purchase Amount: <span className="font-semibold">{format(selectedPurchase.finalAmount || selectedPurchase.totalAmount)}</span>
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Commission Type <span className="text-red-500">*</span></label>
                            <div className="flex gap-4 mt-2">
                                <label className="flex items-center text-gray-800 cursor-pointer">
                                    <input type="radio" value="Percentage" checked={formData.commissionType === 'Percentage'}
                                        onChange={() => setFormData(prev => ({ ...prev, commissionType: 'Percentage' }))} className="mr-2"
                                    /> Percentage
                                </label>
                                <label className="flex items-center text-gray-800 cursor-pointer">
                                    <input type="radio" value="Fixed" checked={formData.commissionType === 'Fixed'}
                                        onChange={() => setFormData(prev => ({ ...prev, commissionType: 'Fixed' }))} className="mr-2"
                                    /> Fixed
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Commission Value <span className="text-red-500">*</span></label>
                            <input
                                type="number" step="0.01" value={formData.commissionValue}
                                onChange={e => setFormData(prev => ({ ...prev, commissionValue: e.target.value }))}
                                required
                                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                placeholder={formData.commissionType === 'Percentage' ? 'e.g., 10' : 'e.g., 1000'}
                            />
                        </div>

                        {estimatedCommission > 0 && (
                            <div className="bg-purple-50 border border-purple-200 rounded-md p-3 flex justify-between items-center text-purple-900">
                                <span className="text-sm font-medium">Estimated Commission:</span>
                                <span className="text-lg font-bold">{format(estimatedCommission)}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-4 gap-2">
                        <button type="button" onClick={() => setIsDealModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
                        <button type="submit" className="bg-primary text-white px-6 py-2 rounded-md hover:bg-gray-900 font-medium">
                            Save Deal
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default BrokerDeals;
