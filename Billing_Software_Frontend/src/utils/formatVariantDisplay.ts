type BrandLike =
    | string
    | {
        brand_name?: string;
        name?: string;
    }
    | null
    | undefined;

export const getBrandName = (brand: BrandLike): string => {
    if (!brand) return "";
    if (typeof brand === "string") return brand.trim();
    return String(brand.brand_name || brand.name || "").trim();
};

export const formatVariantDisplay = ({
    brandName,
    designNo,
    size,
    includeSize = false,
}: {
    brandName?: string | null;
    designNo?: string | null;
    size?: string | null;
    includeSize?: boolean;
}) => {
    const normalizedSize = String(size || "").trim();
    const normalizedDesignNo = String(designNo || "").trim();
    const designWithoutDuplicateSize = includeSize && normalizedSize
        ? normalizedDesignNo.replace(/\s*\(([^)]*)\)\s*$/, (match, value) =>
            String(value || "").trim().toLowerCase() === normalizedSize.toLowerCase() ? "" : match
        )
        : normalizedDesignNo;

    const title = [brandName, designWithoutDuplicateSize]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join(" - ");

    if (!includeSize || !normalizedSize) return title;
    return title ? `${title}, ${normalizedSize}` : normalizedSize;
};
