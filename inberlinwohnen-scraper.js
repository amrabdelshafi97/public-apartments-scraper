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

  async fetchApartments() {
    try {
      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Fetching apartments from inberlinwohnen.de...`);

      await this.setupBrowser();
      await this.page.goto(`${this.config.url}?page=1`, { waitUntil: 'networkidle', timeout: 30000 });

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

      const allApartments = [];

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        if (pageNum > 1) {
          console.log(`[${this.timestamp()}] [${this.getSourceName()}] Loading page ${pageNum}/${totalPages}...`);
          await this.page.goto(`${this.config.url}?page=${pageNum}`, { waitUntil: 'networkidle', timeout: 30000 });
        }

        const pageItems = await this.page.evaluate(() => {
          const titleSnaps = {};
          const deeplinkSnaps = {};

          for (const el of document.getElementsByTagName('*')) {
            if (!el.hasAttribute('wire:snapshot')) continue;
            try {
              const data = JSON.parse(el.getAttribute('wire:snapshot'));
              const d = data.data;
              const name = data.memo?.name || '';
              if (name.includes('collapsible-apartment-title') && d && d.itemId) {
                titleSnaps[d.itemId] = d;
              } else if (name.includes('deeplink-button') && d && d.flatId) {
                deeplinkSnaps[d.flatId] = d;
              }
            } catch (e) {}
          }

          return Object.values(titleSnaps).map(d => ({
            itemId: d.itemId,
            rooms: d.rooms || '0',
            area: d.area || '0',
            rentNet: d.rentNet || '0',
            street: d.street || '',
            number: d.number || '',
            zipCode: d.zipCode || '',
            district: d.district || '',
            deeplink: deeplinkSnaps[d.itemId]?.deeplink || '',
          }));
        });

        console.log(`[${this.timestamp()}] [${this.getSourceName()}] Page ${pageNum}: extracted ${pageItems.length} apartments`);
        allApartments.push(...pageItems);
      }

      console.log(`[${this.timestamp()}] [${this.getSourceName()}] Total raw apartments: ${allApartments.length}`);

      return allApartments.map(item => {
        const address = `${item.street} ${item.number}, ${item.zipCode} ${item.district}`.trim();
        const rooms = parseInt(item.rooms.replace(',', '.')) || 0;
        const rent = parseFloat(item.rentNet.replace('.', '').replace(',', '.')) || 0;
        const size = parseFloat(item.area.replace('.', '').replace(',', '.')) || 0;
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
