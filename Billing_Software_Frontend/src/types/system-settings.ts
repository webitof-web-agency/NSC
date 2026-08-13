import type { PermissionSet } from "./permissions";

export interface Company {
    _id: string;
    userId: string;
    companyName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    siteLogo: string;
    companyLogo: string;
    favicon: string;
    softwareDownloadUrl?: string;
    gstMode?: 'Inclusive' | 'Exclusive';
}

export interface Currency {
    _id: string;
    code: string;
    symbol: string;
    name: string;
    status: boolean;
    isDefault: boolean;
}

export interface DateFormat {
    _id: string;
    title: string;
    format: string;
    isActive: boolean;
}

export interface TimeFormat {
    _id: string;
    name: string;
    format: string;
    isActive: boolean;
}

export interface TimeZone {
    _id: string;
    name: string;
    utc_offset: string;
}

export interface InvoiceTemplate {
    _id: string;
    userId: string;
    default_invoice_template: string;
}
export interface SystemSettings {
    company: Company;
    currency: Currency;
    dateFormat: DateFormat;
    timeFormat: TimeFormat;
    timezone: TimeZone;
    permissions: PermissionSet[];
    invoiceTemplate: InvoiceTemplate;
    invoicePrefix: string;
    invoiceNumberType: 'auto' | 'manual';
    gstMode?: 'Inclusive' | 'Exclusive';

    data: {                      // Added this for the AdminHeader action labels permissions
        permissions: any[];
        // other properties
    };
}
