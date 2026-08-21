const TodoTask = require("@models/TodoTask");
const User = require("@models/User");

const startOfDay = (input = new Date()) => {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (input = new Date()) => {
  const date = new Date(input);
  date.setHours(23, 59, 59, 999);
  return date;
};

const resolveAuthUserId = (req) => {
  if (typeof req.user === "string") return req.user;
  return req.user?.userId || req.user?._id || req.user?.id || null;
};

const resolveAuthUser = async (req) => {
  const userId = resolveAuthUserId(req);
  if (!userId) return null;
  return User.findById(userId).select("_id firstName lastName email user_type");
};

const isAdminUser = (user) => Number(user?.user_type || 0) === 1;

const getTaskTimingStatus = (task) => {
  if (task.status === "completed") return "completed";

  const todayStart = startOfDay();
  const dueDate = task.dueDate ? startOfDay(task.dueDate) : null;
  const createDate = task.createDate ? startOfDay(task.createDate) : todayStart;

  if (dueDate && dueDate < todayStart) return "overdue";
  if (dueDate && dueDate.getTime() === todayStart.getTime()) return "due_today";
  if (createDate.getTime() === todayStart.getTime()) return "created_today";
  return "upcoming";
};

const getTaskPriority = (timingStatus) => {
  if (timingStatus === "overdue") return "high";
  if (timingStatus === "due_today" || timingStatus === "created_today") return "medium";
  return "low";
};

const serializeTask = (task) => {
  const timingStatus = getTaskTimingStatus(task);
  return {
    _id: task._id,
    title: task.title,
    description: task.description || "",
    createDate: task.createDate,
    dueDate: task.dueDate,
    status: task.status,
    completedAt: task.completedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    notificationStatus: timingStatus,
    priority: getTaskPriority(timingStatus),
    owner: task.userId && typeof task.userId === "object"
      ? {
          _id: task.userId._id,
          firstName: task.userId.firstName || "",
          lastName: task.userId.lastName || "",
          email: task.userId.email || "",
          user_type: task.userId.user_type,
        }
      : undefined,
  };
};

const buildSummary = (tasks = []) => {
  return tasks.reduce(
    (acc, task) => {
      const timingStatus = getTaskTimingStatus(task);
      if (task.status === "pending") acc.activeCount += 1;
      if (timingStatus === "overdue") acc.overdueCount += 1;
      if (timingStatus === "due_today") acc.dueTodayCount += 1;
      if (timingStatus === "created_today") acc.createdTodayCount += 1;
      return acc;
    },
    {
      activeCount: 0,
      overdueCount: 0,
      dueTodayCount: 0,
      createdTodayCount: 0,
      attentionCount: 0,
    }
  );
};

const listTodoTasks = async (req, res) => {
  try {
    const authUser = await resolveAuthUser(req);
    const userId = authUser?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const status = String(req.query.status || "all").toLowerCase();

    const filters = { isDeleted: { $ne: true } };
    if (!isAdminUser(authUser)) {
      filters.userId = userId;
    }
    if (status === "pending" || status === "completed") {
      filters.status = status;
    }

    const tasks = await TodoTask.find(filters)
      .populate("userId", "firstName lastName email user_type")
      .sort({ status: 1, dueDate: 1, createDate: -1, createdAt: -1 });
    const serializedTasks = tasks.map(serializeTask);
    const summary = buildSummary(tasks);
    summary.attentionCount = summary.overdueCount + summary.dueTodayCount;

    return res.status(200).json({
      success: true,
      message: "To-do tasks fetched successfully",
      data: {
        tasks: serializedTasks,
        summary,
      },
    });
  } catch (error) {
    console.error("List to-do tasks error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch to-do tasks",
    });
  }
};

const getTodoTaskSummary = async (req, res) => {
  try {
    const authUser = await resolveAuthUser(req);
    const userId = authUser?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const filters = { status: "pending", isDeleted: { $ne: true } };
    if (!isAdminUser(authUser)) {
      filters.userId = userId;
    }
    const tasks = await TodoTask.find(filters).select("status dueDate createDate");
    const summary = buildSummary(tasks);
    summary.attentionCount = summary.overdueCount + summary.dueTodayCount;

    return res.status(200).json({
      success: true,
      message: "To-do summary fetched successfully",
      data: summary,
    });
  } catch (error) {
    console.error("To-do summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch to-do summary",
    });
  }
};

const createTodoTask = async (req, res) => {
  try {
    const userId = resolveAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { title, description = "", createDate, dueDate } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: "Task title is required" });
    }

    if (!createDate || !dueDate) {
      return res.status(400).json({ success: false, message: "Create date and due date are required" });
    }

    const parsedCreateDate = startOfDay(createDate);
    const parsedDueDate = endOfDay(dueDate);

    if (Number.isNaN(parsedCreateDate.getTime()) || Number.isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid task dates" });
    }

    if (parsedDueDate < parsedCreateDate) {
      return res.status(400).json({ success: false, message: "Due date cannot be before create date" });
    }

    const task = await TodoTask.create({
      userId,
      title: String(title).trim(),
      description: String(description || "").trim(),
      createDate: parsedCreateDate,
      dueDate: parsedDueDate,
    });

    return res.status(201).json({
      success: true,
      message: "To-do task created successfully",
      data: serializeTask(task),
    });
  } catch (error) {
    console.error("Create to-do task error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create to-do task",
    });
  }
};

const updateTodoTask = async (req, res) => {
  try {
    const authUser = await resolveAuthUser(req);
    const userId = authUser?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { id } = req.params;
    const { title, description = "", createDate, dueDate } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: "Task title is required" });
    }

    if (!createDate || !dueDate) {
      return res.status(400).json({ success: false, message: "Create date and due date are required" });
    }

    const parsedCreateDate = startOfDay(createDate);
    const parsedDueDate = endOfDay(dueDate);

    if (Number.isNaN(parsedCreateDate.getTime()) || Number.isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid task dates" });
    }

    if (parsedDueDate < parsedCreateDate) {
      return res.status(400).json({ success: false, message: "Due date cannot be before create date" });
    }

    const taskFilters = { _id: id, isDeleted: { $ne: true } };
    if (!isAdminUser(authUser)) {
      taskFilters.userId = userId;
    }

    const task = await TodoTask.findOne(taskFilters);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "To-do task not found",
      });
    }

    task.title = String(title).trim();
    task.description = String(description || "").trim();
    task.createDate = parsedCreateDate;
    task.dueDate = parsedDueDate;

    if (task.status === "completed") {
      task.status = "pending";
      task.completedAt = null;
    }

    await task.save();

    return res.status(200).json({
      success: true,
      message: "To-do task updated successfully",
      data: serializeTask(task),
    });
  } catch (error) {
    console.error("Update to-do task error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update to-do task",
    });
  }
};

const markTodoTaskCompleted = async (req, res) => {
  try {
    const authUser = await resolveAuthUser(req);
    const userId = authUser?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { id } = req.params;

    const taskFilters = { _id: id, isDeleted: { $ne: true } };
    if (!isAdminUser(authUser)) {
      taskFilters.userId = userId;
    }

    const task = await TodoTask.findOne(taskFilters);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "To-do task not found",
      });
    }

    task.status = "completed";
    task.completedAt = new Date();
    await task.save();

    return res.status(200).json({
      success: true,
      message: "To-do task marked as completed",
      data: serializeTask(task),
    });
  } catch (error) {
    console.error("Mark to-do task completed error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update to-do task",
    });
  }
};

const deleteTodoTask = async (req, res) => {
  try {
    const authUser = await resolveAuthUser(req);
    const userId = authUser?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { id } = req.params;

    const taskFilters = { _id: id, isDeleted: { $ne: true } };
    if (!isAdminUser(authUser)) {
      taskFilters.userId = userId;
    }

    const task = await TodoTask.findOneAndUpdate(
      taskFilters,
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true },
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "To-do task not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "To-do task deleted successfully",
    });
  } catch (error) {
    console.error("Delete to-do task error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete to-do task",
    });
  }
};

module.exports = {
  listTodoTasks,
  getTodoTaskSummary,
  createTodoTask,
  updateTodoTask,
  markTodoTaskCompleted,
  deleteTodoTask,
};
