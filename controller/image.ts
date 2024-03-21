import express from "express";
import path from "path";
import multer from "multer";
import mysql from "mysql";
import { UploadPostReq } from "../model/Request/UploadPostReq";
import { conn } from "./../app";
import { Image } from "../model/Response/image";
import { storage } from "../firebase";
import { deleteObject, ref } from "firebase/storage";
import {} from "firebase/storage";
import { uploadBytesResumable, getDownloadURL } from "firebase/storage";
import * as fs from "fs";

export const router = express.Router();

// Middleware save to memory
class FileMiddleware {
  //Attribute of class
  filename = "";
  //Attribute diskloader for saving file to disk
  public readonly diskLoader = multer({
    // storage = saving file to memory
    storage: multer.memoryStorage(),
    // limit file size
    limits: {
      fileSize: 67108864, // 64 MByte
    },
  });
}

// แสดงรูปภาพทั้งหมด แสดงตามคะแนนมากไปน้อย โดยเวลาปัจจุบัน
router.get("/", (req, res) => {
  conn.query(
    "SELECT image.mid, image.path, image.name, image.uid, SUM(vote.vote) AS score FROM `image`, `vote` WHERE vote.mid = image.mid GROUP by image.mid ORDER by score DESC",
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

// แสดงอันดับรูปภาพทั้งหมด แสดงตามคะแนนมากไปน้อย โดยเวลาปัจจุบันเปรียบเทียบกับเมื่อวาน ผ่านแล้ว
router.get("/rank", async (req, res) => {
  // หาลำดับของรูปภาพทั้งหมดในวันนี้
  let result1: any = await new Promise((resolve, reject) => {
    // ค้นหาอันดับรูปภาพทั้งหมดย้อนหลังตามจำนวนวันที่ต้องการ ด้วยวันย้อนหลังที่ i วัน
    conn.query(
      "SELECT image.mid, image.path, image.name, image.uid, SUM(vote.vote) AS score FROM image INNER JOIN vote ON vote.mid = image.mid and vote.datetime <= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY image.mid ORDER BY score DESC",
      [0],
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      }
    );
  });
  let today: Image[] = result1;
  // หาลำดับของรูปภาพทั้งหมดในเมื่อวาน
  let result2: any = await new Promise((resolve, reject) => {
    // ค้นหาอันดับรูปภาพทั้งหมดย้อนหลังตามจำนวนวันที่ต้องการ ด้วยวันย้อนหลังที่ i วัน
    conn.query(
      "SELECT image.mid, image.path, image.name, image.uid, SUM(vote.vote) AS score FROM image INNER JOIN vote ON vote.mid = image.mid and vote.datetime <= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY image.mid ORDER BY score DESC",
      [1],
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      }
    );
  });
  let yesterday: Image[] = result2;
  // คำนวนผลปัจจุบันกับเมื่อวานว่าขึ้นลงกี่อันดับ
  for (let i = 0; i < today.length; i++) {
    for (let j = 0; j < yesterday.length; j++) {
      if (today[i].mid == yesterday[j].mid) {
        if (j + 1 - (i + 1) > 0) {
          today[i].result = "+" + (j + 1 - (i + 1)).toString();
        } else if (j + 1 - (i + 1) < 0) {
          today[i].result = (j + 1 - (i + 1)).toString();
        } else {
          today[i].result = " ";
        }
        break;
      }
    }
  }
  // Response
  res.status(200).json({
    today: today,
    yesterday: yesterday,
  });
});

// แสดงรูปภาพของ User ที่มีทั้งหมด ผ่านแล้ว
router.get("/user/:uid", (req, res) => {
  const uid = req.params.uid;
  conn.query(
    "SELECT image.mid, image.path, image.name, image.uid, SUM(vote.vote) AS score FROM `image`, `vote` WHERE vote.mid = image.mid and image.uid = ? GROUP by image.mid",
    [uid],
    async (err, result) => {
      if (err) {
        res.status(500).send(err);
      } else {
        res.status(200).json(result);
      }
    }
  );
});

// upload file ลงใน Firebase Store และเก็บที่อยู่ภาพลงใน database ผ่านแล้ว
const fileUpload = new FileMiddleware();
router.post(
  "/upload",
  fileUpload.diskLoader.single("file"),
  async (req, res) => {
    // upload รูปภาพลง firebase
    const url = await firebaseUpload(req.file!);
    // บันทึกที่อยู่รูปภาพลง Database
    let user: UploadPostReq = req.body;
    let sql = "INSERT INTO `image`(`path`, `name`, `uid`) VALUES (?,?,?)";
    sql = mysql.format(sql, [url, user.name, user.uid]);
    conn.query(sql, (err, resultImage) => {
      if (err) {
        res
          .status(409)
          .json({ affected_row: 0, last_idx: 0, result: err.sqlMessage });
      } else {
        // เพิ่มคะแนนของรูปภาพให้มีค่าเริ่มค้นเท่ากัน 0
        conn.query(
          "INSERT INTO `vote`(`mid`, `uid`, `vote`) VALUES (?,?,?)",
          [resultImage.insertId, null, 0],
          (err, result) => {
            if (err) {
              res.status(500).json({ affected_row: 0, result: err.sqlMessage });
            } else {
              res.status(201).json({
                affected_row: result.affectedRows,
                last_idx: resultImage.insertId,
                result: url,
              });
            }
          }
        );
      }
    });
  }
);

// ลบรูปภาพจาก firebase และลบข้อมูลจาก database ผ่านแล้ว
router.delete("/:id", fileUpload.diskLoader.single("file"), (req, res) => {
  const mid = req.params.id;
  // ค้นหาข้อมูลรูปภาพที่ต้องการลบจาก database
  conn.query(
    "SELECT `mid`, `path`, `name`, `uid`, NULL as score FROM `image` WHERE mid = ?",
    [mid],
    async (err, result) => {
      if (err) {
        res.status(500).send("Failed to delete file");
      } else {
        if (result.length > 0) {
          const image: Image[] = result;
          // ลบรูปภาพออกจาก firebase
          await firebaseDelete(image[0].path);
          // ลบข้อมูลการโหวตของรูปภาพออกจาก database
          conn.query(
            "DELETE FROM `vote` WHERE mid = ?",
            [mid],
            (err, result) => {
              if (err) {
                res.status(500).json({ affected_row: 0 });
              } else {
                // ลบข้อมูลรูปภาพจาก database
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
          res.status(500).send("ImageID not found");
        }
      }
    }
  );
});

// สุ่มรูปภาพ ผ่านแล้ว
router.get("/random", async (req, res) => {
  let limit: number;
  // ดึงเวลา limit การสุ่มรูป
  let result: any = await new Promise((resolve, reject) => {
    conn.query(
      "SELECT * FROM `system`",
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      }
    );
  });
  limit = result[0]["limit"];
  // สุ่มรูป
  conn.query(
    "SELECT image.mid, image.path, image.name, image.uid, SUM(vote.vote) AS score FROM `image`, `vote` WHERE vote.mid = image.mid GROUP by image.mid",
    (err, result) => {
      if (err) {
        res.status(500).json({ result: err.sqlMessage });
      } else {
        res.status(200).json({
          random: result,
          limit: limit,
        });
      }
    }
  );
});

// router.get("/random", async (req, res) => {  
//   let limit: number;
//   // ดึงเวลา limit การสุ่มรูป
//   let result: any = await new Promise((resolve, reject) => {
//     conn.query(
//       "SELECT * FROM `system`",
//       (err, result) => {
//         if (err) {
//           reject(err);
//         } else {
//           resolve(result);
//         }
//       }
//     );
//   });
//   limit = result[0]["limit"];
//   // สุ่มรูป
//   conn.query(
//     "SELECT image.mid, image.path, image.name, image.uid, SUM(vote.vote) AS score FROM `image`, `vote` WHERE vote.mid = image.mid GROUP by image.mid",
//     (err, result) => {
//       if (err) {
//         res.status(500).json({ result: err.sqlMessage });
//       } else {
//         const images: Image[] = result;

//         let image1: Image = images[Math.floor(Math.random() * images.length)];
//         let image2: Image = images[Math.floor(Math.random() * images.length)];
//         // สุ่มอีกรูปใหม่จนกว่ารูปทั้ง2 ไม่ใช่รูปของคนคนเดียวกัน
//         while (image1.mid === image2.mid) {
//           image2 = images[Math.floor(Math.random() * images.length)];
//         }
//         res.status(200).json({
//           random: [image1, image2],
//           limit: limit,
//         });
//       }
//     }
//   );
// });

// Function ***************************************************************************************************

// upload รูปภาพใน firebase
async function firebaseUpload(file: Express.Multer.File) {
  // Upload to firebase storage
  const filename = Date.now() + "-" + Math.round(Math.random() * 1000) + ".png";
  // Define locations to be saved on storag
  const storageRef = ref(storage, "/images/" + filename);
  // define file detail
  const metaData = { contentType: file.mimetype };
  // Start upload
  const snapshost = await uploadBytesResumable(
    storageRef,
    file.buffer,
    metaData
  );
  // Get url image from storage
  const url = await getDownloadURL(snapshost.ref);

  return url;
}

// ลบรูปภาพใน firebase
async function firebaseDelete(path: string) {
  const storageRef = ref(
    storage,
    "/images/" + path.split("F")[1].split("?")[0]
  );
  const snapshost = await deleteObject(storageRef);
}
