import express from "express";
import bodyParser from "body-parser";
import mysql from "mysql";
import cors from "cors";
import { router as user } from "./controller/user";
import { router as image } from "./controller/image";
import { router as vote } from "./controller/vote";

export const conn = mysql.createPool({
  connectionLimit: 10,
  host: "202.28.34.197",
  user: "web65_64011212064",
  password: "64011212064@csmsu",
  database: "web65_64011212064",
});

export const app = express();
app.use(
  cors({
    origin: "*",
  })
);
app.use(bodyParser.text());
app.use(bodyParser.json());

app.use("/user", user);
app.use("/image", image);
app.use("/vote", vote);