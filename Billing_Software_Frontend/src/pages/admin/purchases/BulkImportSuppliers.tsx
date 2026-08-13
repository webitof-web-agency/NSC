import React, { useState } from 'react';
import axios from 'axios';
import Constants from '../../../constants/api';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import { FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { validateExcelTemplate } from '@utils/excelTemplate';

interface UploadResults {
    totalRows: number;
    suppliersCreated: number;
    errors: Array<{
        row: number;
        reason: string;
        data?: any;
    }>;
}

export default function BulkImportSuppliers() {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [results, setResults] = useState<UploadResults | null>(null);
    const [templateErrors, setTemplateErrors] = useState<string[]>([]);
    const { token } = useSelector((state: RootState) => state.auth);
    const supplierTemplateHeaders = [
        'Company Name',
        'Phone Number',
        'Email',
        'Country',
        'Address',
        'City',
        'State',
        'Pin Code',
        'PAN',
        'GST',
        'Bank Name',
        'Account Number',
        'IFSC',
        'Account Holder',
        'Account Type'
    ];

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (!selectedFile.name.endsWith('.xlsx')) {
                toast.error('Please select a valid Excel file (.xlsx)');
                return;
            }
            const templateCheck = await validateExcelTemplate(selectedFile, supplierTemplateHeaders);
            if (!templateCheck.ok) {
                toast.error(templateCheck.message || 'Selected file does not match the supplier template.');
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

        const templateCheck = await validateExcelTemplate(file, supplierTemplateHeaders);
        if (!templateCheck.ok) {
            toast.error(templateCheck.message || 'Selected file does not match the supplier template.');
            setTemplateErrors(templateCheck.details || [templateCheck.message || 'Invalid template']);
            return;
        }

        setTemplateErrors([]);
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post(
                Constants.UPLOAD_SUPPLIERS_EXCEL_URL,
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

    const handleDownloadTemplate = async () => {
        try {
            const response = await axios.get(Constants.DOWNLOAD_SUPPLIER_TEMPLATE_URL, {
                responseType: 'blob',
                headers: { Authorization: `Bearer ${token}` }
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'supplier_import_template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Failed to download template');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Bulk Supplier Upload</h1>
                <p className="text-gray-500">Upload multiple suppliers from an Excel file</p>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                    <AlertCircle className="text-blue-600 h-5 w-5" />
                    <h3 className="text-lg font-semibold text-blue-900">File Format</h3>
                </div>

                <p className="text-blue-800 mb-4">Your file (Excel .xlsx) should have the following columns (in order):</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 mb-6 ml-1">
                    <ol className="list-decimal list-inside space-y-2 text-sm text-blue-900 font-medium" start={1}>
                        <li><span className="font-bold">Company Name</span> - Supplier company name (Required)</li>
                        <li><span className="font-bold">Phone Number</span> - Contact number (Required)</li>
                        <li><span className="font-bold">Email</span> - Unique email address (Optional)</li>
                        <li><span className="font-bold">Country</span> - Country (Optional)</li>
                        <li><span className="font-bold">Address</span> - Company address (Optional)</li>
                        <li><span className="font-bold">City</span> - City (Optional)</li>
                        <li><span className="font-bold">State</span> - State (Optional)</li>
                        <li><span className="font-bold">Pin Code</span> - Postal code (Optional)</li>
                    </ol>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-blue-900 font-medium" start={9}>
                        <li><span className="font-bold">PAN</span> - PAN number (Optional)</li>
                        <li><span className="font-bold">GST</span> - GST number (Optional)</li>
                        <li><span className="font-bold">Bank Name</span> - Name of the bank (Optional)</li>
                        <li><span className="font-bold">Account Number</span> - Bank account number (Optional)</li>
                        <li><span className="font-bold">IFSC</span> - Bank IFSC code (Optional)</li>
                        <li><span className="font-bold">Account Holder</span> - Name on account (Optional)</li>
                        <li><span className="font-bold">Account Type</span> - Type of account e.g. Savings (Optional)</li>
                    </ol>
                </div>

                <p className="text-xs text-blue-700 mb-6">
                    <strong>Note:</strong> Bank details are only added if "Bank Name", "Account Number", and "IFSC" are all present. Existing emails will cause a row error.
                </p>

                <button
                    onClick={handleDownloadTemplate}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors shadow-sm"
                >
                    Download Sample template
                </button>
            </div>

            {/* Upload Area */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 flex flex-col items-center justify-center bg-gray-50">
                    <FileSpreadsheet className="h-16 w-16 text-gray-400 mb-4" />

                    <div className="mb-6 w-full max-w-xs">
                        <input
                            id="excel-file-input"
                            type="file"
                            accept=".xlsx"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <label
                            htmlFor="excel-file-input"
                            className="block w-full px-4 py-2 bg-primary text-white text-center font-medium rounded-md cursor-pointer transition-colors shadow-sm mb-3"
                        >
                            Select File
                        </label>

                        {file && (
                            <div className="flex items-center justify-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full mb-3">
                                <CheckCircle size={14} />
                                <span className="font-medium truncate max-w-[200px]">{file.name}</span>
                            </div>
                        )}

                        <button
                            onClick={handleUpload}
                            disabled={!file || uploading}
                            className={`block w-full px-4 py-2 text-center font-medium rounded-md transition-colors shadow-sm ${!file || uploading
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                                }`}
                        >
                            {uploading ? 'Uploading...' : 'Upload Suppliers'}
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

                {/* Results Section (Only visible after upload) */}
                {results && (
                    <div className="mt-8">
                        <h3 className="text-lg font-semibold text-gray-950 mb-4">Import Results</h3>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                <div className="text-sm text-gray-600 font-medium mb-1">Total Rows</div>
                                <div className="text-3xl font-bold text-gray-950">{results.totalRows}</div>
                            </div>
                            <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                                <div className="text-sm text-green-700 font-medium mb-1">Suppliers Created</div>
                                <div className="text-3xl font-bold text-green-700">{results.suppliersCreated}</div>
                            </div>
                            <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                                <div className="text-sm text-red-700 font-medium mb-1">Errors</div>
                                <div className="text-3xl font-bold text-red-700">{results.errors.length}</div>
                            </div>
                        </div>

                        {results.errors.length > 0 && (
                            <div className="border rounded-lg overflow-hidden border-gray-200">
                                <div className="bg-red-50 px-4 py-2 border-b border-red-100 flex items-center gap-2">
                                    <AlertCircle className="text-red-600" size={16} />
                                    <h4 className="font-semibold text-red-800 text-sm">Error Details</h4>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Row</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {results.errors.map((error, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm font-medium text-gray-950">{error.row}</td>
                                                    <td className="px-4 py-3 text-sm text-red-600">{error.reason}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-600">{error.data?.['Company Name'] || '-'}</td>
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
