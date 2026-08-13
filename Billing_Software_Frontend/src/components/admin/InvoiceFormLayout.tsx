import React from "react";
import { PlusCircle, ScanBarcode, Eye, EyeOff } from "lucide-react";
import type { ProductItem } from "@models/product";
import ProductItemsSummaryFooter from "./ProductItemsSummaryFooter";

export type SummaryRow = {
  label: React.ReactNode;
  value: React.ReactNode;
};

type InvoiceNumberField = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  showSettings?: boolean;
  onOpenSettings?: () => void;
  error?: string;
  settingsIcon?: React.ReactNode;
};

type DateField = {
  label: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
  minDate?: Date;
  required?: boolean;
  error?: string;
  inputNode: React.ReactNode;
};

type ExtraInfoTab = {
  id: string;
  label: string;
  content: React.ReactNode;
};

type ExtraInfoConfig = {
  title: string;
  showToggle?: boolean;
  isVisible?: boolean;
  onToggle?: () => void;
  tabs: ExtraInfoTab[];
  activeTabId: string;
  onTabChange: (id: string) => void;
};

type ScannerConfig = {
  isOpen: boolean;
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
};

interface InvoiceFormLayoutProps {
  mode?: "invoice" | "credit-note";
  title: string;
  titleActions?: React.ReactNode;
  logoSrc?: string;
  onSubmit?: (e: React.FormEvent) => void;
  invoiceNumberField?: InvoiceNumberField;
  dateField?: DateField;
  taxTypeField?: React.ReactNode;
  headerFields?: React.ReactNode[];
  preItemsSection?: React.ReactNode;
  itemsError?: string;
  items: ProductItem[];
  renderRow: (item: ProductItem, index: number) => React.ReactNode;
  showAddRow?: boolean;
  onAddRow?: () => void;
  showScanBarcode?: boolean;
  onScanBarcode?: () => void;
  scanner?: ScannerConfig;
  itemsFooter?: React.ReactNode;
  extraInfo?: ExtraInfoConfig;
  summaryRows: SummaryRow[];
  summaryFooter?: React.ReactNode;
  totalInWords?: string;
  footerButtons?: React.ReactNode;
  footerContainerClassName?: string;
  taxHeaderLabel?: string;
  currencySymbol?: string;
}

const InvoiceFormLayout: React.FC<InvoiceFormLayoutProps> = ({
  title,
  titleActions,
  logoSrc,
  onSubmit,
  invoiceNumberField,
  dateField,
  taxTypeField,
  headerFields = [],
  preItemsSection,
  itemsError,
  items,
  renderRow,
  showAddRow = true,
  onAddRow,
  showScanBarcode = true,
  onScanBarcode,
  scanner,
  itemsFooter,
  extraInfo,
  summaryRows,
  summaryFooter,
  totalInWords,
  footerButtons,
  footerContainerClassName = "flex justify-end mt-4 gap-3",
  taxHeaderLabel = "Tax",
  currencySymbol = "",
}) => {
  return (
    <div className="md:p-4 bg-white-50 min-h-screen border border-gray-200 rounded pb-4 md:pb-24 relative">
      <form onSubmit={onSubmit}>
        <div className="max-w-7xl mx-auto space-y-2">
          <div className="flex justify-between items-center mb-2 gap-4">
            <h1 className="text-2xl font-bold text-gray-950">{title}</h1>
            <div className="flex items-center gap-3">
              {titleActions}
              {logoSrc && (
                <img
                  src={logoSrc}
                  alt=""
                  className="w-32"
                />
              )}
            </div>
          </div>

          <div className="w-full">
            <div className="flex flex-wrap gap-4 w-full items-center">
              {invoiceNumberField && (
                <div className="w-52">
                  <label className="block text-sm font-medium text-gray-900">
                    {invoiceNumberField.label}
                  </label>
                  <div className="relative mt-1">
                    <input
                      type="text"
                      name="invoiceNumber"
                      className="border border-gray-300 rounded-md px-4 py-2 w-full pr-10 text-gray-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
                      placeholder={invoiceNumberField.placeholder}
                      value={invoiceNumberField.value}
                      readOnly={invoiceNumberField.readOnly}
                      onChange={(e) => invoiceNumberField.onChange(e.target.value)}
                    />
                    {invoiceNumberField.showSettings && invoiceNumberField.onOpenSettings && (
                      <button
                        type="button"
                        onClick={invoiceNumberField.onOpenSettings}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 cursor-pointer hover:text-primary"
                      >
                        {invoiceNumberField.settingsIcon}
                      </button>
                    )}
                  </div>
                  {invoiceNumberField.error && (
                    <span className="text-red-500 text-sm">
                      {invoiceNumberField.error}
                    </span>
                  )}
                </div>
              )}

              {dateField && (
                <div className="w-44">
                  {dateField.inputNode}
                  {dateField.error && (
                    <span className="text-red-500 text-sm">{dateField.error}</span>
                  )}
                </div>
              )}

              {taxTypeField && (
                <div className="w-32">
                  {taxTypeField}
                </div>
              )}

              {headerFields.map((field, index) => (
                <div key={index} className="w-56">
                  {field}
                </div>
              ))}
            </div>
          </div>

          {preItemsSection}

          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4">
              {itemsError && (
                <span className="text-red-500 text-sm">{itemsError}</span>
              )}
              {itemsFooter && (
                <div className="pb-4">{itemsFooter}</div>
              )}
              <div className="overflow-x-auto overflow-y-auto max-h-[55vh]">
                <div className="w-full">
                  <table className="w-full min-w-[1080px] table-fixed border-separate border-spacing-0">
                    <colgroup>
                      <col className="w-[4rem]" />
                      <col className="w-[27%]" />
                      <col className="w-[12%]" />
                      <col className="w-[9%]" />
                      <col className="w-[9%]" />
                      <col className="w-[9%]" />
                      <col className="w-[9%]" />
                      <col className="w-[7%]" />
                      <col className="w-[12%]" />
                      <col className="w-[6rem]" />
                    </colgroup>
                    <thead className="bg-gray-950 text-white sticky top-0 z-10">
                      <tr>
                        <th className="p-2 text-left text-sm font-semibold rounded-tl-md w-12">S.No.</th>
                        <th className="p-2 text-left text-sm font-semibold">Product</th>
                        <th className="p-2 text-left text-sm font-semibold">Color / Size</th>
                        <th className="p-2 text-left text-sm font-semibold">Quantity</th>
                        <th className="p-2 text-left text-sm font-semibold">Rate</th>
                        <th className="p-2 text-left text-sm font-semibold">Discount</th>
                        <th className="p-2 text-left text-sm font-semibold">{taxHeaderLabel}</th>
                        <th className="p-2 text-left text-sm font-semibold">Staff</th>
                        <th className="p-2 text-left text-sm font-semibold">Amount</th>
                        <th className="p-2 text-left text-sm font-semibold rounded-tr-md">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => renderRow(item, index))}
                      {items.length === 0 && (
                        <tr className="bg-white text-gray-950">
                          <td className="p-3 font-medium text-center" colSpan={10}>
                            No Items Selected
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <ProductItemsSummaryFooter
                items={items}
                columns={["serial", "label", "colorSize", "quantity", "rate", "discount", "tax", "staff", "amount", "action"]}
                currencySymbol={currencySymbol}
                colClassNames={["w-[4rem]", "w-[27%]", "w-[12%]", "w-[9%]", "w-[9%]", "w-[9%]", "w-[9%]", "w-[7%]", "w-[12%]", "w-[6rem]"]}
              />

              {!itemsFooter && (
                (showAddRow || showScanBarcode) && (
                  <div className="p-4 flex items-center gap-4">
                    {showAddRow && onAddRow && (
                      <button type="button" onClick={onAddRow} className="flex items-center text-sm text-primary font-semibold">
                        <PlusCircle className="h-4 w-4 mr-1" />
                        Add New Row
                      </button>
                    )}
                    {showScanBarcode && onScanBarcode && (
                      <button type="button" onClick={onScanBarcode} className="flex items-center text-sm text-primary font-semibold">
                        <ScanBarcode className="h-4 w-4 mr-1" />
                        Scan Barcode
                      </button>
                    )}
                  </div>
                )
              )}

              {scanner?.isOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50">
                  <div className="bg-white p-5 rounded shadow-md space-y-3 w-80">
                    <h2 className="text-lg font-semibold text-gray-800">Scan Barcode</h2>
                    <input
                      type="text"
                      value={scanner.value}
                      autoFocus
                      onChange={(e) => scanner.onChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") scanner.onConfirm();
                      }}
                      className="border p-2 rounded w-full"
                      placeholder="Enter barcode for testing..."
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={scanner.onClose} className="px-3 py-1 bg-gray-300 text-black rounded">
                        Cancel
                      </button>
                      <button onClick={scanner.onConfirm} className="px-3 py-1 bg-primary text-white rounded">
                        Confirm
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {extraInfo && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-lg font-semibold text-gray-950">{extraInfo.title}</h3>
                  {extraInfo.showToggle && extraInfo.onToggle && (
                    <button
                      type="button"
                      onClick={extraInfo.onToggle}
                      className="text-gray-600 hover:text-primary transition-colors p-1"
                      title={extraInfo.isVisible ? "Hide section" : "Show section"}
                    >
                      {extraInfo.isVisible ? <Eye size={20} /> : <EyeOff size={20} />}
                    </button>
                  )}
                </div>
                {(!extraInfo.showToggle || extraInfo.isVisible) && (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      {extraInfo.tabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => extraInfo.onTabChange(tab.id)}
                          className={`px-4 py-2 text-sm cursor-pointer font-medium rounded-md ${extraInfo.activeTabId === tab.id
                            ? "bg-primary text-white"
                            : "bg-gray-200 text-gray-700"
                            }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    {extraInfo.tabs.find((t) => t.id === extraInfo.activeTabId)?.content}
                  </>
                )}
              </div>
            )}

            <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-3">
              {summaryRows.map((row, idx) => (
                <div key={idx} className="flex justify-between text-sm text-gray-600">
                  <span>{row.label}</span>
                  <span>{row.value}</span>
                </div>
              ))}
              {summaryFooter}
              {totalInWords && (
                <p className="text-sm text-gray-500 capitalize">{totalInWords}</p>
              )}
            </div>
          </div>

          {footerButtons && (
            <div className={footerContainerClassName}>
              {footerButtons}
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default InvoiceFormLayout;
