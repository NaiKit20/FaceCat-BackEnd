import express from "express";
import mysql from "mysql";
import { conn } from "./../app";
import { LoginPostReq } from "../model/Request/LoginPostReq";
import { UserPostReq } from "../model/Request/UserPostReq";
import * as crypto from 'crypto';

export const router = express.Router();

// ใช้ crypto เพื่อเข้ารหัสผ่านของผู้ใช่
function hashPassword(password: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(password);
  return hash.digest('hex');
}

router.get("/", (req, res) => {
  res.send("user controller");
});

// สมัครสมาชิก
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
        .status(409)
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

// เข้าสู่ระบบ
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

router.post("/edit", (req, res) => {
  let login: LoginPostReq = req.body;
  conn.query(
    "SELECT * FROM `user` WHERE email = ? AND password = ?",
    [login.email, login.password],
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

