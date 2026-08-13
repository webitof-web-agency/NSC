import React, { useState } from 'react';
import axios from 'axios';
import Constants from '@constants/api';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import { FileSpreadsheet, CheckCircle, AlertCircle, Info } from 'lucide-react';
import Seo from '@components/admin/Seo';
import { validateExcelTemplate } from '@utils/excelTemplate';

interface UploadResults {
    totalRows: number;
    successCount: number;
    errorCount: number;
    results: {
        success: Array<{
            row: number;
            action: string;
            broker: string;
        }>;
        errors: Array<{
            row: number;
            error: string;
            data?: any;
        }>;
    };
}

export default function BulkImportBrokers() {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [results, setResults] = useState<UploadResults | null>(null);
    const [templateErrors, setTemplateErrors] = useState<string[]>([]);
    const { token } = useSelector((state: RootState) => state.auth);
    const brokerTemplateHeaders = [
        'Broker Name',
        'Phone Number',
        'Commission Type',
        'Commission Value'
    ];

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (!selectedFile.name.endsWith('.xlsx')) {
                toast.error('Please select a valid Excel file (.xlsx)');
                return;
            }
            const templateCheck = await validateExcelTemplate(selectedFile, brokerTemplateHeaders);
            if (!templateCheck.ok) {
                toast.error(templateCheck.message || 'Selected file does not match the broker template.');
                setTemplateErrors(templateCheck.details || [templateCheck.message || 'Invalid template']);
                e.target.value = '';
                return;
            }
            setTemplateErrors([]);
            setFile(selectedFile);
            setResults(null);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            toast.error('Please select a file first');
            return;
        }

        const templateCheck = await validateExcelTemplate(file, brokerTemplateHeaders);
        if (!templateCheck.ok) {
            toast.error(templateCheck.message || 'Selected file does not match the broker template.');
            setTemplateErrors(templateCheck.details || [templateCheck.message || 'Invalid template']);
            return;
        }

        setTemplateErrors([]);
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post(
                Constants.UPLOAD_BROKERS_EXCEL_URL,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            setResults(response.data);
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

    const handleDownloadTemplate = async () => {
        try {
            const response = await axios.get(
                Constants.DOWNLOAD_BROKER_TEMPLATE_URL,
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
            link.setAttribute('download', 'Broker_Import_Template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success('Template downloaded successfully!');
        } catch (error: any) {
            console.error('Download error:', error);
            toast.error('Failed to download template');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <Seo title="Bulk Import Brokers" />
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-950">Bulk Broker Upload</h1>
                    <p className="text-sm text-gray-600 mt-1">Upload multiple brokers from an Excel file to create or update master records.</p>
                </div>

                {/* File Format Section - Full Width */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <div className="flex items-start gap-3 mb-4">
                        <Info className="text-blue-600 mt-0.5" size={20} />
                        <div>
                            <h2 className="text-base font-semibold text-blue-900">File Format</h2>
                            <p className="text-sm text-blue-700 mt-1">
                                Your file (Excel .xlsx) should have the following columns:
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 ml-8 text-sm text-blue-900">
                        <div className="space-y-2">
                            <p><span className="font-semibold">1. Broker Name</span> - Full Name (Required)</p>
                            <p><span className="font-semibold">2. Phone Number</span> - Unique mobile number (Required)</p>
                        </div>
                        <div className="space-y-2">
                            <p><span className="font-semibold">3. Commission Type</span> - "Percentage" or "Fixed" (Default: "Percentage")</p>
                            <p><span className="font-semibold">4. Commission Value</span> - Numeric value (e.g., 5 for 5%)</p>
                        </div>
                    </div>

                    <div className="mt-4 ml-8 text-xs text-blue-800 bg-blue-100 p-3 rounded">
                        <strong>Note:</strong> If a broker with the same phone number exists, their master details (Name, Commission Defaults) will be updated.
                    </div>

                    <button
                        onClick={handleDownloadTemplate}
                        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors text-sm"
                    >
                        Download Sample Template
                    </button>
                </div>

                {/* Upload Section */}
                <div className="bg-white border border-gray-200 rounded-lg p-12">
                    <div className="flex flex-col items-center justify-center space-y-6">
                        {/* File Icon */}
                        <div className="text-gray-400">
                            <FileSpreadsheet size={80} strokeWidth={1.5} />
                        </div>

                        {/* File Input (Hidden) */}
                        <input
                            id="excel-file-input"
                            type="file"
                            accept=".xlsx"
                            onChange={handleFileChange}
                            className="hidden"
                            disabled={uploading}
                        />

                        {/* Selected File Display */}
                        {file && (
                            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-2 rounded-md">
                                <CheckCircle size={16} />
                                <span className="font-medium">{file.name} ({(file.size / 1024).toFixed(2)} KB)</span>
                            </div>
                        )}

                        {/* Buttons */}
                        <div className="flex flex-col gap-3 w-full max-w-md">
                            <button
                                onClick={() => document.getElementById('excel-file-input')?.click()}
                                className="w-full bg-primary text-white px-6 py-3 rounded-md font-medium transition-colors"
                                disabled={uploading}
                            >
                                Select File
                            </button>

                            <button
                                onClick={handleUpload}
                                disabled={!file || uploading}
                                className={`w-full px-6 py-3 rounded-md font-medium transition-all ${!file || uploading
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-gray-500 hover:bg-gray-600 text-white'
                                    }`}
                            >
                                {uploading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Uploading...
                                    </span>
                                ) : (
                                    'Upload Brokers'
                                )}
                            </button>
                        </div>
                    </div>
                    {templateErrors.length > 0 && (
                        <div className="mt-4 text-left w-full max-w-3xl bg-red-50 border border-red-200 rounded-md p-4">
                            <p className="text-sm font-semibold text-red-700 mb-2">Template Errors:</p>
                            <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                                {templateErrors.map((err, idx) => (
                                    <li key={idx}>{err}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Results Section */}
                {results && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
                        <h3 className="text-lg font-semibold text-gray-950 flex items-center gap-2">
                            <CheckCircle className="text-green-600" size={20} />
                            Import Results
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                                <p className="text-sm text-blue-600 font-medium">Total Rows</p>
                                <p className="text-2xl font-bold text-blue-900">{results.totalRows}</p>
                            </div>
                            <div className="bg-green-50 p-4 rounded-md border border-green-200">
                                <p className="text-sm text-green-600 font-medium">Successfully Processed</p>
                                <p className="text-2xl font-bold text-green-900">{results.successCount}</p>
                            </div>
                            <div className="bg-red-50 p-4 rounded-md border border-red-200">
                                <p className="text-sm text-red-600 font-medium">Errors</p>
                                <p className="text-2xl font-bold text-red-900">{results.errorCount}</p>
                            </div>
                        </div>

                        {results.results.errors.length > 0 && (
                            <div className="mt-4">
                                <h4 className="font-semibold text-red-600 mb-2 flex items-center gap-2">
                                    <AlertCircle size={18} />
                                    Error Details
                                </h4>
                                <div className="max-h-60 overflow-y-auto border border-red-200 rounded-md">
                                    <table className="min-w-full divide-y divide-red-200">
                                        <thead className="bg-red-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-red-900">Row</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-red-900">Error</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-red-100">
                                            {results.results.errors.map((error, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-4 py-2 text-sm text-gray-900">{error.row}</td>
                                                    <td className="px-4 py-2 text-sm text-red-600">{error.error}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
