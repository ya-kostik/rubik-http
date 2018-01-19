const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ text: 'b' });
});

module.exports = {
  name: '/b', router
};
