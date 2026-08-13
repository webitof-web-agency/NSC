export interface AppNotificationMeta {
  invoiceNumber?: string;
  quotationId?: string;
  purchaseId?: string;
  customerName?: string;
  customerPhone?: string;
  supplierName?: string;
  supplierBillNumber?: string;
  balanceAmount?: number;
  pendingDays?: number;
  dueDate?: string | null;
  invoiceDate?: string | null;
  expiryDate?: string | null;
  statusLabel?: string;
}

export interface AppNotification {
  _id: string;
  type: string;
  entityType?: string;
  title: string;
  message: string;
  priority: "low" | "medium" | "high";
  actionUrl: string;
  isRead: boolean;
  notificationDate: string;
  createdAt: string;
  updatedAt: string;
  meta?: AppNotificationMeta;
}

export interface NotificationListResponse {
  success: boolean;
  message: string;
  data: {
    notifications: AppNotification[];
    unreadCount: number;
  };
}
