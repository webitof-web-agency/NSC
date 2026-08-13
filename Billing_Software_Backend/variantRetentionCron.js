const cron = require("node-cron");
const { deleteInactiveLowStockVariants } = require("@services/variantRetentionService");

const runVariantRetentionCron = async () => {
  try {
    const result = await deleteInactiveLowStockVariants();
    console.log(
      `[Variant Retention] Checked ${result.checkedCount} variants, deleted ${result.deletedCount} inactive low/out-of-stock variant(s).`
    );
  } catch (error) {
    console.error("[Variant Retention] Cleanup failed:", error);
  }
};

cron.schedule("15 2 * * *", runVariantRetentionCron);

module.exports = {
  runVariantRetentionCron,
};
