import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import router from "./routes";

const currentDir =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  const frontendDir = path.resolve(currentDir, "../../idp-frontend/dist/public");

  if (fs.existsSync(frontendDir)) {
    app.use(express.static(frontendDir));

    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(frontendDir, "index.html"));
    });
  }
}

export default app;
