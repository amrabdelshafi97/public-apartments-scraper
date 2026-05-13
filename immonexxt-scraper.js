const config = require('./config');
const BaseScraper = require('./base-scraper');

class ImmoNeXxtScraper extends BaseScraper {
  mergeConfig(overrides) {
    return {
      targetRooms: config.targetRooms,
      maxRent: config.maxRent,
      dataFile: config.immonexxtDataFile,
      url: config.immonexxtUrl,
      ...overrides,
    };
  }

  getSourceName() {
    return 'ImmoNeXxt';
  }

  async fetchApartments() {
    try {
      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Fetching apartments from ImmoNeXxt...`);

      await this.setupBrowser();

      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Loading: ${this.config.url}`);
      await this.page.goto(this.config.url, { waitUntil: 'networkidle', timeout: 30000 });

      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Waiting for apartment listings...`);
      try {
        await this.page.locator('.immo-card-slim').first().waitFor({ timeout: 10000 });
        console.log(`[${this.timestamp()}] [${this.getSourceName()}] Apartment listings found`);
      } catch (e) {
        console.warn(`[${this.timestamp()}] [${this.getSourceName()}] ⚠️  Timeout waiting for listings`);
      }

      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Extracting apartments...`);
      const pageApartments = await this.page.evaluate(() => {
        const results = [];
        let skipped = 0;

        document.querySelectorAll('.immo-card-slim').forEach(card => {
          try {
            const link = card.href || '';
            const fullText = card.textContent || '';

            // Address is in the truncated text element
            const addressEl = card.querySelector('.text-xs.text-slate-400.whitespace-nowrap');
            const address = addressEl ? addressEl.textContent.trim() : '';

            if (!address) { skipped++; return; }

            // Rent is the first text node with € sign
            const rentMatch = fullText.match(/^([\d.,]+)\s*€/);
            const rent = rentMatch ? parseFloat(rentMatch[1].replace(',', '.')) : 0;

            // Rooms: number immediately before "Zimmer"
            const roomsMatch = fullText.match(/(\d+)\s*Zimmer/);
            const rooms = roomsMatch ? parseInt(roomsMatch[1]) : 0;

            // Size: number before m²
            const sizeMatch = fullText.match(/([\d.]+)m²/);
            const size = sizeMatch ? parseFloat(sizeMatch[1]) : 0;

            const title = address;

            results.push({ title, address, rooms, rent, size, link });
          } catch (e) {
            skipped++;
          }
        });

        return {
          apartments: results,
          stats: { total: document.querySelectorAll('.immo-card-slim').length, extracted: results.length, skipped }
        };
      });

      const allApartments = pageApartments.apartments || pageApartments;
      const stats = pageApartments.stats;

      if (stats) {
        console.log(`[${this.timestamp()}] [${this.getSourceName()}] Stats: Found ${stats.total} total listings, extracted ${stats.extracted}, skipped ${stats.skipped}`);
      }

      return allApartments.map(apt => ({
        ...apt,
        id: this.generateId(apt.address, apt.title, apt.link),
        fetchedAt: this.timestamp()
      }));

    } catch (error) {
      console.error(`[${this.timestamp()}] [${this.getSourceName()}] ❌ Error fetching apartments:`, error.message);
      throw error;
    } finally {
      await this.cleanupBrowser();
    }
  }
}

module.exports = ImmoNeXxtScraper;
