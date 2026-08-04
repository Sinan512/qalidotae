var express = require('express');
var fs = require('fs');
var path = require('path');
var router = express.Router();

// Directory that holds the collection imagery.
var IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');
var IMAGE_EXT = /\.(jpe?g|png|webp|avif)$/i;

/**
 * Reads /public/images and returns web-safe URLs + display labels.
 * Read at request time so newly dropped images appear without a restart.
 */
function readProducts() {
  try {
    return fs
      .readdirSync(IMAGES_DIR)
      .filter(function (file) {
        return IMAGE_EXT.test(file);
      })
      .sort()
      .map(function (file, i) {
        return {
          // encodeURIComponent keeps filenames with spaces/parentheses valid in HTML
          url: '/images/' + encodeURIComponent(file),
          name: 'Qalid Piece ' + String(i + 1).padStart(2, '0'),
          alt: 'Qalid thobe collection piece ' + (i + 1),
        };
      });
  } catch (err) {
    return [];
  }
}

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', {
    title: 'Qalid — Luxury Thobe Atelier',
    products: readProducts(),
  });
});

module.exports = router;
