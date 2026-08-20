const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const test = require("node:test");

require("module-alias/register");

const {
  CREDIT_NOTIFICATION_TYPE,
  buildNotificationScopeQuery,
} = require("../controllers/notificationController");

const notificationControllerSource = readFileSync(
  require.resolve("../controllers/notificationController"),
  "utf8"
);

test("staff notification scope limits invoice notifications to staff-created invoices", () => {
  const query = buildNotificationScopeQuery({
    userId: "staff-1",
    isStaff: true,
    staffInvoiceIds: ["invoice-own-1", "invoice-own-2"],
  });

  assert.equal(query.userId, "staff-1");
  assert.deepEqual(query.$or, [
    { type: { $ne: CREDIT_NOTIFICATION_TYPE } },
    {
      type: CREDIT_NOTIFICATION_TYPE,
      entityId: { $in: ["invoice-own-1", "invoice-own-2"] },
    },
  ]);
});

test("admin notification scope remains unrestricted by invoice creator", () => {
  const query = buildNotificationScopeQuery({
    userId: "admin-1",
    isStaff: false,
    staffInvoiceIds: ["invoice-own-1"],
  });

  assert.equal(query.userId, "admin-1");
  assert.equal(query.$or, undefined);
});

test("staff credit-invoice filter cannot return another creator's invoice", () => {
  const query = buildNotificationScopeQuery({
    userId: "staff-1",
    notificationType: CREDIT_NOTIFICATION_TYPE,
    isStaff: true,
    staffInvoiceIds: ["invoice-own-1"],
  });

  assert.equal(query.type, CREDIT_NOTIFICATION_TYPE);
  assert.deepEqual(query.entityId, { $in: ["invoice-own-1"] });
  assert.equal(query.$or, undefined);
});

test("notification reads and read-state updates use the same ownership scope", () => {
  const scopeUsages = notificationControllerSource.match(
    /getNotificationScopeQuery\(/g
  );

  assert.ok(
    (scopeUsages?.length || 0) >= 4,
    "list, unread count, mark-read, and mark-all must use the scoped query"
  );
});
