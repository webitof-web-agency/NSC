export type TodoTaskNotificationStatus =
  | "overdue"
  | "due_today"
  | "created_today"
  | "upcoming"
  | "completed";

export interface TodoTask {
  _id: string;
  title: string;
  description: string;
  createDate: string;
  dueDate: string;
  status: "pending" | "completed";
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  notificationStatus: TodoTaskNotificationStatus;
  priority: "low" | "medium" | "high";
}

export interface TodoTaskSummary {
  activeCount: number;
  overdueCount: number;
  dueTodayCount: number;
  createdTodayCount: number;
  attentionCount: number;
}

export interface TodoTaskListResponse {
  success: boolean;
  message: string;
  data: {
    tasks: TodoTask[];
    summary: TodoTaskSummary;
  };
}
