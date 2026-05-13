const path = require('path');

module.exports = {
  targetRooms: parseInt(process.env.TARGET_ROOMS) || 3,
  maxRent: parseInt(process.env.MAX_RENT) || 1200,
  checkInterval: process.env.CHECK_INTERVAL || '*/5 * * * *',
  wbmDataFile: path.join(__dirname, 'apartments-data.json'),
  howogeDataFile: path.join(__dirname, 'howoge-data.json'),
  wbmUrl: 'https://www.wbm.de/wohnungen-berlin/angebote/',
  howogeUrl: 'https://www.howoge.de/immobiliensuche/wohnungssuche.html',
};
