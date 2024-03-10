import express from "express";
import { conn } from "./../app";

export const router = express.Router();

// การกดโหวต
router.post("/:win/:Wscore/:lose/:Lscore", (req, res) => {
  const win:number = parseInt(req.params.win);
  const Wscore:number = parseInt(req.params.Wscore);
  const lose:number = parseInt(req.params.lose);
  const Lscore:number = parseInt(req.params.Lscore);
  // ลงคะแนนให้ผู้ชนะ
  conn.query(
    "INSERT INTO `vote`(`mid`, `uid`, `vote`) VALUES (?,?,?)",
    [win, null, Wscore],
    (err, result) => {
      if (err) {
        res.status(500).json({ result: err.sqlMessage });
      } else {
        // ลงคะแนนให้ผู้แพ้
        conn.query(
          "INSERT INTO `vote`(`mid`, `uid`, `vote`) VALUES (?,?,?)",
          [lose, null, Lscore],
          (err, result) => {
            if (err) {
              res.status(500).json({ result: err.sqlMessage });
            } else {
              res.status(200).json({ result: "" });
            }
          }
        );
      }
    }
  );
});

// router.post("/:mid/:uid/:vote", (req, res) => {
//   conn.query(
//     "INSERT INTO `vote`(`mid`, `uid`, `vote`) VALUES (?,?,?)",
//     [req.params.mid, req.params.uid, req.params.vote],
//     (err, result) => {
//       if (err) {
//         res.status(500).json({ affected_row: 0, result: err.sqlMessage });
//       } else {
//         res.status(200).json({ affected_row: result.affectedRows, result: "" });
//       }
//     }
//   );
// });
