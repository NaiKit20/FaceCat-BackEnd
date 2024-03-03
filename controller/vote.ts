import express from "express";
import { conn } from "./../app";

export const router = express.Router();

router.get("/:win/:Wscore/:lose/:Lscore", (req, res) => {
  // K ค่าคงที่คะแนนเพิ่มลด
  const K: number = 24;
  // คะนนล่าสุดของ ผู้ชนะ และ ผู้แพ้
  let Wscore: number = parseInt(req.params.Wscore);
  let Lscore: number = parseInt(req.params.Lscore);
  // ค่าคาดหวัดผลลัพธ์
  let Ew: number = 1/(1+(10 ** ((Lscore-Wscore)/400)));
  let El: number = 1/(1+(10 ** ((Wscore-Lscore)/400)));

  res.json({
    "Win score up to": Math.floor(Wscore + K*(1-Ew)),
    "Lose score down to": Math.floor(Lscore + K*(0-El))
  });
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