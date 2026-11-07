const express = require("express");
const router = express.Router();

const {
    getAllAmbulances,
    getAmbulanceById,
    createAmbulance,
    updateAmbulance,
    updateAmbulanceStatus,
    deleteAmbulance
} = require("../controllers/ambulancesController");

router.get("/", getAllAmbulances);              // ?status=available|busy|offline
router.post("/", createAmbulance);
router.get("/:id", getAmbulanceById);
router.patch("/:id", updateAmbulance);          // name / location
router.patch("/:id/status", updateAmbulanceStatus);
router.delete("/:id", deleteAmbulance);

module.exports = router;
