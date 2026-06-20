const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require("@aws-sdk/client-sqs");
const path = require("path");
const crypto = require("crypto");

// Ensure environment variables are loaded relative to worker.js
require("dotenv").config({ path: path.join(__dirname, ".env") });

const s3Service = require("./services/s3Service");
const dynamoService = require("./services/dynamoService");
const embeddingService = require("./services/embeddingService");
const chromaService = require("./services/chromaService");
const pdfExtractor = require("./utils/pdfExtractor");
const chunkText = require("./utils/chunkText");

// Initialize AWS SQS Client
const sqs = new SQSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

const QUEUE_URL = process.env.SQS_QUEUE_URL;

/**
 * Processes a single SQS message
 * @param {Object} msg - SQS Message object
 */
async function processMessage(msg) {
  let hash = null;
  try {
    const body = JSON.parse(msg.Body);
    
    // Handle potential SNS notification wrapper
    const s3Event = body.Message ? JSON.parse(body.Message) : body;

    if (!s3Event.Records || s3Event.Records.length === 0) {
      console.log("No records found in message, deleting message...");
      await deleteMessage(msg.ReceiptHandle);
      return;
    }

    for (const record of s3Event.Records) {
      // Decode S3 key (spaces are replaced by + in S3 event keys sometimes)
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
      console.log(`\n----------------------------------------\n[Worker] Processing S3 Key: ${key}`);

      // 1. Download PDF from S3
      console.log("[Worker] Downloading file from S3...");
      const pdfBuffer = await s3Service.downloadFile(key);

      // 2. Generate SHA256 hash of PDF buffer
      hash = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
      console.log(`[Worker] Calculated SHA256 hash: ${hash}`);

      // 2b. Retrieve metadata and skip if already indexed
      const fileMetadata = await dynamoService.getFileByHash(hash);
      if (fileMetadata && fileMetadata.indexStatus === "INDEXED") {
        console.log(`[Worker] File hash ${hash} is already INDEXED. Skipping vector processing.`);
        continue;
      }

      // 3. Mark DynamoDB indexStatus = PROCESSING
      await dynamoService.updateIndexStatus(hash, "PROCESSING");
      console.log(`[Worker] Marked status: PROCESSING`);

      const filename = fileMetadata ? fileMetadata.filename : path.basename(key);
      const uploadedBy = fileMetadata ? fileMetadata.uploadedBy : "unknown";
      const folder = fileMetadata ? fileMetadata.folder : (key.split("/")[1] || "default");

      // 5. Extract PDF text
      console.log("[Worker] Extracting text from PDF...");
      const text = await pdfExtractor.extractText(pdfBuffer);
      if (!text || text.trim().length === 0) {
        throw new Error("Extracted text from PDF is empty");
      }

      // 6. Chunk text
      console.log("[Worker] Chunking text content...");
      const chunks = chunkText(text);
      console.log(`[Worker] Generated ${chunks.length} chunks`);

      if (chunks.length === 0) {
        throw new Error("No text chunks generated for indexing");
      }

      // 7. Generate embeddings for chunks (sequentially to avoid rate limits)
      console.log("[Worker] Generating embeddings with embedding service...");
      const embeddings = [];
      for (let i = 0; i < chunks.length; i++) {
        console.log(`[Worker] Generating embedding: chunk ${i + 1}/${chunks.length}`);
        const embedding = await embeddingService.generateEmbedding(chunks[i]);
        embeddings.push(embedding);
      }

      // 8. Store vectors in ChromaDB
      console.log("[Worker] Storing vector indices in ChromaDB...");
      await chromaService.addChunksToCollection(hash, filename, uploadedBy, folder, chunks, embeddings);

      // 9. Mark DynamoDB indexStatus = INDEXED
      await dynamoService.updateIndexStatus(hash, "INDEXED");
      console.log(`[Worker] Successfully indexed file: ${filename}`);
    }

    // 10. Delete SQS message
    await deleteMessage(msg.ReceiptHandle);
  } catch (error) {
    console.error(`[Worker Error] Failed to process message:`, error.message);
    
    // Mark indexStatus as FAILED in DynamoDB if the hash was generated
    if (hash) {
      try {
        await dynamoService.updateIndexStatus(hash, "FAILED");
        console.log(`[Worker] Marked status: FAILED in DynamoDB`);
      } catch (dbError) {
        console.error("[Worker] Failed to update status to FAILED in DynamoDB:", dbError.message);
      }
    }

    // Delete message to avoid poison pill retries on parsing failures
    try {
      await deleteMessage(msg.ReceiptHandle);
    } catch (delError) {
      console.error("[Worker] Failed to delete failed SQS message:", delError.message);
    }
  }
}

/**
 * Delete SQS message from the queue
 */
async function deleteMessage(receiptHandle) {
  const command = new DeleteMessageCommand({
    QueueUrl: QUEUE_URL,
    ReceiptHandle: receiptHandle,
  });
  await sqs.send(command);
  console.log("[Worker] SQS message deleted successfully");
}

/**
 * Start the long polling loop
 */
async function run() {
  console.log("====================================================");
  console.log(`[Worker] Starting PDF indexing worker...`);
  console.log(`[Worker] Target Queue: ${QUEUE_URL}`);
  console.log("====================================================");

  while (true) {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20, // Long polling
      });

      const response = await sqs.send(command);

      if (response.Messages && response.Messages.length > 0) {
        for (const msg of response.Messages) {
          await processMessage(msg);
        }
      } else {
        // Log heartbeat info
        console.log(`[Worker Heartbeat] Polling... (No messages in queue)`);
      }
    } catch (error) {
      console.error("[Worker Polling Error] Loop error:", error.message);
      // Wait for 5 seconds before attempting to reconnect/poll
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Start worker execution
run();
