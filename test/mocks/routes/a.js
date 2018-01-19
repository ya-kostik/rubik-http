const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ text: 'a' });
});

module.exports = { name: '/a', router };
