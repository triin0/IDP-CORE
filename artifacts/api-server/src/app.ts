import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import router from "./routes";

const app: Express = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

const deployedDir = path.resolve(import.meta.dirname, "../../../deployed-projects");
app.use("/deployed", express.static(deployedDir));

export default app;
