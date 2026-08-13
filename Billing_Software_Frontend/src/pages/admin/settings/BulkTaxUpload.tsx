import { useState } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import Constants from '../../../constants/api';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { validateExcelTemplate } from '@utils/excelTemplate';

interface UploadResult {
    success: boolean;
    message: string;
    summary: {
        rates: {
            inserted: number;
            skipped: Array<{ row: number; reason: string }>;
        };
        groups: {
            inserted: number;
            skipped: Array<{ row: number; reason: string }>;
        };
    };
}

const BulkTaxUpload = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
    const [templateErrors, setTemplateErrors] = useState<string[]>([]);
    const { token } = useSelector((state: RootState) => state.auth);
    const taxRateHeaders = ['tax_name', 'tax_rate', 'status'];
    const taxGroupHeaders = ['tax_name', 'tax_rates'];

    const validateTaxWorkbook = async (selectedFile: File) => {
        const taxRateCheck = await validateExcelTemplate(selectedFile, taxRateHeaders, 'TaxRates');
        if (!taxRateCheck.ok) {
            return {
                ok: false,
                message: `TaxRates sheet: ${taxRateCheck.message}`,
                details: (taxRateCheck.details || []).map((d) => `TaxRates: ${d}`)
            };
        }
        const taxGroupCheck = await validateExcelTemplate(selectedFile, taxGroupHeaders, 'TaxGroups');
        if (!taxGroupCheck.ok) {
            return {
                ok: false,
                message: `TaxGroups sheet: ${taxGroupCheck.message}`,
                details: (taxGroupCheck.details || []).map((d) => `TaxGroups: ${d}`)
            };
        }
        return { ok: true, message: '' };
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];

            // Validate file type
            if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
                toast.error('Please select a valid Excel file');
                return;
            }

            const templateCheck = await validateTaxWorkbook(selectedFile);
            if (!templateCheck.ok) {
                toast.error(templateCheck.message || 'Selected file does not match the tax template.');
                setTemplateErrors(templateCheck.details || [templateCheck.message || 'Invalid template']);
                e.target.value = '';
                return;
            }

            setTemplateErrors([]);
            setFile(selectedFile);
            setUploadResult(null); // Clear previous results
        }
    };

    const handleUpload = async () => {
        if (!file) {
            toast.error('Please select a file first');
            return;
        }

        const templateCheck = await validateTaxWorkbook(file);
        if (!templateCheck.ok) {
            toast.error(templateCheck.message || 'Selected file does not match the tax template.');
            setTemplateErrors(templateCheck.details || [templateCheck.message || 'Invalid template']);
            return;
        }

        setTemplateErrors([]);
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post(
                Constants.UPLOAD_UNIFIED_TAX_EXCEL_URL,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            setUploadResult(response.data);
            toast.success('File uploaded successfully!');
            setFile(null); // Clear file input

        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error(error?.response?.data?.message || 'Failed to upload tax data');
        } finally {
            setIsUploading(false);
        }
    };

    const downloadSampleTemplate = async () => {
        try {
            const response = await axios.get(Constants.DOWNLOAD_TAX_SAMPLE_URL, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'Tax_Upload_Template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (error) {
            toast.error("Failed to download sample template");
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <Link to="/admin/settings/taxes" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-colors">
                    <ArrowLeft size={18} className="mr-2" />
                    Back to Tax Settings
                </Link>

                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Bulk Tax Upload</h1>
                    <p className="text-gray-600">Upload both Tax Rates and Tax Groups from a single Excel file.</p>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                    <h2 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <AlertCircle size={20} />
                        File Format Instructions
                    </h2>
                    <div className="text-sm text-blue-800 space-y-4">
                        <p>Your Excel file must contain two sheets named exactly:</p>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-white p-4 rounded border border-blue-100">
                                <h3 className="font-bold text-blue-900 mb-2">Sheet 1: TaxRates</h3>
                                <p className="mb-2">Columns:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li><strong>tax_name</strong> (e.g., GST 5%)</li>
                                    <li><strong>tax_rate</strong> (e.g., 5)</li>
                                    <li><strong>status</strong> (TRUE/FALSE, optional)</li>
                                </ul>
                            </div>
                            <div className="bg-white p-4 rounded border border-blue-100">
                                <h3 className="font-bold text-blue-900 mb-2">Sheet 2: TaxGroups</h3>
                                <p className="mb-2">Columns:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    <li><strong>tax_name</strong> (e.g., IGST 18%)</li>
                                    <li><strong>tax_rates</strong> (Comma separated names e.g., CGST 9%, SGST 9%)</li>
                                </ul>
                            </div>
                        </div>
                        <p className="mt-2 font-medium">The system creates Tax Rates first, then Tax Groups.</p>
                    </div>
                    <button
                        onClick={downloadSampleTemplate}
                        className="mt-4 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
                    >
                        Download Sample Template
                    </button>
                </div>

                {/* Upload Section */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-4" />


                        <div className="mb-4">
                            <label htmlFor="file-upload" className="cursor-pointer">
                                <span className="inline-flex items-center gap-2 bg-primary hover:bg-gray-900 text-white px-6 py-3 rounded-md transition-colors font-medium">
                                    <Upload size={20} />
                                    Select Excel File
                                </span>
                                <input
                                    id="file-upload"
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </label>
                        </div>

                        {file && (
                            <p className="text-sm text-gray-600 mb-4">
                                Selected: <span className="font-medium text-gray-900">{file.name}</span>
                            </p>
                        )}

                        <button
                            onClick={handleUpload}
                            disabled={!file || isUploading}
                            className={`w-full max-w-xs mx-auto block px-6 py-3 rounded-md font-medium transition-colors ${!file || isUploading
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                        >
                            {isUploading ? 'Uploading...' : 'Upload Tax Data'}
                        </button>
                        {templateErrors.length > 0 && (
                            <div className="mt-4 text-left max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-md p-4">
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
                {uploadResult && (
                    <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
                        <h2 className="text-xl font-bold text-gray-900">Upload Summary</h2>

                        {/* Tax Rates Summary */}
                        <div>
                            <h3 className="font-semibold text-gray-800 mb-2">Tax Rates</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-50 p-3 rounded flex justify-between items-center">
                                    <span className="text-green-800 flex items-center gap-2"><CheckCircle2 size={16} /> Inserted</span>
                                    <span className="font-bold text-green-900">{uploadResult.summary.rates.inserted}</span>
                                </div>
                                <div className="bg-gray-50 p-3 rounded flex justify-between items-center">
                                    <span className="text-gray-600">Skipped/Failed</span>
                                    <span className="font-bold text-gray-900">{uploadResult.summary.rates.skipped.length}</span>
                                </div>
                            </div>
                            {uploadResult.summary.rates.skipped.length > 0 && (
                                <div className="mt-2 text-sm text-red-600 bg-red-50 p-3 rounded border border-red-100 max-h-40 overflow-y-auto">
                                    <p className="font-semibold mb-1">Errors:</p>
                                    <ul className="list-disc list-inside">
                                        {uploadResult.summary.rates.skipped.map((err, i) => (
                                            <li key={i}>Row {err.row}: {err.reason}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-gray-200"></div>

                        {/* Tax Groups Summary */}
                        <div>
                            <h3 className="font-semibold text-gray-800 mb-2">Tax Groups</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-50 p-3 rounded flex justify-between items-center">
                                    <span className="text-green-800 flex items-center gap-2"><CheckCircle2 size={16} /> Inserted</span>
                                    <span className="font-bold text-green-900">{uploadResult.summary.groups.inserted}</span>
                                </div>
                                <div className="bg-gray-50 p-3 rounded flex justify-between items-center">
                                    <span className="text-gray-600">Skipped/Failed</span>
                                    <span className="font-bold text-gray-900">{uploadResult.summary.groups.skipped.length}</span>
                                </div>
                            </div>
                            {uploadResult.summary.groups.skipped.length > 0 && (
                                <div className="mt-2 text-sm text-red-600 bg-red-50 p-3 rounded border border-red-100 max-h-40 overflow-y-auto">
                                    <p className="font-semibold mb-1">Errors:</p>
                                    <ul className="list-disc list-inside">
                                        {uploadResult.summary.groups.skipped.map((err, i) => (
                                            <li key={i}>Row {err.row}: {err.reason}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};

export default BulkTaxUpload;
