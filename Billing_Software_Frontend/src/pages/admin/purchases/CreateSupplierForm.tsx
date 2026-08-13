import { useEffect, useState } from "react";
import Modal from "@components/admin/Modal";
import { ExternalLink, Image, Trash2Icon, Upload } from "lucide-react";
import axios, { AxiosError } from "axios";
import Constants from "@constants/api";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import SubmitButton from "@components/admin/SubmitButton";
import SearchableDropdown from "@components/admin/SearchableDropdown";
import { useDebounce } from "@hooks/useDebounce";

interface AccountDetail {
    accountHolderName: string;
    bankName: string;
    branchName?: string;
    accountType: 'savings' | 'current';
    accountNumber: string;
    ifscCode: string;
}

interface SupplierFormData {
    id?: string;

    company_name: string;
    email: string;
    phone_number: string;

    company_address?: string;
    country?: string;
    city?: string;
    state?: string;
    pin_code?: string;

    pan_no?: string;
    gst_no?: string;

    account_details: AccountDetail[];

    profileImage?: File | null;
    profile_image_preview_url?: string;
    profile_image_removed?: boolean;
}
const initialFormState: SupplierFormData = {
    // supplier_name: '',
    // supplier_email: '',
    // supplier_phone: '',
    // balance: 0,
    // balance_type: 'credit',
    // profileImage: null,
    // profile_image_preview_url: '',
    // profile_image_removed: false

    company_name: '',
    email: '',
    phone_number: '',

    company_address: '',
    country: '',
    city: '',
    state: '',
    pin_code: '',

    pan_no: '',
    gst_no: '',

    account_details: [],

    profileImage: null,
    profile_image_preview_url: '',
    profile_image_removed: false,
};

interface CreateSupplierFormProps {
    title?: string;
    buttonTitle?: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newSupplier: SupplierResponse) => void
}

interface SupplierResponse {
    id: string;
    supplier_name: string;
    supplier_email: string;
    supplier_phone: string;
    profileImage: string;
}
const CreateSupplierForm: React.FC<CreateSupplierFormProps> = ({ title, isOpen, onClose, onSuccess }) => {
    const [formData, setformData] = useState<SupplierFormData>(initialFormState);
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
    const { token } = useSelector((state: RootState) => state.auth);
    const { data: systemSettings } = useSelector((state: RootState) => state.systemSettings);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExtractingDetails, setIsExtractingDetails] = useState(false);
    const [stateOptions, setStateOptions] = useState<{ id: string; name: string }[]>([]);
    const [cityOptions, setCityOptions] = useState<{ id: string; name: string }[]>([]);
    const [countryOptions, setCountryOptions] = useState<{ id: string; name: string }[]>([]);
    const [selectedCountry, setSelectedCountry] = useState<{ id: string; name: string } | null>(null);
    const [selectedState, setSelectedState] = useState<{ id: string; name: string } | null>(null);
    const [selectedCity, setSelectedCity] = useState<{ id: string; name: string } | null>(null);
    const [countryInput, setCountryInput] = useState<string>('');
    const [stateInput, setStateInput] = useState<string>('');
    const [cityInput, setCityInput] = useState<string>('');
    const debouncedCountrySearch = useDebounce(countryInput, 300);
    const debouncedStateSearch = useDebounce(stateInput, 300);
    const debouncedCitySearch = useDebounce(cityInput, 300);
    const [isStateLoading, setIsStateLoading] = useState(false);
    const [isCityLoading, setIsCityLoading] = useState(false);
    const systemCountryId = systemSettings?.company?.country ? String((systemSettings?.company as any).country) : '';
    const countryId = selectedCountry?.id || systemCountryId;

    useEffect(() => {
        if (isOpen) {
            setformData(initialFormState);
            setFormErrors({});
            setSelectedCountry(null);
            setSelectedState(null);
            setSelectedCity(null);
            setCountryInput('');
            setStateInput('');
            setCityInput('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !systemCountryId) return;
        const fetchCountry = async () => {
            try {
                const response = await axios.get(`${Constants.FETCH_COUNTRY_URL}/${systemCountryId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const country = { id: String(response.data._id), name: response.data.name };
                setSelectedCountry(country);
                setformData(prev => ({ ...prev, country: country.id }));
            } catch {
                setSelectedCountry(null);
            }
        };
        fetchCountry();
    }, [isOpen, systemCountryId, token]);

    useEffect(() => {
        const fetchCountries = async () => {
            try {
                const response = await axios.get(Constants.FETCH_COUNTRIES_URL, {
                    params: { search: debouncedCountrySearch },
                    headers: { Authorization: `Bearer ${token}` }
                });
                const formatted = response.data.map((country: any) => ({
                    id: String(country._id),
                    name: country.name
                }));
                setCountryOptions(formatted);
            } catch {
                setCountryOptions([]);
            }
        };
        fetchCountries();
    }, [debouncedCountrySearch, token]);

    useEffect(() => {
        if (!countryId) {
            setStateOptions([]);
            return;
        }
        const fetchStates = async () => {
            try {
                setIsStateLoading(true);
                const response = await axios.get(`${Constants.FETCH_STATES_URL}/${countryId}`, {
                    params: { search: debouncedStateSearch },
                    headers: { Authorization: `Bearer ${token}` }
                });
                const formattedStates = response.data.map((state: any) => ({
                    id: String(state._id),
                    name: state.name
                }));
                setStateOptions(formattedStates);
            } catch (error) {
                setStateOptions([]);
            } finally {
                setIsStateLoading(false);
            }
        };
        fetchStates();
    }, [countryId, debouncedStateSearch, token]);

    useEffect(() => {
        if (!selectedState?.id) {
            setCityOptions([]);
            return;
        }
        const fetchCities = async () => {
            try {
                setIsCityLoading(true);
                const response = await axios.get(`${Constants.FETCH_CITIES_URL}/${selectedState.id}`, {
                    params: { search: debouncedCitySearch },
                    headers: { Authorization: `Bearer ${token}` }
                });
                const formattedCities = response.data.map((city: any) => ({
                    id: String(city._id),
                    name: city.name
                }));
                setCityOptions(formattedCities);
            } catch (error) {
                setCityOptions([]);
            } finally {
                setIsCityLoading(false);
            }
        };
        fetchCities();
    }, [selectedState?.id, debouncedCitySearch, token]);
    const handleImageDelete = () => {
        setformData({
            ...formData,
            profileImage: null,
            profile_image_preview_url: '',
            profile_image_removed: true
        })
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setformData({
                ...formData,
                profileImage: file,
                profile_image_preview_url: URL.createObjectURL(file)
            })
        }
    }

    const handleSupplierDetailsFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        try {
            setIsExtractingDetails(true);
            const payload = new FormData();
            payload.append('file', file);

            const response = await axios.post(Constants.AI_EXTRACT_SUPPLIER_DETAILS_URL, payload, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
            });

            const extracted = response.data?.data?.extracted || {};
            const bankAccounts = Array.isArray(extracted.bankAccounts)
                ? extracted.bankAccounts
                    .filter((account: any) => account?.accountNumber || account?.bankName || account?.ifscCode)
                    .map((account: any) => ({
                        accountHolderName: account.accountHolderName || '',
                        bankName: account.bankName || '',
                        branchName: account.branchName || '',
                        accountType: account.accountType === 'current' ? 'current' : 'savings',
                        accountNumber: account.accountNumber || '',
                        ifscCode: account.ifscCode || '',
                    }))
                : [];

            setformData(prev => ({
                ...prev,
                company_name: extracted.supplierName || prev.company_name,
                email: extracted.supplierEmail || prev.email,
                phone_number: extracted.supplierPhone || prev.phone_number,
                company_address: extracted.supplierAddress || prev.company_address,
                city: extracted.city || prev.city,
                state: extracted.state || prev.state,
                pin_code: extracted.pinCode || prev.pin_code,
                pan_no: extracted.supplierPAN || prev.pan_no,
                gst_no: extracted.supplierGSTIN || prev.gst_no,
                account_details: bankAccounts.length ? bankAccounts : prev.account_details,
            }));

            if (extracted.country) setCountryInput(extracted.country);
            if (extracted.state) setStateInput(extracted.state);
            if (extracted.city) setCityInput(extracted.city);

            toast.success('Supplier details extracted. Please review before saving.');
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Could not extract supplier details');
        } finally {
            setIsExtractingDetails(false);
        }
    };


    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === 'phone_number' || name === 'pin_code') {
            const numericValue = value.replace(/[^0-9]/g, '');
            setformData(prev => ({
                ...prev,
                [name]: name === 'phone_number' ? numericValue.slice(0, 10) : numericValue
            }));
            return;
        }

        if (name === 'pan_no') {
            const upperValue = value.toUpperCase().slice(0, 10);
            setformData(prev => ({ ...prev, [name]: upperValue }));
            return;
        }

        if (name === 'gst_no') {
            const upperValue = value.toUpperCase().slice(0, 15);
            setformData(prev => ({ ...prev, [name]: upperValue }));
            return;
        }

        setformData(prev => ({ ...prev, [name]: value }));
    };

    const handleStateSelect = (state: { id: string; name: string } | null) => {
        setSelectedState(state);
        setSelectedCity(null);
        setCityOptions([]);
        setformData(prev => ({
            ...prev,
            state: state?.name || '',
            city: ''
        }));
    };

    const handleCitySelect = (city: { id: string; name: string } | null) => {
        setSelectedCity(city);
        setformData(prev => ({ ...prev, city: city?.name || '' }));
    };

    const handleCountrySelect = (country: { id: string; name: string } | null) => {
        setSelectedCountry(country);
        setSelectedState(null);
        setSelectedCity(null);
        setStateOptions([]);
        setCityOptions([]);
        setformData(prev => ({ ...prev, country: country?.id || '', state: '', city: '' }));
    };

    const handleSearchGST = (gst_no?: string) => {
        if (!gst_no) {
            window.open("https://services.gst.gov.in/services/searchtp", "_blank");
            return;
        }

        navigator.clipboard.writeText(gst_no);
        toast.success("GST number copied to clipboard");
        window.open("https://services.gst.gov.in/services/searchtp", "_blank");
    };

    const addAccount = () => {
        setformData(prev => ({
            ...prev,
            account_details: [
                ...prev.account_details,
                {
                    accountHolderName: '',
                    bankName: '',
                    branchName: '',
                    accountType: 'savings',
                    accountNumber: '',
                    ifscCode: '',
                },
            ],
        }));
    };

    const removeAccount = (index: number) => {
        setformData(prev => ({
            ...prev,
            account_details: prev.account_details.filter((_, i) => i !== index),
        }));
    };

    const handleAccountChange = (
        index: number,
        field: keyof AccountDetail,
        value: string
    ) => {
        const updated = [...formData.account_details];
        updated[index][field] = value as never;
        setformData({ ...formData, account_details: updated });
    };


    const validateSupplierForm = () => {
        const errors: { [key: string]: string } = {};

        if (!formData.company_name) {
            errors.company_name = 'Company name is required';
        }

        // Email is now optional - removed validation

        if (!formData.phone_number) {
            errors.phone_number = 'Phone number is required';
        } else if (formData.phone_number.trim().length !== 10) {
            errors.phone_number = 'Phone number must be 10 digits';
        }

        if (formData.pan_no && formData.pan_no.trim().length !== 10) {
            errors.pan_no = 'PAN number must be exactly 10 characters';
        }

        if (formData.gst_no && formData.gst_no.trim().length !== 15) {
            errors.gst_no = 'GST number must be exactly 15 characters';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };


    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!validateSupplierForm()) return;
        try {
            setIsSubmitting(true);
            const data = new FormData();

            Object.entries(formData).forEach(([key, value]) => {
                if (key === 'account_details') {
                    data.append(key, JSON.stringify(value));
                } else if (value !== undefined && value !== null) {
                    data.append(key, String(value));
                }
            });

            if (formData.profileImage instanceof File) {
                data.append('profileImage', formData.profileImage);
            }
            if (formData.profile_image_removed) {
                data.append('profile_image_removed', 'true');
            }

            const response = await axios.post(Constants.CREATE_SUPPLIER_URL, data, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            toast.success('Supplier created successfully');
            onSuccess(response.data.data);
        } catch (error: any | AxiosError) {
            setFormErrors(error?.response?.data?.errors || {});
            toast.error('Something went wrong');
        } finally {
            setIsSubmitting(false);
        }
    }
    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={title ?? 'Create Supplier'}>
                <form onSubmit={handleSubmit} className="space-y-2">
                    <label htmlFor="profileImage" className="block font-medium text-sm text-gray-700 ">Profile Image</label>
                    <div className="flex items-start gap-4 mb-4">
                        {/* Image Preview or Default */}
                        <div className="relative w-20 h-20 border border-gray-300 rounded-md flex items-center justify-center overflow-hidden bg-white">
                            {formData.profile_image_preview_url ? (
                                <img
                                    src={formData.profile_image_preview_url}
                                    alt="Preview"
                                    className="w-full h-full object-cover rounded"
                                />
                            ) : (
                                <span className="text-xl text-gray-400"><Image /></span>
                            )}

                            {/* Delete Button on Preview */}
                            {formData.profile_image_preview_url && (
                                <button
                                    type="button"
                                    className="absolute top-[0px] right-[-1px] bg-white border border-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-500 hover:border-white transition duration-200"
                                    onClick={handleImageDelete}
                                    title="Remove Image"
                                >
                                    <Trash2Icon size={14} className="text-red-500 hover:text-white cursor-pointer" />
                                </button>
                            )}
                        </div>

                        {/* Upload Button and Note */}
                        <div>
                            <label htmlFor="imageUpload" className="mr-2">
                                <input
                                    type="file"
                                    accept="image/png, image/jpeg"
                                    onChange={handleFileChange}
                                    className="hidden"
                                    id="imageUpload"
                                />
                                <span className="inline-flex items-center bg-primary hover:bg-gray-950 text-white text-sm px-4 py-2 rounded-md transition duration-200 cursor-pointer">
                                    <Image size={16} className="mr-2" />
                                    Upload Image
                                </span>

                            </label>
                            <label htmlFor="supplierDetailsUpload">
                                <input
                                    type="file"
                                    accept="image/png, image/jpeg, application/pdf"
                                    onChange={handleSupplierDetailsFileChange}
                                    className="hidden"
                                    id="supplierDetailsUpload"
                                    disabled={isExtractingDetails}
                                />
                                <span className={`inline-flex items-center text-sm px-4 py-2 rounded-md transition duration-200 cursor-pointer ${
                                    isExtractingDetails
                                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                        : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                                }`}>
                                    <Upload size={16} className="mr-2" />
                                    {isExtractingDetails ? 'Reading Details...' : 'Scan Supplier Details'}
                                </span>
                            </label>
                            <p className="text-xs text-gray-500 mt-1">JPG or PNG format, not exceeding 5MB.</p>
                        </div>
                    </div>


                    {/* Name */}
                    <div>
                        <label className="block font-medium text-sm text-gray-700 ">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            name="company_name"
                            value={formData.company_name}
                            onChange={handleChange}
                            type="text"
                            placeholder="Enter Name"
                            className="border border-gray-300 rounded-md px-4 py-2 w-full   text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                        />
                        {formErrors.company_name && <p className="text-red-500 text-xs mt-1">{formErrors.company_name}</p>}
                    </div>

                    {/* Email & Phone */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block font-medium text-sm text-gray-700 ">
                                Email
                            </label>
                            <input
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                type="email"
                                placeholder="Enter Email Address"
                                className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                            />
                            {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
                        </div>
                        <div>
                            <label className="block font-medium text-sm text-gray-700 ">
                                Phone Number <span className="text-red-500">*</span>
                            </label>
                            <input
                                name="phone_number"
                                value={formData.phone_number}
                                onChange={handleChange}
                                type="tel"
                                placeholder="Enter Phone Number"
                                maxLength={10}
                                className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                            />
                            {formErrors.phone_number && <p className="text-red-500 text-xs mt-1">{formErrors.phone_number}</p>}
                        </div>

                        <div className="md:col-span-2">
                            <label className="block font-medium text-sm text-gray-700">
                                Company Address
                            </label>
                            <input
                                name="company_address"
                                value={formData.company_address}
                                onChange={handleChange}
                                type="text"
                                placeholder="Enter Company Address"
                                className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <SearchableDropdown
                                label="Country"
                                options={countryOptions}
                                value={selectedCountry}
                                inputValue={countryInput}
                                onInputChange={(_, value) => setCountryInput(value)}
                                onChange={(_, value) => handleCountrySelect(value)}
                            />
                        </div>

                        <div>
                            <SearchableDropdown
                                label="State"
                                options={stateOptions}
                                value={selectedState}
                                inputValue={stateInput}
                                onInputChange={(_, value) => setStateInput(value)}
                                onChange={(_, value) => handleStateSelect(value)}
                                disabled={!countryId}
                                loading={isStateLoading}
                            />
                        </div>

                        <div>
                            <SearchableDropdown
                                label="City"
                                options={cityOptions}
                                value={selectedCity}
                                inputValue={cityInput}
                                onInputChange={(_, value) => setCityInput(value)}
                                onChange={(_, value) => handleCitySelect(value)}
                                disabled={!selectedState?.id}
                                loading={isCityLoading}
                            />
                        </div>

                        <div>
                            <label className="block font-medium text-sm text-gray-700">Pin Code</label>
                            <input
                                name="pin_code"
                                value={formData.pin_code}
                                onChange={handleChange}
                                type="text"
                                placeholder="Enter Pin Code"
                                className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block font-medium text-sm text-gray-700">
                                PAN Number
                            </label>
                            <input
                                name="pan_no"
                                value={formData.pan_no}
                                onChange={handleChange}
                                type="text"
                                placeholder="Enter PAN Number"
                                maxLength={10}
                                className="border border-gray-300 rounded-md px-4 py-2 w-full uppercase text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                            />
                            {formErrors.pan_no && (
                                <p className="text-red-500 text-xs mt-1">{formErrors.pan_no}</p>
                            )}
                        </div>

                        <div>

                            <div className="flex items-center justify-between">
                                <label className="block font-medium text-sm text-gray-700">
                                    GST Number
                                </label>

                                <button
                                    type="button"
                                    onClick={() => handleSearchGST(formData.gst_no)}
                                    className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                                    title="GST number will be copied automatically"
                                >
                                    <ExternalLink size={14} />
                                    Search Taxpayer
                                </button>
                            </div>

                            <input
                                name="gst_no"
                                value={formData.gst_no}
                                onChange={handleChange}
                                type="text"
                                placeholder="Enter GST Number"
                                maxLength={15}
                                className="border border-gray-300 rounded-md px-4 py-2 w-full uppercase text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                            />
                            {formErrors.gst_no && (
                                <p className="text-red-500 text-xs mt-1">{formErrors.gst_no}</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block font-medium text-sm text-gray-700">
                                Bank Account Details
                            </label>
                            <button
                                type="button"
                                onClick={addAccount}
                                className="text-sm text-primary hover:underline"
                            >
                                + Add Account
                            </button>
                        </div>

                        {formData.account_details.map((acc, index) => (
                            <div
                                key={index}
                                className="border border-gray-300 rounded-md p-4 mb-3 space-y-3"
                            >
                                <div className="flex gap-4">
                                    <input
                                        value={acc.accountHolderName}
                                        onChange={(e) =>
                                            handleAccountChange(index, "accountHolderName", e.target.value)
                                        }
                                        placeholder="Account Holder Name"
                                        className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                                    />

                                    <input
                                        value={acc.bankName}
                                        onChange={(e) =>
                                            handleAccountChange(index, "bankName", e.target.value)
                                        }
                                        placeholder="Bank Name"
                                        className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                                    />
                                </div>

                                <div className="flex gap-4">
                                    <input
                                        value={acc.branchName}
                                        onChange={(e) =>
                                            handleAccountChange(index, "branchName", e.target.value)
                                        }
                                        placeholder="Branch Name"
                                        className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                                    />

                                    <input
                                        value={acc.accountNumber}
                                        onChange={(e) =>
                                            handleAccountChange(index, "accountNumber", e.target.value)
                                        }
                                        placeholder="Account Number"
                                        className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                                    />
                                </div>

                                <div className="flex gap-4 items-center">
                                    <input
                                        value={acc.ifscCode}
                                        onChange={(e) =>
                                            handleAccountChange(index, "ifscCode", e.target.value)
                                        }
                                        placeholder="IFSC Code"
                                        className="border border-gray-300 rounded-md px-4 py-2 w-full  text-gray-950  focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none uppercase"
                                    />

                                    <select
                                        value={acc.accountType}
                                        onChange={(e) =>
                                            handleAccountChange(index, "accountType", e.target.value)
                                        }
                                        className="border border-gray-300 rounded-md px-3 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-none"
                                    >
                                        <option value="savings">Savings</option>
                                        <option value="current">Current</option>
                                    </select>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => removeAccount(index)}
                                    className="text-red-500 text-sm hover:underline"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end pt-4 gap-2">
                        <button
                            type="button"
                            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 cursor-pointer"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <SubmitButton
                            isLoading={isSubmitting}
                            isDisabled={isSubmitting}
                            mode="create"
                        />
                    </div>
                </form>
            </Modal>
        </>
    );
}


export default CreateSupplierForm;
