require('dotenv').config();
const InBerlinWohnenScraper = require('./inberlinwohnen-scraper');
const ImmoNeXxtScraper = require('./immonexxt-scraper');

class ScraperOrchestrator {
  constructor() {
    this.inberlinwohnenScraper = new InBerlinWohnenScraper();
    this.immonexxtScraper = new ImmoNeXxtScraper();
  }

  async runAllScrapers() {
    console.log(`\n[${new Date().toISOString()}] 🔄 Running all apartment scrapers...`);

    const results = await Promise.allSettled([
      this.inberlinwohnenScraper.run(),
      this.immonexxtScraper.run()
    ]);

    const sources = ['InBerlinWohnen', 'ImmoNeXxt'];
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
