require('dotenv').config();
const schedule = require('node-schedule');
const config = require('./config');
const WBMScraper = require('./wbm-scraper');
const HowogeScraper = require('./howoge-scraper');

class ScraperOrchestrator {
  constructor() {
    this.wbmScraper = new WBMScraper();
    this.howogeScraper = new HowogeScraper();
    this.scheduledJob = null;
  }

  async runAllScrapers() {
    console.log(`\n[${new Date().toISOString()}] 🔄 Running all apartment scrapers...`);

    const results = await Promise.allSettled([
      this.wbmScraper.run(),
      this.howogeScraper.run()
    ]);

    const sources = ['WBM', 'Howoge'];
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        console.error(`[${new Date().toISOString()}] ❌ ${sources[idx]} scraper failed:`, result.reason.message);
      }
    });

    const failureCount = results.filter(r => r.status === 'rejected').length;
    if (failureCount > 0) {
      console.warn(`[${new Date().toISOString()}] ⚠️  ${failureCount} scraper(s) failed, but orchestration continues`);
    }
  }

  start() {
    console.log(`🚀 Apartment Scraper Orchestrator started!`);
    console.log(`   Scrapers: WBM Berlin, Howoge`);
    console.log(`   Rooms: >= ${config.targetRooms}, Max Rent: €${config.maxRent}`);
    console.log(`   Check interval: ${config.checkInterval}\n`);

    this.runAllScrapers().catch(error => {
      console.error(`[${new Date().toISOString()}] Initial orchestration failed:`, error);
    });

    this.scheduledJob = schedule.scheduleJob(config.checkInterval, () => {
      this.runAllScrapers().catch(error => {
        console.error(`[${new Date().toISOString()}] Scheduled orchestration failed:`, error);
      });
    });
  }

  async shutdown() {
    console.log(`[${new Date().toISOString()}] Shutting down orchestrator...`);
    if (this.scheduledJob) {
      this.scheduledJob.cancel();
    }
    await Promise.all([
      this.wbmScraper.shutdown(),
      this.howogeScraper.shutdown()
    ]);
    console.log(`[${new Date().toISOString()}] Orchestrator shut down gracefully`);
  }
}

module.exports = ScraperOrchestrator;

if (require.main === module) {
  try {
    console.log(`[${new Date().toISOString()}] 🚀 Starting Scraper Orchestrator...`);
    const orchestrator = new ScraperOrchestrator();
    orchestrator.start();

    process.on('SIGTERM', async () => {
      console.log(`[${new Date().toISOString()}] SIGTERM received, shutting down...`);
      await orchestrator.shutdown();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log(`[${new Date().toISOString()}] SIGINT received, shutting down...`);
      await orchestrator.shutdown();
      process.exit(0);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error(`[${new Date().toISOString()}] ❌ Unhandled Rejection at:`, promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
      console.error(`[${new Date().toISOString()}] ❌ Uncaught Exception:`, error);
      process.exit(1);
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Failed to start orchestrator:`, error);
    process.exit(1);
  }
}
