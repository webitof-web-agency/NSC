import Constants from "@constants/api";

export const resolveAssetUrl = (url?: string | null): string | null => {
    if (!url) return null;
    if (
        url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("data:") ||
        url.startsWith("blob:")
    ) {
        return url;
    }
    const base = Constants.BASE_URL || "";
    if (!base) return url;
    if (url.startsWith("/")) return `${base}${url}`;
    return `${base}/${url}`;
};
