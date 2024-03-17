import express from "express";
import { conn } from "./../app";
import { Image } from "../model/Response/image";

export const router = express.Router();

// การกดโหวต ผ่านแล้ว
router.post("/:win/:Wscore/:lose/:Lscore", (req, res) => {
  const win: number = parseInt(req.params.win);
  const Wscore: number = parseInt(req.params.Wscore);
  const lose: number = parseInt(req.params.lose);
  const Lscore: number = parseInt(req.params.Lscore);
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

// สรุปอันดับรูปภาพ 7 วันย้อนหลัง ยังไม่ได้ใช้งาน
router.get("/:mid", async (req, res) => {
  const mid: number = parseInt(req.params.mid);
  let name:string;
  let path:string;
  let ranks: number[] = [];
  let date: string[] = [];
  // หาลำดับของรูปภาพทั้งหมดในเวลา 7 วันที่ผ่านมา
  for (let i = 0; i < 7; i++) {
    let result: any = await new Promise((resolve, reject) => {
      // ค้นหาอันดับรูปภาพทั้งหมดย้อนหลังตามจำนวนวันที่ต้องการ ด้วยวันย้อนหลังที่ i วัน
      conn.query(
        "SELECT image.mid, image.path, image.name, image.uid, SUM(vote.vote) AS score FROM image INNER JOIN vote ON vote.mid = image.mid and vote.datetime <= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY image.mid ORDER BY score DESC",
        [i],
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        }
      );
    });
    // อันดับรูปภาพทั้งหมดของวันย้อนหลังที่ i วัน
    let images: Image[] = result;
    // หาอันดับของรูปภาพที่ต้องการในวันย้อนหลังที่ i วัน
    let rank: number;
    images.forEach((image, index) => {
      // หาลำดับรูปภาพจาก mid ที่ต้องการด้วย index + 1 จะได้อับดับของวันย้อนหลังที่ i วัน
      if (image.mid == mid) {
        rank = index + 1;
        name = image.name;
        path = image.path;
      }
    });
    ranks.push(rank!);
    // เก็บ string ของวันย้อนหลังที่ i
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - i);
    const formattedDate = currentDate.toISOString().split("T")[0];
    date.push(formattedDate);
  }

  res.status(200).json({
    mid: mid,
    name: name!,
    path: path!,
    score: ranks,
    date: date,
  });
});

// สรุปคะแนนของรูปภาพที่ต้องการ ผ่านแล้ว
router.get("/score/:mid", async (req, res) => {
  const mid: number = parseInt(req.params.mid);
  let name:string;
  let path:string;
  let scores: number[] = [];
  let date: string[] = [];
  // หาคะแนนของรูปภาพในเวลา 7 วันที่ผ่านมา
  for (let i = 0; i < 7; i++) {
    let result: any = await new Promise((resolve, reject) => {
      // ค้นหาคะแนนรูปภาพย้อนหลังตามจำนวนวันที่ต้องการ ด้วยวันย้อนหลังที่ i วัน
      conn.query(
        "SELECT image.mid, image.path, image.name, image.uid, SUM(vote.vote) AS score FROM image INNER JOIN vote ON vote.mid = image.mid and vote.datetime <= DATE_SUB(NOW(), INTERVAL ? DAY) and image.mid = ?",
        [i, mid],
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
            console.log(result);
            
          }
        }
      );
    });
    // คะแนนรูปภาพของวันย้อนหลังที่ i วัน
    let image: Image[] = result;
    name = image[0].name;
    path = image[0].path;
    // หาคะแนนของรูปภาพที่ต้องการในวันย้อนหลังที่ i วัน
    scores.push(image[0].score);
    // เก็บ string ของวันย้อนหลังที่ i
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - i);
    const formattedDate = currentDate.toISOString().split("T")[0];
    date.push(formattedDate);
  }

  res.status(200).json({
    mid: mid,
    name: name!,
    path: path!,
    score: scores,
    date: date,
  });
});