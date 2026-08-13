export interface EmailTemplateFormData {
    title: string;
    notification_type: string;
    description: string;
    subject: string;
    sms_content: string;
    notification_content: string;
    status: string;
}

export interface NotificationTypes {
    _id: string;
    title: string;
    slug: string;
    tags: NotificationTags[];
    status: string;
    createdAt: string;
}

export interface NotificationTags {
    _id: string;
    title: string;
    status: string;
}

export interface TemplateListResponse {
    success: boolean;
    message: string;
    data: {
        templates: EmailTemplate[];
        pagination: EmailTemplatePagination;
    }
}

export interface EmailTemplatePagination {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export interface EmailTemplate {
    _id: string;
    title: string;
    notification_type: {
        _id: string;
        title: string;
        slug: string;
    },
    description: string;
    subject: string;
    sms_content: string;
    notification_content: string;
    status: string;
    createdAt: string;
}
