const express = require("express");
const router = express.Router();

const {
    getAllReports,
    getQueue,
    getReportById,
    getReportRoute,
    createReport,
    updateReport,
    assignReport,
    completeReport,
    unassignReport,
    updateReportStatus,
    deleteReport
} = require("../controllers/reportsController");

router.get("/", getAllReports);                 // ?status=&severity=&limit=&offset=
router.get("/queue", getQueue);                 // waiting reports by priority (must be before /:id)
router.post("/", createReport);                 // ?auto_dispatch=true

router.get("/:id", getReportById);
router.patch("/:id", updateReport);
router.delete("/:id", deleteReport);

router.get("/:id/route", getReportRoute);
router.post("/:id/assign", assignReport);
router.post("/:id/complete", completeReport);
router.post("/:id/unassign", unassignReport);
router.patch("/:id/status", updateReportStatus);   // generic status change

module.exports = router;
