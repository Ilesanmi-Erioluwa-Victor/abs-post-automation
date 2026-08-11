import express from "express";
import { env } from "./config/env";
import { connectDB } from "./db/connect";
import batchRouter from "./routes/batch";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/", batchRouter);

const port = env.port;

app.listen(port, () => {
  console.log(`[idiom-vocab-bot] listening on http://localhost:${port} (${env.nodeEnv})`);
});

connectDB()
  .then(() => {
    console.log("[idiom-vocab-bot] MongoDB connected");
  })
  .catch((error) => {
    console.error(
      "[idiom-vocab-bot] MongoDB connection failed:",
      error instanceof Error ? error.message : error
    );
    retryConnect();
  });

function retryConnect(): void {
  setTimeout(() => {
    connectDB()
      .then(() => console.log("[idiom-vocab-bot] MongoDB connected"))
      .catch((error) => {
        console.error(
          "[idiom-vocab-bot] MongoDB connection retry failed:",
          error instanceof Error ? error.message : error
        );
        retryConnect();
      });
  }, 30_000);
}
