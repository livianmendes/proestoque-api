import cors from "cors";
import express from "express";
import { errorHandler } from "./middlewares/errorHandler";
import { router } from "./routes";

const app = express();

app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV === "development") {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

app.get("/", (_req, res) => {
  res.json({ status: "ok", app: "ProEstoque API", versao: "1.0.0" });
});

app.use("/api", router);
app.use(errorHandler);

export { app };
