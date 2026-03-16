import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import router from "./routes";

const app: Express = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

const deployedDir = path.resolve(import.meta.dirname, "../../../deployed-projects");
app.use("/deployed", express.static(deployedDir));

if (process.env.NODE_ENV === "production") {
  const frontendDir = path.resolve(import.meta.dirname, "../../idp-frontend/dist/public");

  if (fs.existsSync(frontendDir)) {
    app.use(express.static(frontendDir));

    app.get("*", (_req, res) => {
      res.sendFile(path.join(frontendDir, "index.html"));
    });
  }
}

export default app;
