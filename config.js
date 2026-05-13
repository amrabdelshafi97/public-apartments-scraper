const path = require('path');

module.exports = {
  targetRooms: parseInt(process.env.TARGET_ROOMS) || 3,
  maxRent: parseInt(process.env.MAX_RENT) || 1200,
  wbmDataFile: path.join(__dirname, 'apartments-data.json'),
  howogeDataFile: path.join(__dirname, 'howoge-data.json'),
  immonexxtDataFile: path.join(__dirname, 'immonexxt-data.json'),
  wbmUrl: 'https://www.wbm.de/wohnungen-berlin/angebote/',
  howogeUrl: 'https://www.howoge.de/immobiliensuche/wohnungssuche.html',
  immonexxtUrl: 'https://immonexxt.com/en/rental-offers-living',
};
