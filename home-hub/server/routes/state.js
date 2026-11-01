const { Router } = require('express');
const state = require('../state');

const router = Router();

router.get('/', (req, res) => {
  res.json(state.snapshot());
});

module.exports = router;
