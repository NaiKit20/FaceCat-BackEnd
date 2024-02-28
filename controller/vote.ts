import express from "express";
import { conn } from "./../app";

export const router = express.Router();

router.get("/", (req, res) => {
  res.send("vote controller");
});

// การกดโหวต
router.post("/:mid/:uid/:vote", (req, res) => {
  conn.query(
    "INSERT INTO `vote`(`mid`, `uid`, `vote`) VALUES (?,?,?)",
    [req.params.mid, req.params.uid, req.params.vote],
    (err, result) => {
      if (err) {
        res.status(500).json({ affected_row: 0, result: err.sqlMessage });
      } else {
        res.status(200).json({ affected_row: result.affectedRows, result: "" });
      }
    }
  );
});

// Hello Kit