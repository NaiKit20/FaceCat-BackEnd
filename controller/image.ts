import express from "express";
import path from "path";
import multer from "multer";
import mysql from "mysql";
import { UploadPostReq } from "../model/Request/UploadPostReq";
import { conn } from "./../app";
import { Image as ScoreRes } from "../model/Response/image";
import * as fs from "fs";

export const router = express.Router();

// การ upload file ลงเครื่อง
class FileMiddleware {
  filename = "";
  public readonly diskLoader = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, path.join(__dirname, "../uploads"));
      },
      filename: (req, file, cb) => {
        const uniqueSuffix =
          Date.now() + "-" + Math.round(Math.random() * 10000);
        this.filename = uniqueSuffix + "." + file.originalname.split(".").pop();
        cb(null, this.filename);
      },
    }),
    limits: {
      fileSize: 67108864, // 64 MByte
    },
  });
}

// แสดงรูปภาพทั้งหมด
router.get("/", (req, res) => {
  conn.query(
    "SELECT image.uid, image.mid, image.name, image.path, SUM(CASE WHEN vote.type = 1 THEN vote.vote ELSE 0 END) - SUM(CASE WHEN vote.type = 0 THEN vote.vote ELSE 0 END) AS total_vote_difference FROM image INNER JOIN vote ON image.mid = vote.mid GROUP BY image.mid ORDER BY SUM(vote.vote) DESC",
    (err, result) => {
      if (err) {
        res.status(500).json({
          result: err.sqlMessage,
        });
      } else {
        if (result.length > 0) {
          res.status(200).json(result);
        } else {
          res.status(401).json(result);
        }
      }
    }
  );
});

// upload file ลงเครื่องและเก็บที่อยู่ภาพลงใน database
const fileUpload = new FileMiddleware();
router.post("/upload", fileUpload.diskLoader.single("file"), (req, res) => {
  let user: UploadPostReq = req.body;
  let sql = "INSERT INTO `image`(`path`, `name`, `uid`) VALUES (?,?,?)";
  sql = mysql.format(sql, [fileUpload.filename, user.name, user.uid]);
  conn.query(sql, (err, result) => {
    if (err) {
      res
        .status(409)
        .json({ affected_row: 0, last_idx: 0, result: err.sqlMessage });
    } else {
      res.status(201).json({
        affected_row: result.affectedRows,
        last_idx: result.insertId,
        result: fileUpload.filename,
      });
    }
  });
});

// ลบรูปภาพจาก server และลบข้อมูลจาก database
router.delete("/:id", fileUpload.diskLoader.single("file"), (req, res) => {
  const mid = req.params.id;
  // ค้นหาข้อมูลรูปภาพที่ต้องการลบจาก database
  conn.query("SELECT * FROM `image` WHERE mid = ?", [mid], (err, result) => {
    if (err) {
      res.status(500).send("Failed to delete file");
    } else {
      if (result.length > 0) {
        const image: ScoreRes[] = result;
        const filePath = path.join(__dirname, "..", "uploads", image[0].path);
        // ตรวจสอบว่า path file มีหรือไม่
        if (fs.existsSync(filePath)) {
          // ลบไฟล์จาก server
          fs.unlinkSync(filePath);
          // ลบผลโหวตของรูปจาก database
          conn.query(
            "DELETE FROM `vote` WHERE mid = ?",
            [mid],
            (err, result) => {
              if (err) {
                res.status(500).json({ affected_row: 0 });
              } else {
                // ลบข้อมูลรูปจาก database
                conn.query(
                  "DELETE FROM `image` WHERE mid = ?",
                  [mid],
                  (err, result) => {
                    if (err) {
                      res.status(500).json({ affected_row: 0 });
                    } else {
                      res
                        .status(200)
                        .json({ affected_row: result.affectedRows });
                    }
                  }
                );
              }
            }
          );
        } else {
          res.status(500).send("Failed to delete file");
        }
      } else {
        res.status(500).send("ImageID not found");
      }
    }
  });
});

// สุ่มรูปภาพว่าใครเป็นคนสุ่ม
router.get("/random/:uid", (req, res) => {
  conn.query(
    "SELECT image.mid, image.path, image.name, image.uid, SUM(CASE WHEN vote.type = 1 THEN vote.vote ELSE 0 END) - SUM(CASE WHEN vote.type = 0 THEN vote.vote ELSE 0 END) AS score FROM `image`, `vote` WHERE vote.mid = image.mid and image.uid != ? GROUP by image.mid",
    [req.params.uid],
    (err, result) => {
      if (err) {
        res.status(500).json({ result: err.sqlMessage });
      } else {  
        const images: ScoreRes[] = result;
        console.log(images);
        
        let image1: ScoreRes = images[Math.floor(Math.random() * images.length)];
        let image2: ScoreRes = images[Math.floor(Math.random() * images.length)];
        // สุ่มอีกรูปใหม่จนกว่ารูปทั้ง2 ไม่ใช่รูปของคนคนเดียวกัน
        while (image1.uid === image2.uid) {
          image2 = images[Math.floor(Math.random() * images.length)];
        }
        res.status(200).json([
          image1,
          image2
        ]);
      }
    }
  );
});
