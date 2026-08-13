export interface EmailSettingsFormData {
    provider_type: string;
    userId: string;
    fromName: string;
    fromEmail: string;
    host: string;
    port: number | string;
    username: string;
    password: string;
    smtp_status: boolean | string;
    node_status: boolean | string;
}
