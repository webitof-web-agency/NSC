export interface PublicPhoneLink {
  display: string;
  dial: string;
}

const toTrimmedString = (value: unknown) => String(value || "").trim();

export const getCustomerInitials = (value: unknown): string => {
  const nameParts = toTrimmedString(value).split(/\s+/).filter(Boolean);
  if (!nameParts.length) return "C";

  return nameParts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

export const getFooterAddressLines = (value: unknown): string[] => {
  const address = toTrimmedString(value);
  if (!address) return [];

  if (!/^\d+\.\s+/.test(address)) return [address];

  return address
    .split(/\s+(?=\d+\.\s+)/)
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
};

export const getUniquePhoneNumbers = (values: unknown[]): PublicPhoneLink[] => {
  const seenNumbers = new Set<string>();

  return values.reduce<PublicPhoneLink[]>((phoneNumbers, value) => {
    const display = toTrimmedString(value);
    const digits = display.replace(/\D/g, "");

    if (digits.length < 7 || seenNumbers.has(digits)) return phoneNumbers;

    seenNumbers.add(digits);
    phoneNumbers.push({
      display,
      dial: display.replace(/[^\d+]/g, ""),
    });
    return phoneNumbers;
  }, []);
};

export const getValidEmail = (value: unknown): string => {
  const email = toTrimmedString(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
};

export const getSafeHttpUrl = (value: unknown): string => {
  const candidate = toTrimmedString(value);
  if (!candidate) return "";

  try {
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
};

export const getWhatsAppNumber = (value: unknown): string => {
  const digits = toTrimmedString(value).replace(/\D/g, "");
  return digits.length >= 7 ? digits : "";
};
