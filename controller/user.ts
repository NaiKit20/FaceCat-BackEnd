import express from "express";
import mysql from "mysql";
import { conn } from "./../app";
import { LoginPostReq } from "../model/Request/LoginPostReq";
import { UserPostReq } from "../model/Request/UserPostReq";
import * as crypto from "crypto";
import { UpdateUserPostReq } from "../model/Request/UpdateUserPostReq";
import multer from "multer";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { storage } from "../firebase";
import { GetAllUserRes } from "../model/Response/GetAllUserRes";
import { promisify } from "util";

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

// ใช้ crypto เพื่อเข้ารหัสผ่านของผู้ใช่
function hashPassword(password: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(password);
  return hash.digest("hex");
}

// ค้นหาข้อมูล user จาก uid ผ่านแล้ว
router.get("/all", (req, res) => {
  conn.query("SELECT * FROM `user` WHERE type = 0", (err, result) => {
    if (err) {
      res.status(500).json(err);
    } else {
      res.status(200).json(result);
    }
  });
});

// ค้นหาข้อมูล user จาก uid ผ่านแล้ว
router.get("/:uid", (req, res) => {
  let uid = +req.params.uid;
  conn.query("SELECT * FROM `user` WHERE uid = ?", [uid], (err, result) => {
    if (err) {
      res.status(500).json(err);
    } else {
      res.status(200).json(result[0]);
    }
  });
});

// สมัครสมาชิก ผ่านแล้ว
router.post("/register", (req, res) => {
  let user: UserPostReq = req.body;
  let sql =
    "INSERT INTO `user`(`email`, `password`, `image`, `type`, `name`) VALUES (?,?,?,?,?)";
  sql = mysql.format(sql, [
    user.email,
    hashPassword(user.password),
    user.image,
    user.type,
    user.name,
  ]);
  conn.query(sql, (err, result) => {
    if (err) {
      res
        .status(401)
        .json({ affected_row: 0, last_idx: 0, result: err.sqlMessage });
    } else {
      res.status(201).json({
        affected_row: result.affectedRows,
        last_idx: result.insertId,
        result: "",
      });
    }
  });
});

// เข้าสู่ระบบ ผ่านแล้ว
router.post("/login", (req, res) => {
  let login: LoginPostReq = req.body;
  conn.query(
    "SELECT * FROM `user` WHERE email = ? AND password = ?",
    [login.email, hashPassword(login.password)],
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

// แก้ไขข้อมูลผู้ใช้ ผ่านแล้ว
router.post("/update/:uid", (req, res) => {
  const uid: number = parseInt(req.params.uid);
  let user: UpdateUserPostReq = req.body;
  let sql = "UPDATE `user` SET `email`=?,`password`=?,`name`=? WHERE `uid`= ?";
  sql = mysql.format(sql, [
    user.email,
    hashPassword(user.password),
    user.name,
    uid,
  ]);
  conn.query(sql, (err, result) => {
    if (err) {
      res.status(500).json({ affected_row: 0, result: err.sqlMessage });
    } else {
      res
        .status(200)
        .json({ affected_row: result.affectedRows, result: result });
    }
  });
});

// แก้ไขรูปข้อมูลผู้ใช้ ผ่านแล้ว
const fileUpload = new FileMiddleware();
router.post(
  "/avatar/:uid",
  fileUpload.diskLoader.single("file"),
  async (req, res) => {
    const uid: number = parseInt(req.params.uid);
    // หาข้อมูล User จาก uid
    conn.query(
      "SELECT * FROM `user` WHERE uid = ?",
      [uid],
      async (err, result) => {
        if (err) {
          res.status(500).send("Not Found User");
        } else {
          if (result[0].image == null) {
            // User ยังไม่มีรูปภาพ
            // เพิ่มรูปภาพ firebase
            const url = await firebaseUpload(req.file!);
            // เพิ่มรูปภาพ database
            let sql = "UPDATE `user` SET `image`= ? WHERE uid = ?";
            sql = mysql.format(sql, [url, uid]);
            conn.query(sql, (err, result) => {
              if (err) {
                res.status(500).json({ affected_row: 0, result: err });
              } else {
                res
                  .status(201)
                  .json({ affected_row: result.affectedRows, result: url });
              }
            });
          } else {
            // User มีรูปภาพแล้ว
            // ลบรูปภาพเดิมออกก่อนจาก firebase
            await firebaseDelete(result[0].image);
            // เพิ่มรูปภาพใหม่เข้า firebase
            const url = await firebaseUpload(req.file!);
            // แก้ไขข้อมูลรูปจาก database
            let sql = "UPDATE `user` SET `image`= ? WHERE uid = ?";
            sql = mysql.format(sql, [url, uid]);
            conn.query(sql, (err, result) => {
              if (err) {
                res.status(500).json({ affected_row: 0, result: err });
              } else {
                res
                  .status(201)
                  .json({ affected_row: result.affectedRows, result: url });
              }
            });
          }
        }
      }
    );
  }
);

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
