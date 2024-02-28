import express from "express";
import path from "path";
import multer from "multer";
import mysql from "mysql";
import { UploadPostReq } from "../model/Request/UploadPostReq";
import { conn } from "./../app";
import { Image } from "../model/Response/image";
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
  conn.query("SELECT image.uid, image.mid, image.name, image.path, SUM(vote.vote) FROM `vote`, `image` WHERE image.mid = vote.mid GROUP BY image.mid ORDER BY SUM(vote.vote) DESC", (err, result) => {
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
  });
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
        const image: Image[] = result;
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
