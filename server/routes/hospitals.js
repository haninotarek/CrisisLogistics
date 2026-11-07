const express = require("express");
const router = express.Router();

const {
    getAllHospitals,
    getAvailableHospitals,
    getHospitalById,
    createHospital,
    updateHospital,
    updateBeds,
    deleteHospital
} = require("../controllers/hospitalsController");

router.get("/", getAllHospitals);
router.get("/available", getAvailableHospitals); // ?beds=2  (must be before /:id)
router.post("/", createHospital);
router.get("/:id", getHospitalById);
router.patch("/:id", updateHospital);
router.patch("/:id/beds", updateBeds);           // { available_beds } or { change }
router.delete("/:id", deleteHospital);

module.exports = router;
