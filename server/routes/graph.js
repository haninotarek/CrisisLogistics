const express = require("express");
const router = express.Router();

const {
    getGraph,
    getNodes,
    createNode,
    deleteNode,
    getEdges,
    createEdge,
    deleteEdge,
    getRoute,
    getNearestNode
} = require("../controllers/graphController");

router.get("/", getGraph);                      // nodes + edges
router.get("/route", getRoute);                 // ?from=N1&to=N5
router.get("/nearest", getNearestNode);         // ?lat=&lng=

router.get("/nodes", getNodes);
router.post("/nodes", createNode);
router.delete("/nodes/:nodeId", deleteNode);

router.get("/edges", getEdges);
router.post("/edges", createEdge);
router.delete("/edges/:id", deleteEdge);

module.exports = router;
