import React, { useState, useEffect } from "react";
import JsBarcode from "jsbarcode";
import BarcodePrintDialog from "./BarcodePrintDialog";
import axios from "axios";
import Constants from "@constants/api";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";

const MM_PER_INCH = 25.4;

interface PrintBarcodeItem {
  barcode: string;
  productName?: string;
  brandName?: string;
  variantSize?: string;
  variantColor?: string;
  price?: number;      // MRP
  salePrice?: number;  // Sale price
  defaultQuantity?: number;
}

interface PrintBarcodeProps {
  barcode?: string;
  productName?: string;
  brandName?: string;
  variantSize?: string;
  variantColor?: string;
  price?: number;      // MRP
  salePrice?: number;  // Sale price
  defaultQuantity?: number;
  barcodes?: PrintBarcodeItem[];
  formatOverride?: string;
  onClose?: () => void;
}

interface BarcodeSettings {
  widthMm: number;       // barcode bar-module width in mm
  heightMm: number;      // barcode bar height in mm
  labelWidthMm: number;  // physical sticker width in mm
  labelHeightMm: number; // physical sticker height in mm
  safeMarginMm?: number; // safe printable margin in mm
  format: string;
  showBarcodeNumber: boolean;
  showPrice: boolean;      // MRP
  showSalePrice: boolean;  // Sale price
  showBrand: boolean;
  showVariantSize: boolean;
  showProductName: boolean;
  fontProductMm?: number;
  fontBrandMm?: number;
  fontSizeMm?: number;
  fontBarcodeMm?: number;
  fontPriceMm?: number;
  fontSalePriceMm?: number;
  weightProduct?: number;
  weightBrand?: number;
  weightSize?: number;
  weightBarcode?: number;
  weightPrice?: number;
  weightSalePrice?: number;
}

const DEFAULT_SETTINGS: BarcodeSettings = {
  widthMm: 0.35,
  heightMm: 11,
  labelWidthMm: 48,
  labelHeightMm: 23,
  safeMarginMm: 2,
  format: "CODE128",
  showBarcodeNumber: true,
  showPrice: true,
  showSalePrice: false,
  showBrand: true,
  showVariantSize: false,
  showProductName: true,
  fontProductMm: undefined,
  fontBrandMm: undefined,
  fontSizeMm: undefined,
  fontBarcodeMm: undefined,
  fontPriceMm: undefined,
  fontSalePriceMm: undefined,
  weightProduct: 800,
  weightBrand: 800,
  weightSize: 800,
  weightBarcode: 700,
  weightPrice: 800,
  weightSalePrice: 800,
};

let cachedBarcodeSettings: BarcodeSettings | null = null;
let barcodeSettingsRequest: Promise<BarcodeSettings> | null = null;

const PrintBarcode: React.FC<PrintBarcodeProps> = ({
  barcode,
  productName,
  brandName,
  variantSize,
  variantColor,
  price,
  salePrice,
  defaultQuantity,
  barcodes,
  formatOverride,
  onClose,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(true);
  const { token } = useSelector((state: RootState) => state.auth);
  const [settings, setSettings] = useState<BarcodeSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const normalizeSettings = (raw: any): BarcodeSettings => {
    const widthMm =
      raw?.widthMm ??
      (raw?.width
        ? parseFloat(((raw.width * MM_PER_INCH) / 203).toFixed(2))
        : DEFAULT_SETTINGS.widthMm);
    const heightMm =
      raw?.heightMm ??
      (raw?.height
        ? parseFloat(((raw.height * MM_PER_INCH) / 203).toFixed(2))
        : DEFAULT_SETTINGS.heightMm);
    const labelWidthMm = raw?.labelWidthMm ?? DEFAULT_SETTINGS.labelWidthMm;
    const labelHeightMm = raw?.labelHeightMm ?? DEFAULT_SETTINGS.labelHeightMm;
    const safeMarginMm = raw?.safeMarginMm ?? DEFAULT_SETTINGS.safeMarginMm;

    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      widthMm,
      heightMm,
      labelWidthMm,
      labelHeightMm,
      safeMarginMm,
      weightProduct: raw?.weightProduct ?? DEFAULT_SETTINGS.weightProduct,
      weightBrand: raw?.weightBrand ?? DEFAULT_SETTINGS.weightBrand,
      weightSize: raw?.weightSize ?? DEFAULT_SETTINGS.weightSize,
      weightBarcode: raw?.weightBarcode ?? DEFAULT_SETTINGS.weightBarcode,
      weightPrice: raw?.weightPrice ?? DEFAULT_SETTINGS.weightPrice,
      weightSalePrice: raw?.weightSalePrice ?? DEFAULT_SETTINGS.weightSalePrice,
    };
  };

  const fetchLatestSettings = async (forceRefresh = false): Promise<BarcodeSettings> => {
    if (!token) return cachedBarcodeSettings || settings;
    if (!forceRefresh && cachedBarcodeSettings) {
      return cachedBarcodeSettings;
    }
    if (!forceRefresh && barcodeSettingsRequest) {
      return barcodeSettingsRequest;
    }

    barcodeSettingsRequest = axios
      .get(Constants.GET_BARCODE_SETTINGS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((response) => {
        const nextSettings = response.data?.data
          ? normalizeSettings(response.data.data)
          : cachedBarcodeSettings || settings;
        cachedBarcodeSettings = nextSettings;
        return nextSettings;
      })
      .catch((error) => {
        console.error("Failed to load barcode settings", error);
        return cachedBarcodeSettings || settings;
      })
      .finally(() => {
        barcodeSettingsRequest = null;
      });

    return barcodeSettingsRequest;
  };

  useEffect(() => {
    let active = true;

    const fetchSettings = async () => {
      if (!token) {
        if (active) setSettingsLoaded(true);
        return;
      }

      const nextSettings = await fetchLatestSettings(true);
      if (active) {
        setSettings(nextSettings);
        setSettingsLoaded(true);
      }
    };

    fetchSettings();
    return () => {
      active = false;
    };
  }, [token]);

  /**
   * Render barcode as SVG markup (vector) to avoid raster blur.
   * The SVG is then sized in mm inside the print HTML so the printer
   * gets crisp edges even if the driver scales.
   */
  const generateBarcodeSvgMarkup = (value: string, cfg: BarcodeSettings): string => {
    try {
      const PRINTER_DPI = 203;
      // Bar module width in pixels at printer DPI
      const barWidthPx = Math.max(2, Math.round((cfg.widthMm / 25.4) * PRINTER_DPI));
      const barHeightPx = Math.round((cfg.heightMm / 25.4) * PRINTER_DPI);
      const marginPx = 0;

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("shape-rendering", "crispEdges");

      JsBarcode(svg, value, {
        format: cfg.format,
        displayValue: false,
        width: barWidthPx,
        height: barHeightPx,
        margin: marginPx,
        background: "#ffffff",
        lineColor: "#000000",
      });

      return svg.outerHTML;
    } catch (err) {
      console.error("Barcode SVG generation failed", err);
      return "";
    }
  };

  const handlePrint = (quantity: number | number[], cfg: BarcodeSettings = settings) => {
    const items: PrintBarcodeItem[] = barcodes?.length
      ? barcodes
      : barcode
        ? [{ barcode, productName, brandName, variantSize, variantColor, price, salePrice, defaultQuantity }]
        : [];

    if (!items.length) {
      alert("Please generate a barcode first!");
      onClose?.();
      return;
    }

    const lw = cfg.labelWidthMm;   // e.g. 48
    const lh = cfg.labelHeightMm;  // e.g. 23
    // Small horizontal bump to prevent MRP/Sale overlap at larger font sizes
    const printWidthBumpMm = 8;
    const lwPrint = lw + printWidthBumpMm;
    const pad = cfg.safeMarginMm ?? 2; // mm padding inside each label on each side
    // Extra vertical safety to prevent text-shadow clipping on thermal prints
    const shadowPadMm = 0.6;
    const padTop = pad + shadowPadMm;
    const padBottom = pad + shadowPadMm;
    const fontSizeMm = cfg.fontSizeMm ?? Math.min(2.3, lh * 0.1);
    const weightSize = cfg.weightSize ?? 800;
    const getVariantSizeText = (value?: string) => String(value || "").trim();
    const getVariantBrandText = (value?: string) => String(value || "").trim();
    const getVerticalVariantText = (item: PrintBarcodeItem) => {
      const sizeText = cfg.showVariantSize ? getVariantSizeText(item.variantSize) : "";
      const brandText = cfg.showBrand ? getVariantBrandText(item.brandName) : "";
      return Boolean(sizeText || brandText);
    };
    const hasAnySideLabel = items.some((item) => Boolean(getVerticalVariantText(item)));
    const sizeGutterMm = hasAnySideLabel ? Math.max(fontSizeMm * 1.9, 6) : 0;
    const barcodeAreaWidth = lwPrint - pad * 2 - sizeGutterMm;

    // Font sizes — allow admin override, fallback to label-based defaults
    const fontProductMm = cfg.fontProductMm ?? Math.min(2.8, lh * 0.12);
    const fontBrandMm = cfg.fontBrandMm ?? Math.min(2.3, lh * 0.1);
    const fontBarcodeMm = cfg.fontBarcodeMm ?? Math.min(1.3, lh * 0.055); // barcode number — intentionally smallest
    const fontPriceMm = cfg.fontPriceMm ?? Math.min(2.4, lh * 0.11);   // MRP
    const fontSalePriceMm = cfg.fontSalePriceMm ?? fontPriceMm;        // Sale
    const weightProduct = cfg.weightProduct ?? 800;
    const weightBrand = cfg.weightBrand ?? 800;
    const weightBarcode = cfg.weightBarcode ?? 700;
    const weightPrice = cfg.weightPrice ?? 800;
    const weightSalePrice = cfg.weightSalePrice ?? 800;
    const shouldShowPriceDecimals = (fontMm: number) => fontMm <= 4;
    const formatPrice = (value: number, fontMm: number) =>
      shouldShowPriceDecimals(fontMm)
        ? Number(value).toFixed(2)
        : Number(value).toFixed(0);

    // Auto-fit barcode height to keep Design/Brand from cutting
    const lineIdentityMm = ((cfg.showBrand || cfg.showProductName) ? Math.max(fontBrandMm, fontProductMm) * 1.3 + 0.6 : 0);
    const lineBarcodeMm = (cfg.showBarcodeNumber ? (fontBarcodeMm * 1.1) + 0.1 : 0);
    const lineMrpMm = (cfg.showPrice ? (fontPriceMm * 1.1) + 0.2 : 0);
    const lineSaleMm = (cfg.showSalePrice ? (fontSalePriceMm * 1.1) + 0.2 : 0);
    const textTotalMm = lineIdentityMm + lineBarcodeMm + lineMrpMm + lineSaleMm;
    const availableBarcodeMm = Math.max(1, (lh - padTop - padBottom) - textTotalMm);
    const barcodeMaxHeightMm = Math.min(cfg.heightMm, availableBarcodeMm);

    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page {
      /* Tell the browser/driver each page = one sticker */
      size: ${lwPrint}mm ${lh}mm;
      margin: 0;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      font-family: system-ui, Avenir, Helvetica, Arial, sans-serif;
    }
    .label {
      width: ${lwPrint}mm;
      height: ${lh}mm;
      overflow: hidden;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: flex-start;
      padding: ${padTop}mm ${pad}mm ${padBottom}mm ${pad}mm;
      gap: 0.5mm;
      background: #fff;
      position: relative;
    }
    .bold-text {
      text-shadow:
        0.05mm 0 0 #000,
        -0.05mm 0 0 #000,
        0 0.05mm 0 #000,
        0 -0.05mm 0 #000;
    }
    .identity-row {
      width: 100%;
      font-size: ${Math.max(fontProductMm, fontBrandMm)}mm;
      line-height: 1.25;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin: 0;
      padding-bottom: 0.35mm;
      text-align: left;
    }
    .identity-brand {
      text-transform: uppercase;
      font-weight: ${weightBrand};
      letter-spacing: 0.08em;
      color: #000000;
    }
    .identity-product {
      font-weight: ${weightProduct};
      color: #000000;
    }
    .barcode-wrap {
      width: ${barcodeAreaWidth}mm;
      flex-shrink: 0;
      line-height: 0;
      display: flex;
      justify-content: flex-start;
    }
    /* Barcode SVG:
       - vector scaling = crisp edges
       - width: 100% fills label area, height capped */
    .barcode-wrap svg {
      max-width: ${barcodeAreaWidth}mm;
      max-height: ${barcodeMaxHeightMm}mm;
      width: auto;
      height: auto;
      display: block;
      margin: 0;
      shape-rendering: crispEdges;
    }
    .price-line {
      width: 100%;
      margin: 0;
      line-height: 1.1;
      white-space: nowrap;
      text-align: left;
    }
    .price-mrp {
      font-size: ${fontPriceMm}mm;
      font-weight: ${weightPrice};
    }
    .price-sale {
      font-size: ${fontSalePriceMm}mm;
      font-weight: ${weightSalePrice};
    }
    /* Barcode number — smaller than other label text, monospace for readability */
    .barcode-number {
      font-size: ${fontBarcodeMm}mm;
      font-weight: ${weightBarcode};
      line-height: 1;
      margin: 0;
      color: #374151;
    }
    .size-vertical {
      position: absolute;
      top: ${padTop}mm;
      right: ${pad}mm;
      bottom: ${padBottom}mm;
      width: ${sizeGutterMm}mm;
      display: flex;
      align-items: center;
      justify-content: center;
      writing-mode: vertical-rl;
      text-orientation: mixed;
      line-height: 1;
      white-space: nowrap;
      overflow: hidden;
      color: #000000;
      gap: 0.6mm;
    }
    .size-vertical-stack {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.8mm;
    }
    .size-vertical-size {
      font-size: ${fontSizeMm}mm;
      font-weight: ${weightSize};
    }
    .size-vertical-brand {
      font-size: ${fontBrandMm}mm;
      font-weight: ${weightBrand};
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
  </style>
</head>
<body>`;

    for (const [index, item] of items.entries()) {
      const svgMarkup = generateBarcodeSvgMarkup(item.barcode, cfg);
      if (!svgMarkup) continue;
      const itemQty = Array.isArray(quantity) ? (quantity[index] ?? 0) : quantity;
      if (!Number.isFinite(itemQty) || itemQty <= 0) continue;

      const labelHtml = `
  <div class="label">
    ${getVerticalVariantText(item)
          ? `<div class="size-vertical bold-text"><div class="size-vertical-stack">${cfg.showVariantSize && getVariantSizeText(item.variantSize) ? `<span class="size-vertical-size">${getVariantSizeText(item.variantSize)}</span>` : ""}${cfg.showBrand && getVariantBrandText(item.brandName) ? `<span class="size-vertical-brand">${getVariantBrandText(item.brandName)}</span>` : ""}</div></div>`
          : ""}
    ${cfg.showSalePrice && item.salePrice != null
          ? `<p class="price-line price-sale bold-text">SALE PRICE : ${formatPrice(item.salePrice, fontSalePriceMm)}</p>`
          : ""}
    <div class="barcode-wrap">${svgMarkup}</div>
    ${cfg.showBarcodeNumber
          ? `<p class="barcode-number bold-text">${item.barcode}</p>`
          : ""}
    ${cfg.showProductName
          ? `<p class="identity-row bold-text">
               ${cfg.showProductName && item.productName ? `<span class="identity-product">${item.productName}</span>` : ""}
               ${cfg.showProductName && item.variantColor ? `<span class="identity-product"> ${item.variantColor}</span>` : ""}
             </p>`
          : ""}
    ${cfg.showPrice && item.price != null
          ? `<p class="price-line price-mrp bold-text">MRP : ${formatPrice(item.price, fontPriceMm)}</p>`
          : ""}
  </div>`;

      for (let i = 0; i < itemQty; i++) {
        html += labelHtml;
      }
    }

    html += `
</body>
<script>
  window.onload = function() { window.print(); };
  window.onafterprint = function() { window.close(); };
</script>
</html>`;

    const frame = document.createElement("iframe");
    frame.style.cssText = "position:absolute;width:0;height:0;border:none;";
    document.body.appendChild(frame);

    const frameDoc = frame.contentDocument || frame.contentWindow?.document;
    frameDoc!.open();
    frameDoc!.write(html);
    frameDoc!.close();

    setTimeout(() => {
      frame.remove();
      onClose?.();
    }, 1500);
  };

  const handleConfirm = async (qty: number | number[]) => {
    setIsDialogOpen(false);
    const latest = token ? await fetchLatestSettings(true) : settings;
    const nextSettings = formatOverride ? { ...latest, format: formatOverride } : latest;
    setSettings(nextSettings);
    setSettingsLoaded(true);
    setTimeout(() => handlePrint(qty, nextSettings), 100);
  };

  const dialogItems: {
    designNumber?: string;
    brandName?: string;
    variantSize?: string;
    variantColor?: string;
    mrp?: number;
    salePrice?: number;
    barcode?: string;
    defaultQuantity?: number;
  }[] = barcodes?.length
      ? barcodes.map((item) => ({
        designNumber: item.productName,
        brandName: item.brandName,
        variantSize: item.variantSize,
        variantColor: item.variantColor,
        mrp: item.price,
        salePrice: item.salePrice,
        barcode: item.barcode,
        defaultQuantity: item.defaultQuantity,
      }))
      : barcode
        ? [{
          designNumber: productName,
          brandName,
          variantSize,
          variantColor,
          mrp: price,
          salePrice,
          barcode,
          defaultQuantity,
        }]
        : [];

  return (
    <>
      <BarcodePrintDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          onClose?.();
        }}
        onConfirm={handleConfirm}
        items={dialogItems}
      />
    </>
  );
};

export default PrintBarcode;
