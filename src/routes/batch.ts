import { Router } from "express";
import { randomUUID } from "crypto";
import { env } from "../config/env";
import { waitForDB } from "../db/connect";
import { runBatch } from "../orchestrator/runBatch";
import type { BatchSummary } from "../orchestrator/runBatch";
import type { BatchSlot } from "../db/models/Post";

const router = Router();

const SLOTS: BatchSlot[] = ["morning", "afternoon", "night"];

interface BatchRecord {
  status: "running" | "completed" | "failed";
  summary: BatchSummary | null;
  error: string | null;
}

const statusStore = new Map<string, BatchRecord>();

router.post("/run-batch", (req, res) => {
  const authHeader = req.headers.authorization ?? "";
  if (authHeader !== `Bearer ${env.triggerAuthToken}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const count = Number(req.body?.count);
  const slot = req.body?.slot;

  if (!Number.isInteger(count) || count < 1 || count > 20) {
    res
      .status(400)
      .json({ error: "count must be an integer between 1 and 20." });
    return;
  }
  if (!SLOTS.includes(slot)) {
    res
      .status(400)
      .json({ error: "slot must be one of: morning, afternoon, night." });
    return;
  }

  const batchId = randomUUID();
  statusStore.set(batchId, { status: "running", summary: null, error: null });

  res.status(202).json({ batchId, status: "accepted" });

  runBatchAsync(count, slot as BatchSlot, batchId)
    .then((summary) => {
      statusStore.set(batchId, { status: "completed", summary, error: null });
    })
    .catch((error) => {
      statusStore.set(batchId, {
        status: "failed",
        summary: null,
        error: error instanceof Error ? error.message : String(error),
      });
    });
});

async function runBatchAsync(
  count: number,
  slot: BatchSlot,
  batchId: string
): Promise<BatchSummary> {
  try {
    await waitForDB();
  } catch (error) {
    statusStore.set(batchId, {
      status: "failed",
      summary: null,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
  return runBatch(count, slot);
}

router.get("/batch-status/:id", (req, res) => {
  const record = statusStore.get(req.params.id);
  if (!record) {
    res.status(404).json({ error: "batch not found" });
    return;
  }
  res.json(record);
});

export default router;
