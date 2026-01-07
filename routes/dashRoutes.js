const express = require("express");
const router = express.Router();

const auth = require("../middlewares/authMiddleware") 
  || require("../middleware/authMiddleware") 
//   || require("../Middlewares/authMiddleware");

console.log("Loaded auth middleware:", auth);

const { getStats } = require("../controller/dashboardController");

// Attach safely
if (auth?.protect) router.use(auth.protect);
if (auth?.adminOnly) router.use(auth.adminOnly);

router.get("/stats", getStats);

module.exports = router;
