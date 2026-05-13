const config = require('./config');
const BaseScraper = require('./base-scraper');

class WBMScraper extends BaseScraper {
  mergeConfig(overrides) {
    return {
      targetRooms: config.targetRooms,
      maxRent: config.maxRent,
      checkInterval: config.checkInterval,
      dataFile: config.wbmDataFile,
      url: config.wbmUrl,
      ...overrides,
    };
  }

  getSourceName() {
    return 'WBM';
  }

  async fetchApartments() {
    try {
      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Fetching apartments from WBM...`);

      await this.setupBrowser();
      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Loading page: ${this.config.url}`);
      await this.page.goto(this.config.url, { waitUntil: 'networkidle', timeout: 30000 });
      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Page loaded successfully`);

      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Waiting for apartment listings...`);
      try {
        await this.page.locator('article.immo-element').first().waitFor({ timeout: 10000 });
        console.log(`[${this.timestamp()}] [${this.getSourceName()}] Apartment listings found`);
      } catch (e) {
        console.warn(`[${this.timestamp()}] [${this.getSourceName()}] ⚠️  Timeout waiting for listings, continuing anyway... Error: ${e.message}`);
      }

      const count = await this.page.locator('article.immo-element').count();
      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Before evaluate: found ${count} immo-element articles on page`);

      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Extracting apartments...`);
      const apartments = await this.page.evaluate(() => {
        const results = [];
        const listings = document.querySelectorAll('article.immo-element:not(.teaserBox)');
        let skipped = 0;
        let extracted = 0;
        let missingFields = 0;

        listings.forEach((item, idx) => {
          try {
            const titleEl = item.querySelector('h2.imageTitle');
            const addressEl = item.querySelector('.address');
            const roomsEl = item.querySelector('.main-property-rooms');
            const rentEl = item.querySelector('.main-property-rent');

            if (!titleEl || !addressEl || !roomsEl) {
              missingFields++;
              skipped++;
              return;
            }

            const title = titleEl.textContent?.trim() || '';
            const address = addressEl.textContent?.trim() || '';
            const roomsText = roomsEl.textContent?.trim() || '';
            const rooms = parseInt(roomsText) || 0;

            const rentText = rentEl?.textContent?.trim() || '';
            const rent = rentText ? parseFloat(rentText.replace(/[^0-9,.-]/g, '').replace(',', '.')) : 0;

            const sizeMatch = item.textContent.match(/(\d+)\s*(?:m²|m2|qm)/i);
            const size = sizeMatch ? parseInt(sizeMatch[1]) : 0;

            const link = item.querySelector('a')?.href || '';

            if (title && address && rooms > 0) {
              results.push({ title, address, rooms, rent, size, link });
              extracted++;
            }
          } catch (e) {
            // Skip problematic items
          }
        });

        return {
          apartments: results,
          stats: { total: listings.length, extracted, skipped, missingFields }
        };
      });

      const apartmentsList = apartments.apartments || apartments;
      const stats = apartments.stats;

      if (stats) {
        console.log(`[${this.timestamp()}] [${this.getSourceName()}] Stats: Found ${stats.total} total articles, extracted ${stats.extracted}, missing fields ${stats.missingFields}, skipped ${stats.skipped}`);
      }
      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Found ${apartmentsList.length} valid apartments`);

      return apartmentsList.map(apt => ({
        ...apt,
        id: this.generateId(apt.address, apt.title, apt.link),
        fetchedAt: this.timestamp()
      }));

    } catch (error) {
      console.error(`[${this.timestamp()}] [${this.getSourceName()}] ❌ Error fetching apartments:`, error.message);
      console.error(`[${this.timestamp()}] [${this.getSourceName()}] Error stack:`, error.stack);
      throw error;
    } finally {
      await this.cleanupBrowser();
    }
  }
}

module.exports = WBMScraper;
