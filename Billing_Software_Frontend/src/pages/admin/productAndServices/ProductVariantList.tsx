import { useEffect, useState } from "react";
import type { FC, ChangeEvent } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import Constants from "@constants/api";
import Table from "@components/admin/Table";
import TableRow from "@components/admin/TableRow";
import CustomCheckbox from "@components/admin/CustomCheckbox";
import DeleteConfirmationModal from "@components/admin/DeleteConfirmationModal";
import LoaderSpinner from "@components/admin/LoaderSpinner";
import PaginationWrapper from "@components/admin/PaginationWrapper";
import { Printer, Edit, Download, X, Trash2Icon } from "lucide-react";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";
import PrintBarcode from "@components/admin/PrintBarcode";
import { formatVariantDisplay, getBrandName } from "@utils/formatVariantDisplay";
import { useDebounce } from "@hooks/useDebounce";

/* -------------------- TYPES -------------------- */

interface ProductVariant {
  _id: string;
  productId: {
    _id: string;
    name: string;
    brand?: {
      _id: string;
      brand_name: string;
    };
  } | string;
  designNo: string;
  color: string;
  size: string;
  purchase_price: number | string;
  sale_price: number | string;
  mrp: number | string;
  barcode: string;
}

interface VariantPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* -------------------- COMPONENT -------------------- */

const ProductVariantList: FC = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  const [searchParams, setSearchParams] = useSearchParams();

  /* -------------------- STATE -------------------- */

  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [pagination, setPagination] = useState<VariantPagination>({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [variantToDelete, setVariantToDelete] = useState<ProductVariant | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedVariantsForPrint, setSelectedVariantsForPrint] = useState<ProductVariant[]>([]);

  // Get params from URL
  const search = searchParams.get('search') || '';
  const limit = Number(searchParams.get('limit') || 10);
  const page = Number(searchParams.get('page') || 1);
  const [searchInput, setSearchInput] = useState<string>(search);
  const debouncedSearchInput = useDebounce(searchInput, 500);

  const [selectedVariantForPrint, setSelectedVariantForPrint] = useState<ProductVariant | null>(null);

  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);

  /* -------------------- FETCH VARIANTS -------------------- */

  const fetchVariants = async (search?: string, limit?: number, page?: number) => {
    try {
      setIsLoading(true);

      const res = await axios.get(
        Constants.FETCH_ALL_PRODUCTS_VARIANTS_URL,
        {
          params: { search, limit, page },
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const list = Array.isArray(res.data.data?.variants)
        ? res.data.data.variants
        : [];

      const uniqueVariants = Array.from(
        new Map(list.map((variant: ProductVariant) => [variant._id, variant])).values()
      ) as ProductVariant[];
      setVariants(uniqueVariants);
      setPagination(res.data.data?.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 });
    } catch {
      toast.error("Failed to fetch product variants");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVariants(search, limit, page);
  }, [search, limit, page]);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    if (debouncedSearchInput === search) return;
    setSearchParams({ search: debouncedSearchInput, limit: String(limit), page: '1' });
  }, [debouncedSearchInput, search, limit, setSearchParams]);

  /* -------------------- SEARCH & PAGINATION -------------------- */

  const handleSearch = (keyword: string) => {
    setSearchInput(keyword);
  };

  const handlePageLengthChange = (newLimit: number) => {
    setSearchParams({ search, limit: String(newLimit), page: '1' });
  };

  const handlePageChange = (newPage: number) => {
    setSearchParams({ search, limit: String(limit), page: String(newPage) });
  };

  const allSelected = variants.length > 0 && variants.every((variant) => selectedIds.includes(variant._id));

  const fetchSelectedVariantsForPrint = async () => {
    const res = await axios.post(Constants.FETCH_VARIANTS_BY_IDS_URL, {
      ids: selectedIds,
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return Array.isArray(res.data.data?.variants) ? res.data.data.variants : [];
  };

  const handleToggleSelectAll = (checked: boolean) => {
    const visibleIds = variants.map((variant) => variant._id);
    if (!checked) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  };

  const handleRowSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? Array.from(new Set([...prev, id])) : prev.filter((itemId) => itemId !== id)
    );
  };

  /* -------------------- BARCODE -------------------- */

  const generateBarcode = () => {
    if (!editingVariant) return;

    setEditingVariant({
      ...editingVariant,
      barcode: Math.random().toString().slice(2, 14),
    });
  };

  /* -------------------- UPDATE VARIANT -------------------- */

  const handleUpdate = async () => {
    if (!editingVariant) return;

    try {
      setIsSaving(true);

      const res = await axios.put(
        Constants.UPDATE_PRODUCTS_VARIANT_BY_ID_URL.replace(
          ":id",
          editingVariant._id
        ),
        editingVariant,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const updated = res.data.data;

      // Refetch the current page to update the list
      fetchVariants(search, limit, page);

      toast.success("Variant updated successfully");
      setEditingVariant(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Update failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (variant: ProductVariant) => {
    setVariantToDelete(variant);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!variantToDelete) return;
    try {
      setIsDeleting(true);
      await axios.delete(
        Constants.DELETE_PRODUCTS_VARIANT_URL.replace(":id", variantToDelete._id),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Variant deleted successfully");
      setShowDeleteModal(false);
      setVariantToDelete(null);
      fetchVariants(search, limit, page);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete variant");
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      setIsBulkDeleting(true);
      const response = await axios.post(Constants.BULK_DELETE_PRODUCTS_VARIANT_URL, {
        ids: selectedIds
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const deletedCount = response.data?.deletedCount ?? selectedIds.length;
      const failedCount = selectedIds.length - deletedCount;
      if (failedCount > 0) {
        toast.error(`Failed to delete ${failedCount} variant(s).`);
      } else {
        toast.success(`Deleted ${deletedCount} variant(s).`);
      }
      setShowBulkDeleteModal(false);
      setSelectedIds([]);
      fetchVariants(search, limit, page);
    } finally {
      setIsBulkDeleting(false);
    }
  };


  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      const exportSelectedOnly = selectedIds.length > 0;
      const response = await axios.get(Constants.EXPORT_PRODUCTS_VARIANTS_EXCEL_URL, {
        params: exportSelectedOnly ? { ids: selectedIds.join(',') } : { search },
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      const today = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.setAttribute('download', `Product_Variants_Export_${today}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(exportSelectedOnly ? 'Selected variants exported successfully' : 'Product variants exported successfully');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to export product variants');
    } finally {
      setIsExporting(false);
    }
  };

  const handleBulkPrint = async () => {
    if (selectedIds.length === 0) return;
    try {
      setIsPrinting(true);
      const selectedFromPage = variants.filter((v) => selectedIds.includes(v._id));
      if (selectedFromPage.length === selectedIds.length) {
        setSelectedVariantsForPrint(selectedFromPage);
        return;
      }

      const selected = await fetchSelectedVariantsForPrint();
      if (selected.length === 0) {
        toast.error("Selected variants could not be loaded for barcode printing");
        return;
      }
      const selectedById = new Map(selected.map((variant: ProductVariant) => [variant._id, variant]));
      setSelectedVariantsForPrint(
        selectedIds
          .map((id) => selectedById.get(id))
          .filter((variant): variant is ProductVariant => Boolean(variant))
      );
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to load selected variants for barcode printing");
    } finally {
      setIsPrinting(false);
    }
  };

  /* -------------------- RENDER -------------------- */

  // Calculate display range for pagination text
  const from = (pagination.page - 1) * pagination.limit + 1;
  const to = Math.min(pagination.page * pagination.limit, pagination.total);
  const visibleTotals = variants.reduce(
    (totals, variant) => ({
      purchase: totals.purchase + Number(variant.purchase_price || 0),
      sale: totals.sale + Number(variant.sale_price || 0),
      mrp: totals.mrp + Number(variant.mrp || 0),
    }),
    { purchase: 0, sale: 0, mrp: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-950">Product Variants</h1>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className={`px-3 py-1.5 rounded-md shadow-sm cursor-pointer flex items-center gap-2 ${isExporting
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-emerald-100 hover:bg-emerald-200 text-emerald-700"
              }`}
          >
            <Download size={14} /> {isExporting ? 'Exporting...' : selectedIds.length > 0 ? `Export Selected (${selectedIds.length})` : 'Export Excel'}
          </button>
          <button
            onClick={handleBulkPrint}
            disabled={selectedIds.length === 0 || isPrinting}
            className={`px-3 py-1.5 rounded-md shadow-sm cursor-pointer flex items-center gap-2 ${selectedIds.length === 0 || isPrinting
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-blue-100 hover:bg-blue-200 text-blue-700"
              }`}
          >
            <Printer size={14} /> Print Barcode
          </button>
          <button
            onClick={() => setShowBulkDeleteModal(true)}
            disabled={selectedIds.length === 0}
            className={`px-3 py-1.5 rounded-md shadow-sm cursor-pointer flex items-center gap-2 ${selectedIds.length === 0
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-red-100 hover:bg-red-200 text-red-600"
              }`}
          >
            <Trash2Icon size={14} /> Bulk Delete {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
          </button>
        </div>
      </div>

      {/* SEARCH & PAGE LENGTH */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <input
          type="text"
          placeholder="Search by design, color, size, barcode..."
          value={searchInput}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            handleSearch(e.target.value)
          }
          className="border border-gray-300 rounded-md px-4 py-2 w-full md:w-1/3 focus:outline-none focus:ring-2 focus:ring-purple-600 text-gray-950"
        />
        <select
          value={limit}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => handlePageLengthChange(Number(e.target.value))}
          className="border border-gray-300 px-3 py-2 rounded-md bg-white text-gray-950 focus:outline-none focus:ring-2 focus:ring-purple-600"
        >
          {[10, 25, 50].map((num) => <option key={num} value={num}>{num} / page</option>)}
        </select>
      </div>

      {/* TABLE (RESPONSIVE SCROLL) */}
      <div className="overflow-x-auto -mx-4 md:mx-0">
        <div className="min-w-[900px] px-4 md:px-0">
          <Table
            headers={[
              "#",
              <CustomCheckbox
                checked={allSelected}
                onChange={handleToggleSelectAll}
                disabled={variants.length === 0}
                name="select-all-variants"
              />,
              "Brand - Design No - Size",
              "Color",
              "Purchase",
              "Sale",
              "MRP",
              "Barcode",
              "Actions",
            ]}
          >
            {!isLoading &&
              variants.map((variant, index) => (
                <TableRow
                  key={variant._id}
                  index={index + 1}
                  row={variant}
                  columns={[
                    <CustomCheckbox
                      checked={selectedIds.includes(variant._id)}
                      onChange={(checked) => handleRowSelect(variant._id, checked)}
                      name={`select-variant-${variant._id}`}
                    />,
                    formatVariantDisplay({
                      brandName: getBrandName(
                        typeof variant.productId === "object" ? variant.productId?.brand : ""
                      ),
                      designNo: variant.designNo,
                      size: variant.size,
                    }) || variant.designNo || "-",
                    variant.color,
                    Number(variant.purchase_price || 0).toFixed(2),
                    Number(variant.sale_price || 0).toFixed(2),
                    Number(variant.mrp || 0).toFixed(2),
                    variant.barcode,
                  ]}
                  actions={[
                    {
                      label: "Edit",
                      icon: <Edit size={14} />,
                      onClick: () => setEditingVariant({ ...variant }),
                    },
                    {
                      label: "Delete",
                      icon: <Trash2Icon size={14} />,
                      onClick: () => handleDeleteClick(variant),
                    },
                    {
                      label: "Print",
                      icon: <Printer size={14} />,
                      onClick: () => setSelectedVariantForPrint(variant),
                    },
                  ]}
                />
              ))}

            {!isLoading && variants.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-4">
                  No variants found.
                </td>
              </tr>
            )}

            {isLoading && (
              <tr>
                <td colSpan={10} className="text-center py-4">
                  <LoaderSpinner />
                </td>
              </tr>
            )}
          </Table>
        </div>
      </div>
      <div className="sticky bottom-0 z-10 overflow-x-auto rounded-md border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-sm">
        <div className="grid min-w-[900px] grid-cols-[56px_56px_2fr_1fr_1fr_1fr_1fr_1.3fr_112px] items-center gap-4">
          <span className="col-span-4">Visible Total</span>
          <span>{visibleTotals.purchase.toFixed(2)}</span>
          <span>{visibleTotals.sale.toFixed(2)}</span>
          <span>{visibleTotals.mrp.toFixed(2)}</span>
          <span>{pagination.total} variants</span>
          <span></span>
        </div>
      </div>

      {/* PAGINATION */}
      <PaginationWrapper
        count={pagination.totalPages}
        page={page}
        from={from}
        to={to}
        total={pagination.total}
        onChange={(_, newPage) => handlePageChange(newPage)}
        paginationVariant="outlined"
        paginationShape="rounded"
      />

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
        title="Confirm Deletion"
        message="Are you sure you want to delete this variant?"
      />
      <DeleteConfirmationModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={confirmBulkDelete}
        isDeleting={isBulkDeleting}
        title="Confirm Bulk Deletion"
        message={`Are you sure you want to delete ${selectedIds.length} variant(s)?`}
      />

      {/* PRINT BARCODE */}
      {selectedVariantForPrint && (
        <PrintBarcode
          barcode={selectedVariantForPrint.barcode}
          price={Number(selectedVariantForPrint.mrp)}
          salePrice={Number(selectedVariantForPrint.sale_price)}
          productName={selectedVariantForPrint.designNo}
          variantSize={selectedVariantForPrint.size}
          brandName={
            typeof selectedVariantForPrint.productId === 'object' && selectedVariantForPrint.productId.brand
              ? selectedVariantForPrint.productId.brand.brand_name
              : ""
          }
          onClose={() => setSelectedVariantForPrint(null)}
        />
      )}
      {selectedVariantsForPrint.length > 0 && (
        <PrintBarcode
          barcodes={selectedVariantsForPrint.map((variant) => ({
            barcode: variant.barcode,
            productName: variant.designNo,
            brandName:
              typeof variant.productId === 'object' && variant.productId.brand
                ? variant.productId.brand.brand_name
                : "",
            variantSize: variant.size,
            price: Number(variant.mrp),
            salePrice: Number(variant.sale_price),
          }))}
          onClose={() => setSelectedVariantsForPrint([])}
        />
      )}

      {/* EDIT MODAL */}
      {editingVariant && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-lg">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Variant</h2>
              <button onClick={() => setEditingVariant(null)}>
                <X />
              </button>
            </div>

            <LabeledInput
              label="Design No"
              value={editingVariant.designNo}
              onChange={(v) =>
                setEditingVariant({ ...editingVariant, designNo: v })
              }
            />
            <LabeledInput
              label="Color"
              value={editingVariant.color}
              onChange={(v) =>
                setEditingVariant({ ...editingVariant, color: v })
              }
            />
            <LabeledInput
              label="Size"
              value={editingVariant.size}
              onChange={(v) =>
                setEditingVariant({ ...editingVariant, size: v })
              }
            />
            <LabeledInput
              label="Purchase Price"
              type="number"
              value={editingVariant.purchase_price}
              onChange={(v) =>
                setEditingVariant({ ...editingVariant, purchase_price: v })
              }
            />
            <LabeledInput
              label="Sale Price"
              type="number"
              value={editingVariant.sale_price}
              onChange={(v) =>
                setEditingVariant({ ...editingVariant, sale_price: v })
              }
            />
            <LabeledInput
              label="MRP"
              type="number"
              value={editingVariant.mrp}
              onChange={(v) =>
                setEditingVariant({ ...editingVariant, mrp: v })
              }
            />

            {/* BARCODE */}
            <div className="mt-2">
              <label className="block text-xs font-medium text-gray-600">
                Barcode
              </label>
              <div className="flex mt-1">
                <input
                  type="text"
                  value={editingVariant.barcode}
                  onChange={(e) =>
                    setEditingVariant({
                      ...editingVariant,
                      barcode: e.target.value,
                    })
                  }
                  className="p-2 border w-full rounded-l-md text-sm border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-primary"
                />

                <button
                  type="button"
                  onClick={generateBarcode}
                  className="px-3 bg-gray-200 rounded-r-md"
                >
                  Generate
                </button>

              </div>
            </div>

            <button
              onClick={handleUpdate}
              disabled={isSaving}
              className="w-full bg-primary text-white py-2 rounded mt-4"
            >
              {isSaving ? "Saving..." : "Update Variant"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductVariantList;

/* -------------------- HELPERS -------------------- */

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="mb-2">
      <label className="block text-xs font-medium text-gray-600">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full p-2 border rounded-md text-sm border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-600 focus:border-primary"
      />
    </div>
  );
}
