const path = require('path');

module.exports = {
  targetRooms: parseInt(process.env.TARGET_ROOMS) || 3,
  maxRent: parseInt(process.env.MAX_RENT) || 1200,
  inberlinwohnenDataFile: path.join(__dirname, 'inberlinwohnen-data.json'),
  immonexxtDataFile: path.join(__dirname, 'immonexxt-data.json'),
  inberlinwohnenUrl: 'https://www.inberlinwohnen.de/wohnungsfinder',
  immonexxtUrl: 'https://immonexxt.com/en/rental-offers-living',
};
