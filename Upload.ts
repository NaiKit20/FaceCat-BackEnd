import express  from "express";
import multer from "multer";
import path from "path";
import mysql from "mysql";
import { conn } from "../dbconnet";
//router = ตัวจัดการเส้นทาง
export const router = express.Router();


const firebaseConfig = {
    apiKey: "AIzaSyBhuVgmc1U5l8WvDfMtZUUONxkNp3QtFRc",
    authDomain: "foodrate-101roi-et.firebaseapp.com",
    projectId: "foodrate-101roi-et",
    storageBucket: "foodrate-101roi-et.appspot.com",
    messagingSenderId: "932396135284",
    appId: "1:932396135284:web:b4d8da7bc3ec3f57eeb221",
    measurementId: "G-YKWBWP84N6"
  };

import {initializeApp} from "firebase/app";
import { getStorage,ref,uploadBytesResumable,getDownloadURL} from "firebase/storage"
//Connect to fire base
initializeApp(firebaseConfig);
//Connect to Storage
const storage = getStorage();


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

//Post /upload + file 
const fileupload = new FileMiddleware();
router.post("/",fileupload.diskLoader.single("file"),async(req,res)=>{
    //Upload to firebase storage
    const filename = Math.round(Math.random() * 1000)+".png";
    // Define locations to be saved on storag
    const storageRef = ref(storage,"/images/"+filename);
    // define file detail
    const metaData = {contentType : req.file!.mimetype};
    // Start upload
    const snapshost = await uploadBytesResumable(storageRef,req.file!.buffer, metaData);
    //Get url image from storage
    const url = await getDownloadURL(snapshost.ref);
    let sql =
      "INSERT INTO Picture`(url`,`point`) VALUES (?,0)";
    sql = mysql.format(sql, [
        url
    ]);

    conn.query(sql, (err, result) => {
      if (err) throw err;

      res.status(201).json({
        affected_row: result.affectedRows,
        last_idx: result.insertId,
      });
    });
  
});