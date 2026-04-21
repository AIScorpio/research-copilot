import { monitorFeeds, processAndStoreAlerts, getAlertStatistics } from "../src/lib/alert-engine";

async function main() {
  console.log("=== Regulatory Alert Monitoring ===");
  console.log("Starting feed monitoring...\n");

  try {
    const statsBefore = await getAlertStatistics();
    console.log("Before monitoring:");
    console.log(`  Total alerts: ${statsBefore.total}`);
    console.log(`  Unread alerts: ${statsBefore.unread}`);
    console.log(`  High priority (new): ${statsBefore.high}`);
    console.log(`  Medium priority (new): ${statsBefore.medium}`);
    console.log(`  Low priority (new): ${statsBefore.low}\n`);

    const alerts = await monitorFeeds();

    if (alerts.length === 0) {
      console.log("No new relevant alerts found.");
    } else {
      console.log(`Found ${alerts.length} relevant alerts.\n`);

      const result = await processAndStoreAlerts(alerts);

      console.log(`\nAlert processing complete:`);
      console.log(`  New alerts created: ${result.created}`);
      console.log(`  Alerts skipped (duplicates): ${result.skipped}\n`);

      if (result.created > 0) {
        console.log("New alerts created:");
        alerts.slice(0, result.created).forEach(alert => {
          console.log(`  - [${alert.priority}] ${alert.title}`);
          console.log(`    Keywords: ${alert.keywords.join(", ")}`);
          console.log(`    Relevance: ${alert.relevance}%\n`);
        });
      }
    }

    const statsAfter = await getAlertStatistics();
    console.log("After monitoring:");
    console.log(`  Total alerts: ${statsAfter.total}`);
    console.log(`  Unread alerts: ${statsAfter.unread}\n`);

    console.log("=== Monitoring Complete ===");

  } catch (error) {
    console.error("Error during monitoring:", error);
    process.exit(1);
  }
}

main();