import { useState } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '@store/index';
import Constants from '@constants/api';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { validateExcelTemplate } from '@utils/excelTemplate';

interface UploadResult {
    successCount: number;
    skippedDuplicateCount?: number;
    errorCount: number;
    successes: Array<{ row: number; designNo: string; category: string; brand: string; productCode?: string }>;
    skippedDuplicates?: Array<{ row: number; designNo: string; category: string; brand: string; reason: string }>;
    errors: Array<{ row: number; error: string }>;
}

const BulkProductUpload = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
    const [templateErrors, setTemplateErrors] = useState<string[]>([]);
    const { token } = useSelector((state: RootState) => state.auth);
    const productTemplateHeaders = [
        'Category',
        'Brand',
        'Unit',
        'Opening Stock',
        'Purchase Price',
        'Sale Price',
        'Min. Sale Price',
        'MRP',
        'Brand - Design Number - Size',
        'Color',
        'HSN Code',
        'GST Tax Rate',
        'Discount',
        'Reorder Limit',
        'Barcode'
    ];

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];

            // Validate file type
            if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls') && !selectedFile.name.endsWith('.csv')) {
                toast.error('Please select a valid Excel or CSV file');
                return;
            }

            const templateCheck = await validateExcelTemplate(selectedFile, productTemplateHeaders);
            if (!templateCheck.ok) {
                toast.error(templateCheck.message || 'Selected file does not match the product template.');
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

        const templateCheck = await validateExcelTemplate(file, productTemplateHeaders);
        if (!templateCheck.ok) {
            toast.error(templateCheck.message || 'Selected file does not match the product template.');
            setTemplateErrors(templateCheck.details || [templateCheck.message || 'Invalid template']);
            return;
        }

        setTemplateErrors([]);
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post(
                Constants.UPLOAD_PRODUCTS_EXCEL_URL,
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            setUploadResult(response.data.data);

            if (response.data.data.errorCount === 0) {
                if ((response.data.data.skippedDuplicateCount || 0) > 0) {
                    toast.success(
                        `Uploaded ${response.data.data.successCount} rows and skipped ${response.data.data.skippedDuplicateCount} duplicate variants`
                    );
                } else {
                    toast.success(`Successfully uploaded ${response.data.data.successCount} products!`);
                }
            } else {
                toast.warning(
                    `Uploaded ${response.data.data.successCount} rows with ${response.data.data.errorCount} errors`
                );
            }

            // Clear file input
            setFile(null);

        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error(error?.response?.data?.message || 'Failed to upload products');
        } finally {
            setIsUploading(false);
        }
    };

    const downloadSampleTemplate = () => {
        axios
            .get(Constants.DOWNLOAD_PRODUCTS_TEMPLATE_URL, {
                responseType: 'blob',
                headers: { Authorization: `Bearer ${token}` },
            })
            .then((response) => {
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.download = 'product_upload_template.xlsx';
                document.body.appendChild(link);
                link.click();
                link.remove();
                toast.success('Sample template downloaded');
            })
            .catch((error) => {
                console.error('Download error:', error);
                toast.error('Failed to download template');
            });
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Bulk Product Upload</h1>
                    <p className="text-gray-600">Upload multiple products from an Excel or CSV file</p>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                    <h2 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <AlertCircle size={20} />
                        File Format
                    </h2>
                    <div className="text-sm text-blue-800 space-y-2">
                        <p>Your file (Excel .xlsx or CSV) should have the following columns (in order):</p>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                            <li><strong>Category</strong> - Category name (Required for new product, auto-creates if doesn't exist)</li>
                            <li><strong>Brand</strong> - Brand name (Required for new product, auto-creates if doesn't exist)</li>
                            <li><strong>Unit</strong> - Unit full name (Required for new product, auto-creates if doesn't exist)</li>
                            <li><strong>Opening Stock</strong> - Opening stock for this variant (Optional)</li>
                            <li><strong>Purchase Price</strong> - Variant purchase price (Optional)</li>
                            <li><strong>Sale Price</strong> - Variant sale price (Optional)</li>
                            <li><strong>Min. Sale Price</strong> - Variant minimum sale price (Optional)</li>
                            <li><strong>MRP</strong> - Variant MRP (Optional)</li>
                            <li><strong>Brand - Design Number - Size</strong> - Variant brand, design number and size combined (Optional). E.g., 'Samsung - ABC123 - XL'</li>
                            <li><strong>Color</strong> - Variant color (Optional)</li>
                            <li><strong>HSN Code</strong> - HSN code (Optional - saved to Product & Brand)</li>
                            <li><strong>GST Tax Rate</strong> - GST rate (Optional - creates tax group and applies to Category and Product)</li>
                            <li><strong>Discount</strong> - Variant discount value (Optional)</li>
                            <li><strong>Reorder Limit</strong> - Variant reorder limit (Optional)</li>
                            <li><strong>Barcode</strong> - Variant barcode (Optional, if blank auto-generated)</li>
                        </ol>
                        <p className="mt-3 text-blue-700">
                            <strong>Note:</strong> Product Code is auto-generated. Categories, brands, and units will be created automatically. HSN code will be saved to both the Product and the Brand. If <strong>GST Tax Rate</strong> is provided, it will create a tax group and apply it to the Category and Product. If <strong>Opening Stock</strong> is provided, inventory will be created for that variant. If <strong>Barcode</strong> is provided, it will be used; otherwise it will be auto-generated. To add multiple variants, enter the product columns on the first row and leave them blank on subsequent rows until a new product group starts.
                        </p>
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
                                    Select File
                                </span>
                                <input
                                    id="file-upload"
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
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
                            {isUploading ? 'Uploading...' : 'Upload Products'}
                        </button>
                    </div>
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

                {/* Results Section */}
                {uploadResult && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Upload Results</h2>

                        {/* Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-green-700 mb-1">
                                    <CheckCircle2 size={20} />
                                    <span className="font-semibold">Successful</span>
                                </div>
                                <p className="text-2xl font-bold text-green-900">{uploadResult.successCount}</p>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-amber-700 mb-1">
                                    <AlertCircle size={20} />
                                    <span className="font-semibold">Duplicates Skipped</span>
                                </div>
                                <p className="text-2xl font-bold text-amber-900">{uploadResult.skippedDuplicateCount || 0}</p>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-red-700 mb-1">
                                    <XCircle size={20} />
                                    <span className="font-semibold">Failed</span>
                                </div>
                                <p className="text-2xl font-bold text-red-900">{uploadResult.errorCount}</p>
                            </div>
                        </div>

                        {/* Success List */}
                        {uploadResult.successes.length > 0 && (
                            <div className="mb-6">
                                <h3 className="font-semibold text-gray-900 mb-3">Successfully Created Products</h3>
                                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Row</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Design No</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Brand</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {uploadResult.successes.map((item, index) => (
                                                <tr key={index}>
                                                    <td className="px-4 py-2 text-sm text-gray-900">{item.row}</td>
                                                    <td className="px-4 py-2 text-sm text-gray-900">{item.designNo || '-'}</td>
                                                    <td className="px-4 py-2 text-sm text-gray-900">{item.category || '-'}</td>
                                                    <td className="px-4 py-2 text-sm text-gray-600">{item.brand || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Skipped Duplicates List */}
                        {(uploadResult.skippedDuplicates?.length || 0) > 0 && (
                            <div className="mb-6">
                                <h3 className="font-semibold text-gray-900 mb-3">Skipped Duplicate Variants</h3>
                                <div className="max-h-60 overflow-y-auto border border-amber-200 rounded-lg">
                                    <table className="min-w-full divide-y divide-amber-200">
                                        <thead className="bg-amber-50 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-amber-700 uppercase">Row</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-amber-700 uppercase">Design No</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-amber-700 uppercase">Category</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-amber-700 uppercase">Brand</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-amber-700 uppercase">Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-amber-100">
                                            {uploadResult.skippedDuplicates?.map((item, index) => (
                                                <tr key={index}>
                                                    <td className="px-4 py-2 text-sm text-gray-900">{item.row}</td>
                                                    <td className="px-4 py-2 text-sm text-gray-900">{item.designNo || '-'}</td>
                                                    <td className="px-4 py-2 text-sm text-gray-900">{item.category || '-'}</td>
                                                    <td className="px-4 py-2 text-sm text-gray-600">{item.brand || '-'}</td>
                                                    <td className="px-4 py-2 text-sm text-amber-700">{item.reason}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Error List */}
                        {uploadResult.errors.length > 0 && (
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3">Errors</h3>
                                <div className="max-h-60 overflow-y-auto border border-red-200 rounded-lg">
                                    <table className="min-w-full divide-y divide-red-200">
                                        <thead className="bg-red-50 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-red-700 uppercase">Row</th>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-red-700 uppercase">Error</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-red-100">
                                            {uploadResult.errors.map((item, index) => (
                                                <tr key={index}>
                                                    <td className="px-4 py-2 text-sm text-gray-900">{item.row}</td>
                                                    <td className="px-4 py-2 text-sm text-red-600">{item.error}</td>
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
};

export default BulkProductUpload;
