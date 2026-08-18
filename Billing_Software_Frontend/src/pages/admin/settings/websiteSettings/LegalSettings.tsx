import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { TiptapEditor } from '@components/admin/TiptapEditor';
import Constants from '@constants/api';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import SubmitButton from '@components/admin/SubmitButton';
import { Globe, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LegalSettings: React.FC = () => {
    const [privacyPolicy, setPrivacyPolicy] = useState('');
    const [termsAndConditions, setTermsAndConditions] = useState('');
    const [dataDeletion, setDataDeletion] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'deletion'>('privacy');

    const navigate = useNavigate();
    const { token } = useSelector((state: RootState) => state.auth);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setIsLoading(true);
        try {
            const response = await axios.get(Constants.LEGAL_SETTINGS_URL, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data?.success) {
                const data = response.data.data;
                setPrivacyPolicy(data.privacyPolicy || '');
                setTermsAndConditions(data.termsAndConditions || '');
                setDataDeletion(data.dataDeletion || '');
            }
        } catch (error) {
            console.error('Error fetching legal settings:', error);
            toast.error('Failed to load legal settings');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await axios.put(Constants.LEGAL_SETTINGS_URL, {
                privacyPolicy,
                termsAndConditions,
                dataDeletion
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data?.success) {
                toast.success('Legal pages updated successfully');
            } else {
                toast.error(response.data?.message || 'Update failed');
            }
        } catch (error) {
            console.error('Error saving legal settings:', error);
            toast.error('Failed to update legal settings');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-white p-6 md:p-8 rounded-lg shadow-md border border-gray-200">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-64 bg-gray-200 rounded w-full"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 md:p-8 rounded-lg shadow-md border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-950 flex items-center gap-3">
                <Globe className="text-primary" />
                Legal Pages
            </h2>
            <p className="text-gray-500 mt-2 text-sm">
                Manage the public legal pages required for compliance and Meta/WhatsApp integration.
                Dynamic placeholders like {'{{businessName}}'} or {'{{businessEmail}}'} will be automatically replaced with your Company Settings.
            </p>
            <details className="mt-4 mb-6 group bg-primary/5 border border-primary/20 rounded-lg">
                <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-primary hover:text-primary/80 list-none flex items-center justify-between">
                    <span>Available Dynamic Variables</span>
                    <span className="transition-transform group-open:rotate-180 text-xs">▼</span>
                </summary>
                <div className="px-4 pb-4 text-sm text-gray-600">
                    <p className="mb-2">You can use these variables anywhere in your legal documents. They will be automatically replaced with the corresponding values from your Company Settings when users view the pages:</p>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                        <li className="flex items-center gap-2"><code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">{'{{businessName}}'}</code> <span>Your company name</span></li>
                        <li className="flex items-center gap-2"><code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">{'{{businessEmail}}'}</code> <span>Your support/business email</span></li>
                        <li className="flex items-center gap-2"><code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">{'{{businessPhone}}'}</code> <span>Your contact phone number</span></li>
                        <li className="flex items-center gap-2"><code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">{'{{businessAddress}}'}</code> <span>Your physical business address</span></li>
                    </ul>
                </div>
            </details>
            
            <hr className="my-6 border-gray-200" />

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('privacy')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'privacy'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        Privacy Policy
                    </button>
                    <button
                        onClick={() => setActiveTab('terms')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'terms'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        Terms & Conditions
                    </button>
                    <button
                        onClick={() => setActiveTab('deletion')}
                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'deletion'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        Data Deletion
                    </button>
                </nav>
            </div>

            {/* Editors */}
            <div className="space-y-6">
                <div className={activeTab === 'privacy' ? 'block' : 'hidden'}>
                    <div className="mb-12 border border-gray-200 rounded-md overflow-hidden min-h-[24rem]">
                        <TiptapEditor 
                            value={privacyPolicy} 
                            onChange={setPrivacyPolicy} 
                        />
                    </div>
                </div>
                
                <div className={activeTab === 'terms' ? 'block' : 'hidden'}>
                    <div className="mb-12 border border-gray-200 rounded-md overflow-hidden min-h-[24rem]">
                        <TiptapEditor 
                            value={termsAndConditions} 
                            onChange={setTermsAndConditions} 
                        />
                    </div>
                </div>
                
                <div className={activeTab === 'deletion' ? 'block' : 'hidden'}>
                    <div className="mb-12 border border-gray-200 rounded-md overflow-hidden min-h-[24rem]">
                        <TiptapEditor 
                            value={dataDeletion} 
                            onChange={setDataDeletion} 
                        />
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="border-t border-gray-200 pt-6 mt-16 flex justify-end gap-4">
                <button
                    type="button"
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center gap-2"
                    disabled={isSaving}
                    onClick={() => navigate('/admin/dashboard')}
                >
                    <X size={16} /> Cancel
                </button>
                <SubmitButton
                    isDisabled={isSaving}
                    mode='edit'
                    isLoading={isSaving}
                    onClick={handleSave}
                />
            </div>
        </div>
    );
};

export default LegalSettings;
