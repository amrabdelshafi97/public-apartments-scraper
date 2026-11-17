const config = require('./config');
const BaseScraper = require('./base-scraper');

class InBerlinWohnenScraper extends BaseScraper {
  mergeConfig(overrides) {
    return {
      targetRooms: config.targetRooms,
      maxRent: config.maxRent,
      dataFile: config.inberlinwohnenDataFile,
      url: config.inberlinwohnenUrl,
      ...overrides,
    };
  }

  getSourceName() {
    return 'InBerlinWohnen';
  }

  async setupBrowser() {
    const launchOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    };

    if (process.env.NODE_ENV === 'production') {
      launchOptions.executablePath = '/usr/bin/chromium';
    }

    console.log(`[${this.timestamp()}] [${this.getSourceName()}] Launching browser...`);
    this.browser = await this.launchBrowserWithRetry(launchOptions);
    console.log(`[${this.timestamp()}] [${this.getSourceName()}] Browser launched successfully`);

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      acceptDownloads: false,
    });
    this.page = await this.context.newPage();
    console.log(`[${this.timestamp()}] [${this.getSourceName()}] Context and page created`);
  }

  async scrapePage(pageUrl) {
    const pageNumber = Number(new URL(pageUrl).searchParams.get('page') || '1');
    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      acceptDownloads: false,
    });
    const page = await context.newPage();

    try {
      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Loading page ${pageNumber}...`);
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      const pageItems = await page.evaluate(() => {
        const items = {};

        for (const el of document.getElementsByTagName('*')) {
          if (!el.hasAttribute('wire:snapshot')) continue;
          try {
            const snap = JSON.parse(el.getAttribute('wire:snapshot'));
            const name = snap.memo?.name || '';
            if (name !== 'apartment-finder.item.apartment-item') continue;
            const raw = snap.data?.data?.[0];
            if (!raw?.id) continue;
            items[raw.id] = raw;
          } catch (e) {}
        }

        return Object.values(items).map(d => ({
          itemId: d.id,
          rooms: d.rooms || '0',
          area: d.area || '0',
          rentNet: parseFloat(d.rent_net) || 0,
          extraCosts: parseFloat(d.extra_costs) || 0,
          heatingCosts: parseFloat(d.heating_costs) || 0,
          street: d.address?.[0]?.street_name || '',
          number: d.address?.[0]?.street_number || '',
          zipCode: d.address?.[0]?.zip_code || '',
          district: d.address?.[0]?.district?.[0]?.name || '',
          deeplink: d.deeplink || '',
        }));
      });

      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Page ${pageNumber}: extracted ${pageItems.length} apartments`);
      return pageItems;
    } catch (error) {
      console.error(`[${this.timestamp()}] [${this.getSourceName()}] Error scraping page ${pageNumber}:`, error.message);
      return [];
    } finally {
      await page.close();
      await context.close();
    }
  }

  async fetchApartments() {
    try {
      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Fetching apartments from inberlinwohnen.de...`);

      await this.setupBrowser();
      await this.page.goto(`${this.config.url}?page=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });

      const totalPages = await this.page.evaluate(() => {
        for (const el of document.getElementsByTagName('*')) {
          if (!el.hasAttribute('wire:snapshot') || !el.hasAttribute('wire:id')) continue;
          try {
            const snap = JSON.parse(el.getAttribute('wire:snapshot'));
            const itemIds = snap.data?.itemIds;
            if (!itemIds) continue;
            const ids = Array.isArray(itemIds[0]) ? itemIds[0] : [];
            if (ids.length > 0) return Math.ceil(ids.length / 10);
          } catch (e) {}
        }
        return 1;
      });

      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Total pages to scrape: ${totalPages}`);

      const pageUrls = Array.from({ length: totalPages }, (_, index) => `${this.config.url}?page=${index + 1}`);
      const maxConcurrentPages = 3;
      const allApartments = [];

      for (let index = 0; index < pageUrls.length; index += maxConcurrentPages) {
        const batch = pageUrls.slice(index, index + maxConcurrentPages);
        const batchResults = await Promise.all(batch.map(pageUrl => this.scrapePage(pageUrl)));
        batchResults.forEach(pageItems => allApartments.push(...pageItems));
      }

      const uniqueApartments = new Map();
      for (const item of allApartments) {
        const uniqueKey = item.deeplink || `inberlinwohnen-${item.itemId}`;
        if (!uniqueApartments.has(uniqueKey)) {
          uniqueApartments.set(uniqueKey, item);
        }
      }

      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Total raw apartments: ${uniqueApartments.size}`);

      return [...uniqueApartments.values()].map(item => {
        const address = `${item.street} ${item.number}, ${item.zipCode} ${item.district}`.trim();
        const rooms = parseFloat(item.rooms.replace(',', '.')) || 0;
        const rent = Math.round((item.rentNet + item.extraCosts + item.heatingCosts) * 100) / 100;
        const size = parseFloat(item.area.replace(',', '.')) || 0;
        const link = item.deeplink;

        return {
          title: address,
          address,
          rooms,
          rent,
          size,
          link,
          id: this.generateId(address, address, link || `inberlinwohnen-${item.itemId}`),
          fetchedAt: this.timestamp(),
        };
      });

    } catch (error) {
      console.error(`[${this.timestamp()}] [${this.getSourceName()}] Error fetching apartments:`, error.message);
      throw error;
    } finally {
      await this.cleanupBrowser();
    }
  }
}

module.exports = InBerlinWohnenScraper;
