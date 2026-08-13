import { useEffect, useState } from "react";
import Modal from "./Modal";
import axios, { AxiosError } from "axios";
import Constants from "@constants/api";
import type { RootState } from "@store/index";
import { useSelector } from "react-redux";
import SubmitButton from "./SubmitButton";
import { toast } from "react-toastify";
import type { Customer } from "@models/customer";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newCustomer: Customer) => void;
}

interface CustomerFormData {
    name: string;
    email: string;
    phone: string;
}

const CreateCustomerForm: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
    const setInitialFormData = (): CustomerFormData => ({
        name: '',
        email: '',
        phone: '',
    });
    const { token } = useSelector((state: RootState) => state.auth);
    const [formData, setFormData] = useState<CustomerFormData>(setInitialFormData());
    const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Reset form whenever modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData(setInitialFormData());
            setFormErrors({});
        }
    }, [isOpen]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setFormErrors(prev => ({ ...prev, [name]: '' }));
    }

    const validateForm = () => {
        const errors: { [key: string]: string } = {};

        if (!formData.phone.trim()) {
            errors.phone = "Phone is required";
        } else if (!/^\d{10}$/.test(formData.phone)) {
            errors.phone = "Phone must be 10 digits";
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;
        try {
            setIsSubmitting(true);

            // 🔹 Send only provided fields
            const payload: any = { phone: formData.phone, };

            if (formData.name?.trim()) payload.name = formData.name.trim();
            if (formData.email?.trim()) payload.email = formData.email.trim();

            const response = await axios.post(Constants.CREATE_CUSTOMER_MINIMAL_URL, payload, {    // previously "formData" instead of payload
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            toast.success("Customer created successfully!");
            onSuccess(response.data.data || {});
        } catch (error) {
            const axiosError = error as AxiosError as any;
            if (axiosError.response && (axiosError.response.status === 422 || axiosError.response.status === 409)) {
                setFormErrors(axiosError.response.data.errors);
            } else {
                toast.error("Something went wrong");
            }
        } finally {
            setIsSubmitting(false);
        }

    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create Customer">
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-1 gap-6 pt-6">
                    <div>
                        <label className="block font-medium text-sm text-gray-500 mb-1">
                            Name
                        </label>
                        <input
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            type="text"
                            placeholder="Enter Name"
                            className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-primary"
                        />
                        {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
                    </div>
                    <div>
                        <label className="block font-medium text-sm text-gray-500 mb-1">
                            Email
                        </label>
                        <input
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            type="email"
                            placeholder="Enter Email"
                            className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-primary"
                        />
                        {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
                    </div>
                    <div>
                        <label className="block font-medium text-sm text-red-500 mb-1">
                            Phone <span className="text-red-500">*</span>
                        </label>
                        <input
                            name="phone"
                            value={formData.phone}
                            onChange={(e) => {
                                let value = e.target.value;
                                value = value.replace(/\D/g, '');
                                if (value.length > 10) value = value.slice(0, 10);
                                setFormData(prev => ({ ...prev, phone: value }));
                                setFormErrors(prev => ({ ...prev, phone: '' }));
                            }}
                            type="tel"
                            placeholder="Enter Phone"
                            className="border border-gray-300 rounded-md px-4 py-2 w-full text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-primary"
                        />
                        {formErrors.phone && <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>}
                    </div>

                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-md border border-gray-300 text-gray-700"
                    >
                        Cancel
                    </button>
                    <SubmitButton isDisabled={isSubmitting} isLoading={isSubmitting} mode="create">Create</SubmitButton>
                </div>
            </form>
        </Modal>
    );
}

export default CreateCustomerForm;
