require('dotenv').config();
const WBMScraper = require('./wbm-scraper');
const HowogeScraper = require('./howoge-scraper');
const ImmoNeXxtScraper = require('./immonexxt-scraper');

class ScraperOrchestrator {
  constructor() {
    this.wbmScraper = new WBMScraper();
    this.howogeScraper = new HowogeScraper();
    this.immonexxtScraper = new ImmoNeXxtScraper();
  }

  async runAllScrapers() {
    console.log(`\n[${new Date().toISOString()}] 🔄 Running all apartment scrapers...`);

    const results = await Promise.allSettled([
      this.wbmScraper.run(),
      this.howogeScraper.run(),
      this.immonexxtScraper.run()
    ]);

    const sources = ['WBM', 'Howoge', 'ImmoNeXxt'];
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        console.error(`[${new Date().toISOString()}] ❌ ${sources[idx]} scraper failed:`, result.reason.message);
      }
    });

    const failureCount = results.filter(r => r.status === 'rejected').length;
    if (failureCount > 0) {
      console.warn(`[${new Date().toISOString()}] ⚠️  ${failureCount} scraper(s) failed`);
    }
  }
}

module.exports = ScraperOrchestrator;
