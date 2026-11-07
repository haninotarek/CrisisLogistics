const express = require("express");
const router = express.Router();

const { dispatchNext, dispatchAll } = require("../controllers/dispatchController");

router.post("/next", dispatchNext);
router.post("/all", dispatchAll);

module.exports = router;
