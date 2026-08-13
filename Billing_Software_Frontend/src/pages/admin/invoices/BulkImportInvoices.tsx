import React, { useState } from 'react';
import axios from 'axios';
import Constants from '../../../constants/api';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { validateExcelTemplate } from '@utils/excelTemplate';


interface UploadResults {
    totalRows: number;
    invoicesCreated: number;
    errors: Array<{
        row: number;
        reason: string;
        data?: any;
    }>;
}

export default function BulkImportInvoices() {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [results, setResults] = useState<UploadResults | null>(null);
    const [templateErrors, setTemplateErrors] = useState<string[]>([]);
    const { token } = useSelector((state: RootState) => state.auth);
    const invoiceTemplateHeaders = [
        'Invoice Number',
        'Date',
        'Phone',
        'Tax Type',
        'GST Type',
        'Status',
        'Payment Method',
        'Design No',
        'Variant (Color)',
        'Variant (Size)',
        'Quantity',
        'Rate',
        'Tax',
        'Discount',
        'Item Total',
        'Invoice Total',
        'Paid Amount',
        'Balance'
    ];

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (!selectedFile.name.endsWith('.xlsx')) {
                toast.error('Please select a valid Excel file (.xlsx)');
                return;
            }
            const templateCheck = await validateExcelTemplate(selectedFile, invoiceTemplateHeaders);
            if (!templateCheck.ok) {
                toast.error(templateCheck.message || 'Selected file does not match the invoice template.');
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

        const templateCheck = await validateExcelTemplate(file, invoiceTemplateHeaders);
        if (!templateCheck.ok) {
            toast.error(templateCheck.message || 'Selected file does not match the invoice template.');
            setTemplateErrors(templateCheck.details || [templateCheck.message || 'Invalid template']);
            return;
        }

        setTemplateErrors([]);
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post(
                Constants.UPLOAD_INVOICES_EXCEL_URL,
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
            const response = await axios.get(
                Constants.DOWNLOAD_INVOICE_TEMPLATE_URL,
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
            link.setAttribute('download', 'Historical_Invoice_Import.xlsx');
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
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-950">Bulk Invoice Upload</h1>
                    <p className="text-sm text-gray-600 mt-1">Upload multiple invoices from an Excel file</p>
                </div>

                {/* File Format Section - Full Width */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <div className="flex items-start gap-3 mb-4">
                        <Info className="text-blue-600 mt-0.5" size={20} />
                        <div>
                            <h2 className="text-base font-semibold text-blue-900">File Format</h2>
                            <p className="text-sm text-blue-700 mt-1">
                                Your file (Excel .xlsx) should have the following columns (in order):
                            </p>
                        </div>
                    </div>

                    {/* Two Column Layout for File Format - 9 rows each */}
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 ml-8 text-sm text-blue-900">
                        {/* Column 1 - Items 1-9 */}
                        <div className="space-y-2">
                            <p><span className="font-semibold">1. Invoice Number</span> - Auto-generated if left empty</p>
                            <p><span className="font-semibold">2. Date</span> - Format: DD/MM/YYYY (e.g., 30/01/2024) - Required</p>
                            <p><span className="font-semibold">3. Phone</span> - Customer phone number (Optional)</p>
                            <p><span className="font-semibold">4. Tax Type</span> - GST, VAT, etc. (Optional, Default: GST)</p>
                            <p><span className="font-semibold">5. GST Type</span> - IGST, CGST+SGST, Exclusive (Optional)</p>
                            <p><span className="font-semibold">6. Status</span> - PAID, UNPAID, DRAFT, etc. (Optional, Default: PAID)</p>
                            <p><span className="font-semibold">7. Payment Method</span> - Cash, UPI, Card, etc. (Optional)</p>
                            <p><span className="font-semibold">8. Design No</span> - Required for each line item</p>
                            <p><span className="font-semibold">9. Variant (Color)</span> - Optional</p>
                        </div>

                        {/* Column 2 - Items 10-18 */}
                        <div className="space-y-2">
                            <p><span className="font-semibold">10. Variant (Size)</span> - Optional</p>
                            <p><span className="font-semibold">11. Quantity</span> - Number of units (Required)</p>
                            <p><span className="font-semibold">12. Rate</span> - Unit price (Required)</p>
                            <p><span className="font-semibold">13. Tax</span> - Tax percentage (e.g., 18 for 18%)</p>
                            <p><span className="font-semibold">14. Discount</span> - Discount amount per item</p>
                            <p><span className="font-semibold">15. Item Total</span> - Auto-calculated if empty</p>
                            <p><span className="font-semibold">16. Invoice Total</span> - Fill only on first row</p>
                            <p><span className="font-semibold">17. Paid Amount</span> - Fill only on first row</p>
                            <p><span className="font-semibold">18. Balance</span> - Auto-calculated</p>
                        </div>
                    </div>

                    <div className="mt-4 ml-8 text-xs text-blue-800 bg-blue-100 p-3 rounded">
                        <strong>Note:</strong> This import is for historical records only. Products/variants are not created. Customer phone is optional. Use the same Reference No to group items into a single invoice.
                    </div>

                    <button
                        onClick={handleDownloadTemplate}
                        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors text-sm"
                    >
                        Download Sample template
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
                                    'Upload Invoices'
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
                                <p className="text-sm text-green-600 font-medium">Invoices Created</p>
                                <p className="text-2xl font-bold text-green-900">{results.invoicesCreated}</p>
                            </div>
                            <div className="bg-red-50 p-4 rounded-md border border-red-200">
                                <p className="text-sm text-red-600 font-medium">Errors</p>
                                <p className="text-2xl font-bold text-red-900">{results.errors.length}</p>
                            </div>
                        </div>

                        {results.errors.length > 0 && (
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
                                                <th className="px-4 py-2 text-left text-xs font-medium text-red-900">Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-red-100">
                                            {results.errors.map((error, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-4 py-2 text-sm text-gray-900">{error.row}</td>
                                                    <td className="px-4 py-2 text-sm text-red-600">{error.reason}</td>
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
