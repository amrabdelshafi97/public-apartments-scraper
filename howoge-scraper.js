const config = require('./config');
const BaseScraper = require('./base-scraper');

class HowogeScraper extends BaseScraper {
  mergeConfig(overrides) {
    return {
      targetRooms: config.targetRooms,
      maxRent: config.maxRent,
      checkInterval: config.checkInterval,
      dataFile: config.howogeDataFile,
      url: config.howogeUrl,
      ...overrides,
    };
  }

  getSourceName() {
    return 'Howoge';
  }

  async fetchApartments() {
    try {
      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Fetching apartments from Howoge...`);

      await this.setupBrowser();

      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Loading: ${this.config.url}`);
      await this.page.goto(this.config.url, { waitUntil: 'networkidle', timeout: 30000 });
      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Page loaded successfully`);

      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Waiting for apartment listings...`);
      try {
        await this.page.locator('.flat-single-grid-item').first().waitFor({ timeout: 10000 });
        console.log(`[${this.timestamp()}] [${this.getSourceName()}] Apartment listings found`);
      } catch (e) {
        console.warn(`[${this.timestamp()}] [${this.getSourceName()}] ⚠️  Timeout waiting for listings`);
      }

      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Extracting apartments...`);
      const pageApartments = await this.page.evaluate(() => {
        const results = [];
        const allListings = document.querySelectorAll('.flat-single-grid-item');
        const listings = Array.from(allListings).filter(item =>
          !item.closest('.buildingprojects-list-wrapper')
        );

        let extracted = 0;
        let skipped = 0;

        listings.forEach((item) => {
          try {
            const addressLink = item.querySelector('.address a.flat-single--link');
            if (!addressLink) {
              skipped++;
              return;
            }

            const address = addressLink.textContent?.trim() || '';
            const link = addressLink.href || '';

            const noticeEl = item.querySelector('.notice');
            const title = noticeEl?.textContent?.trim() || address;

            let rooms = 0;
            const roomsMatch = (noticeEl?.textContent || '').match(/(\d+)\s*-?Zimmer/i);
            if (roomsMatch) {
              rooms = parseInt(roomsMatch[1]);
            }

            let rent = 0;
            const fullText = item.textContent || '';
            const allPriceMatches = fullText.match(/(\d+(?:[.,]\d+)?)\s*€/g);
            if (allPriceMatches && allPriceMatches.length > 0) {
              const rentMatches = fullText.match(/Warmmiete[^\d]*(\d+(?:[.,]\d+)?)/i);
              if (rentMatches) {
                rent = parseFloat(rentMatches[1].replace(',', '.'));
              } else {
                rent = parseFloat(allPriceMatches[0].replace(',', '.'));
              }
            }

            let size = 0;
            const sizeMatch = fullText.match(/(\d+)\s*m²/i);
            if (sizeMatch) {
              size = parseInt(sizeMatch[1]);
            }

            if (address && rooms > 0) {
              results.push({ title, address, rooms, rent, size, link });
              extracted++;
            } else if (address) {
              results.push({ title, address, rooms, rent, size, link });
              extracted++;
            } else {
              skipped++;
            }
          } catch (e) {
            skipped++;
          }
        });

        return {
          apartments: results,
          stats: { total: listings.length, extracted, skipped }
        };
      });

      const allApartments = pageApartments.apartments || pageApartments;
      const stats = pageApartments.stats;

      if (stats) {
        console.log(`[${this.timestamp()}] [${this.getSourceName()}] Stats: Found ${stats.total} total listings, extracted ${stats.extracted}, skipped ${stats.skipped}`);
      }
      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Total apartments fetched: ${allApartments.length}`);

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

module.exports = HowogeScraper;
