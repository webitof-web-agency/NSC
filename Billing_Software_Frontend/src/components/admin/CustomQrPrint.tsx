import React, { useMemo, useState } from "react";
import QRCode from "qrcode";
import BarcodePrintDialog from "./BarcodePrintDialog";
import axios from "axios";
import Constants from "@constants/api";
import { useSelector } from "react-redux";
import type { RootState } from "@store/index";

interface CustomQrPrintProps {
  productName?: string;
  brandName?: string;
  variantSize?: string;
  variantColor?: string;
  onClose?: () => void;
}

const MM_PER_INCH = 25.4;
const DEFAULT_LABEL_WIDTH_MM = 200;
const DEFAULT_LABEL_HEIGHT_MM = 80;
const DEFAULT_SAFE_MARGIN_MM = 4;
const DEFAULT_QR_SIZE_MM = 42;

const normalizeText = (value?: string) => String(value || "").trim();

const CustomQrPrint: React.FC<CustomQrPrintProps> = ({
  productName,
  brandName,
  variantSize,
  variantColor,
  onClose,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(true);
  const { token } = useSelector((state: RootState) => state.auth);
  const [settings, setSettings] = useState<any>(null);

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get(Constants.GET_QR_SETTINGS_URL, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data?.data) {
          setSettings(res.data.data);
        }
      } catch (err) {
        console.error("Failed to load QR settings", err);
      }
    };
    fetchSettings();
  }, [token]);

  const details = useMemo(
    () => ({
      productName: normalizeText(productName),
      brandName: normalizeText(brandName),
      variantSize: normalizeText(variantSize),
      variantColor: normalizeText(variantColor),
    }),
    [productName, brandName, variantSize, variantColor]
  );

  const sizesArray = useMemo(() => {
    const rawSize = details.variantSize;
    if (!rawSize) return [""];
    const splitSizes = rawSize.split(",").map((s) => s.trim()).filter(Boolean);
    return splitSizes.length > 0 ? splitSizes : [""];
  }, [details.variantSize]);

  const itemsToPrint = useMemo(() => {
    return sizesArray.map((size) => {
      const pLines: string[] = [];
      if (details.productName) pLines.push(details.productName);
      if (details.brandName) pLines.push(`Brand: ${details.brandName}`);
      if (size) pLines.push(`Size: ${size}`);
      if (details.variantColor) pLines.push(`Color: ${details.variantColor}`);
      if (!pLines.length) pLines.push("Custom Item");

      return {
        designNumber: details.productName || "-",
        brandName: details.brandName || "-",
        variantSize: size || "-",
        variantColor: details.variantColor || "-",
        codeLabel: "QR Content",
        barcode: pLines.join(" | "),
        defaultQuantity: 1,
      };
    });
  }, [details, sizesArray]);

  const handlePrint = async (quantity: number | number[]) => {
    const qtyArray = Array.isArray(quantity) ? quantity : [Number(quantity || 0)];

    try {
      // qrDataUrl is generated per size inside the loop

      const labelWidthMm = settings?.labelWidthMm ?? DEFAULT_LABEL_WIDTH_MM;
      const labelHeightMm = settings?.labelHeightMm ?? DEFAULT_LABEL_HEIGHT_MM;
      const safeMarginMm = settings?.safeMarginMm ?? DEFAULT_SAFE_MARGIN_MM;
      const qrSizeMm = settings?.qrSizeMm ?? DEFAULT_QR_SIZE_MM;

      const fontProductMm = settings?.fontProductMm ?? Math.min(13, labelHeightMm * 0.16);
      const fontBrandMm = settings?.fontBrandMm ?? Math.min(9.2, labelHeightMm * 0.11);
      const fontSizeMm = settings?.fontSizeMm ?? Math.min(9.2, labelHeightMm * 0.11);
      const fontColorMm = settings?.fontColorMm ?? Math.min(9.2, labelHeightMm * 0.11);

      const showProductName = settings?.showProductName ?? true;
      const showBrand = settings?.showBrand ?? true;
      const showVariantSize = settings?.showVariantSize ?? true;
      const showVariantColor = settings?.showVariantColor ?? true;

      let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page {
      size: ${labelWidthMm}mm ${labelHeightMm}mm;
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
      background: #ffffff;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .label {
      width: ${labelWidthMm}mm;
      height: ${labelHeightMm}mm;
      padding: ${safeMarginMm}mm;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      gap: 4mm;
      page-break-after: always;
      overflow: hidden;
      background: #ffffff;
    }
    .qr-wrap {
      width: ${qrSizeMm}mm;
      height: ${qrSizeMm}mm;
      min-width: ${qrSizeMm}mm;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .qr-wrap img {
      width: ${qrSizeMm}mm;
      height: ${qrSizeMm}mm;
      display: block;
    }
    .content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      gap: 1.6mm;
      text-align: left;
    }
    .title {
      margin: 0;
      width: 100%;
      font-size: ${fontProductMm}mm;
      line-height: 1.05;
      font-weight: ${settings?.weightProduct ?? 700};
      color: #111827;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta-brand {
      margin: 0;
      width: 100%;
      font-size: ${fontBrandMm}mm;
      line-height: 1.12;
      font-weight: ${settings?.weightBrand ?? 700};
      color: #374151;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta-size {
      margin: 0;
      width: 100%;
      font-size: ${fontSizeMm}mm;
      line-height: 1.12;
      font-weight: ${settings?.weightSize ?? 700};
      color: #374151;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta-color {
      margin: 0;
      width: 100%;
      font-size: ${fontColorMm}mm;
      line-height: 1.12;
      font-weight: ${settings?.weightColor ?? 700};
      color: #374151;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  </style>
</head>
<body>`;

      const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      for (let i = 0; i < sizesArray.length; i++) {
        const size = sizesArray[i];
        const qty = Number(qtyArray[i] || qtyArray[0] || 0);

        if (!Number.isFinite(qty) || qty <= 0) continue;

        const payload = {
          itemName: details.productName || null,
          brand: details.brandName || null,
          size: size || null,
          color: details.variantColor || null,
        };
        const qrPayloadStr = JSON.stringify(payload, null, 0);

        const qrDataUrl = await QRCode.toDataURL(qrPayloadStr, {
          errorCorrectionLevel: "M",
          margin: 0,
          width: 512,
        });

        let contentHtml = "";

        if (showProductName && details.productName) {
          contentHtml += `<p class="title">${escapeHtml(details.productName)}</p>`;
        }
        if (showBrand && details.brandName) {
          contentHtml += `<p class="meta-brand">${escapeHtml(details.brandName)}</p>`;
        }
        if (showVariantSize && size) {
          contentHtml += `<p class="meta-size">Size: ${escapeHtml(size)}</p>`;
        }
        if (showVariantColor && details.variantColor) {
          contentHtml += `<p class="meta-color">Color: ${escapeHtml(details.variantColor)}</p>`;
        }

        const labelHtml = `
  <div class="label">
    <div class="qr-wrap"><img src="${qrDataUrl}" alt="QR Code" /></div>
    <div class="content">${contentHtml}</div>
  </div>`;

        for (let j = 0; j < qty; j += 1) {
          html += labelHtml;
        }
      }

      html += `
</body>
<script>
  window.onload = function () { window.print(); };
  window.onafterprint = function () { window.close(); };
</script>
</html>`;

      const frame = document.createElement("iframe");
      frame.style.cssText = "position:absolute;width:0;height:0;border:none;";
      document.body.appendChild(frame);

      const frameDoc = frame.contentDocument || frame.contentWindow?.document;
      frameDoc?.open();
      frameDoc?.write(html);
      frameDoc?.close();

      setTimeout(() => {
        frame.remove();
        onClose?.();
      }, 1500);
    } catch (error) {
      console.error("Failed to generate QR print", error);
      alert("Failed to prepare QR print");
    }
  };

  return (
    <BarcodePrintDialog
      isOpen={isDialogOpen}
      onClose={() => {
        setIsDialogOpen(false);
        onClose?.();
      }}
      onConfirm={handlePrint}
      title="Print QR Label"
      singleQuantityLabel="Quantity"
      singleQuantityPlaceholder="Enter print quantity"
      items={itemsToPrint}
    />
  );
};

export default CustomQrPrint;
