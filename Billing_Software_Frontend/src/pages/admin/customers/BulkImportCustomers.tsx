import React, { useState } from 'react';
import axios from 'axios';
import Constants from '../../../constants/api';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import { Upload, FileText, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { validateExcelTemplate } from '@utils/excelTemplate';

interface UploadResults {
    totalRows: number;
    customersCreated: number;
    errors: Array<{
        row: number;
        reason: string;
        data?: any;
    }>;
}

export default function BulkImportCustomers() {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [results, setResults] = useState<UploadResults | null>(null);
    const [templateErrors, setTemplateErrors] = useState<string[]>([]);
    const { token } = useSelector((state: RootState) => state.auth);
    const customerTemplateHeaders = [
        'Phone Number',
        'Name',
        'Email',
        'Website',
        'Notes',
        'Billing Name',
        'Billing Address Line 1',
        'Billing Address Line 2',
        'Billing City',
        'Billing State',
        'Billing Pincode',
        'Billing Country',
        'Shipping Name',
        'Shipping Address Line 1',
        'Shipping Address Line 2',
        'Shipping City',
        'Shipping State',
        'Shipping Pincode',
        'Shipping Country',
        'Bank Name',
        'Branch',
        'Account Holder Name',
        'Account Number',
        'IFSC'
    ];
    const minimalCustomerHeaders = ['Phone Number'];

    const validateCustomerTemplate = async (selectedFile: File) => {
        const minimalCheck = await validateExcelTemplate(selectedFile, minimalCustomerHeaders);
        if (minimalCheck.ok) return minimalCheck;
        const fullCheck = await validateExcelTemplate(selectedFile, customerTemplateHeaders);
        return fullCheck;
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (!selectedFile.name.endsWith('.xlsx')) {
                toast.error('Please select a valid Excel file (.xlsx)');
                return;
            }
            const templateCheck = await validateCustomerTemplate(selectedFile);
            if (!templateCheck.ok) {
                toast.error(templateCheck.message || 'Selected file does not match the customer template.');
                setTemplateErrors(templateCheck.details || [templateCheck.message || 'Invalid template']);
                e.target.value = '';
                return;
            }
            setTemplateErrors([]);
            setFile(selectedFile);
            setResults(null);
        }
    };

    const handleDownloadTemplate = async () => {
        setDownloading(true);
        try {
            const response = await axios.get(
                Constants.DOWNLOAD_CUSTOMER_TEMPLATE_URL,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    responseType: 'blob',
                }
            );

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'Customer_Import_Template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Template downloaded successfully');
        } catch (error: any) {
            console.error('Download error:', error);
            toast.error('Failed to download template');
        } finally {
            setDownloading(false);
        }
    };

    const handleSelectFile = () => {
        document.getElementById('excel-file-input')?.click();
    };

    const handleUpload = async () => {
        if (!file) {
            toast.error('Please select a file first');
            return;
        }

        const templateCheck = await validateCustomerTemplate(file);
        if (!templateCheck.ok) {
            toast.error(templateCheck.message || 'Selected file does not match the customer template.');
            setTemplateErrors(templateCheck.details || [templateCheck.message || 'Invalid template']);
            return;
        }

        setTemplateErrors([]);
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post(
                Constants.UPLOAD_CUSTOMERS_EXCEL_URL,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            setResults(response.data.results);
            toast.success(response.data.message || 'Import completed successfully!');

            setFile(null);
            const fileInput = document.getElementById('excel-file-input') as HTMLInputElement;
            if (fileInput) fileInput.value = '';

        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error(error.response?.data?.message || 'Failed to upload file');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-800 mb-1">Bulk Customer Upload</h1>
                <p className="text-sm text-gray-500">Upload multiple customers from an Excel file</p>
            </div>

            {/* File Format Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start gap-2 mb-4">
                    <Info className="text-blue-600 mt-0.5" size={20} />
                    <h3 className="text-base font-semibold text-gray-800">File Format</h3>
                </div>

                <div className="text-sm text-gray-700 space-y-2 mb-4">
                    <p className="text-gray-600 mb-3">
                        Your file (Excel .xlsx) can include only <strong>Phone Number</strong>, or the full template columns below (in order):
                    </p>
                    <ol className="space-y-1.5 ml-1">
                        <li><span className="font-medium text-gray-800">1. phone</span> - Phone Number <span className="text-red-600 font-medium">(Required)</span></li>
                        <li><span className="font-medium text-gray-800">2. name</span> - Customer Name (Optional)</li>
                        <li><span className="font-medium text-gray-800">3. email</span> - Email Address (Optional)</li>
                        <li><span className="font-medium text-gray-800">4. website</span> - Website URL (Optional)</li>
                        <li><span className="font-medium text-gray-800">5. notes</span> - Notes/Comments (Optional)</li>
                    </ol>
                    <p className="text-blue-700 font-medium mt-3 pt-2 border-t border-blue-200">
                        <strong>Note:</strong> Only Phone Number is required. All other fields are optional. You may upload a file with just the Phone Number column or use the full template. Duplicate phone numbers will be rejected.
                    </p>
                </div>

                <button
                    onClick={handleDownloadTemplate}
                    disabled={downloading}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                >
                    {downloading ? 'Downloading...' : 'Download Sample Template'}
                </button>
            </div>

            {/* Upload Section */}
            <div className="bg-white border border-gray-200 rounded-lg p-8">
                <div className="flex flex-col items-center justify-center space-y-4">
                    {/* File Icon */}
                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                        <FileText className="text-gray-400" size={40} />
                    </div>

                    {/* Hidden File Input */}
                    <input
                        id="excel-file-input"
                        type="file"
                        accept=".xlsx"
                        onChange={handleFileChange}
                        className="hidden"
                        disabled={uploading}
                    />

                    {/* File Info */}
                    {file && (
                        <div className="text-sm text-gray-600 flex items-center gap-2">
                            <CheckCircle className="text-green-600" size={16} />
                            <span>{file.name} ({(file.size / 1024).toFixed(2)} KB)</span>
                        </div>
                    )}

                    <button
                        onClick={handleSelectFile}
                        disabled={uploading}
                        className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-2.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        <Upload size={16} />
                        Select File
                    </button>

                    {/* Upload Button */}
                    <button
                        onClick={handleUpload}
                        disabled={!file || uploading}
                        className="w-full max-w-xs bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-2.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {uploading ? 'Uploading...' : 'Upload Customers'}
                    </button>
                    {templateErrors.length > 0 && (
                        <div className="mt-4 w-full bg-red-50 border border-red-200 rounded-md p-4 text-left">
                            <p className="text-sm font-semibold text-red-700 mb-2">Template Errors:</p>
                            <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                                {templateErrors.map((err, idx) => (
                                    <li key={idx}>{err}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* Results Section */}
            {results && (
                <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Import Results</h3>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <div className="text-sm text-gray-600 font-medium mb-1">Total Rows</div>
                            <div className="text-3xl font-bold text-gray-800">{results.totalRows}</div>
                        </div>
                        <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                            <div className="text-sm text-green-700 font-medium mb-1">Customers Created</div>
                            <div className="text-3xl font-bold text-green-700">{results.customersCreated}</div>
                        </div>
                        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                            <div className="text-sm text-red-700 font-medium mb-1">Errors</div>
                            <div className="text-3xl font-bold text-red-700">{results.errors.length}</div>
                        </div>
                    </div>

                    {results.errors.length > 0 && (
                        <div className="border-t pt-4 mt-4">
                            <div className="flex items-center gap-2 mb-3">
                                <AlertCircle className="text-red-600" size={18} />
                                <h4 className="font-semibold text-gray-800">Errors ({results.errors.length})</h4>
                            </div>
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Row</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {results.errors.map((error, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{error.row}</td>
                                                    <td className="px-4 py-3 text-sm text-red-600">{error.reason}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
