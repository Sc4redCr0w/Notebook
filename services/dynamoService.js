const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

const dynamo = DynamoDBDocumentClient.from(client);

/**
 * Fetch a user by userId from the 'users' table
 * @param {string} userId
 * @returns {Promise<Object|null>} - User item or null
 */
async function getUser(userId) {
  const command = new GetCommand({
    TableName: "users",
    Key: {
      userId,
    },
  });
  const response = await dynamo.send(command);
  return response.Item || null;
}

/**
 * Create a new user in the 'users' table
 * @param {string} userId
 * @param {string} passwordHash
 * @returns {Promise<Object>} - The created user object
 */
async function createUser(userId, passwordHash) {
  const item = {
    userId,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  const command = new PutCommand({
    TableName: "users",
    Item: item,
  });

  await dynamo.send(command);
  return item;
}

/**
 * Fetch a file by its SHA256 hash from 'notebook-files'
 * @param {string} hash
 * @returns {Promise<Object|null>} - File item or null
 */
async function getFileByHash(hash) {
  const command = new GetCommand({
    TableName: "notebook-files",
    Key: {
      hash,
    },
  });
  const response = await dynamo.send(command);
  return response.Item || null;
}

/**
 * Asynchronously runs indexing inline as a fallback for SQS permission limits
 */
async function triggerInlineIndexing(s3Key, hash) {
  console.log(`[Inline Indexing] Start background indexing for Key: ${s3Key}`);
  try {
    const s3Service = require("./s3Service");
    const embeddingService = require("./embeddingService");
    const chromaService = require("./chromaService");
    const pdfExtractor = require("../utils/pdfExtractor");
    const chunkText = require("../utils/chunkText");

    // 1. Set to PROCESSING
    await updateIndexStatus(hash, "PROCESSING");

    // 2. Download from S3
    const buffer = await s3Service.downloadFile(s3Key);

    // 3. Extract text
    const text = await pdfExtractor.extractText(buffer);
    if (!text || text.trim().length === 0) {
      throw new Error("Text content extracted from PDF is empty");
    }

    // 4. Chunk text
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      throw new Error("No text chunks created for indexing");
    }

    // 5. Generate embeddings
    const embeddings = [];
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await embeddingService.generateEmbedding(chunks[i]);
      embeddings.push(embedding);
    }

    // 6. Fetch uploader and folder meta
    const fileMetadata = await getFileByHash(hash);
    const filename = fileMetadata ? fileMetadata.filename : "unknown.pdf";
    const uploadedBy = fileMetadata ? fileMetadata.uploadedBy : "unknown";
    const folder = fileMetadata ? fileMetadata.folder : (s3Key.split("/")[1] || "default");

    // 7. Store in Chroma
    await chromaService.addChunksToCollection(hash, filename, uploadedBy, folder, chunks, embeddings);

    // 8. Set to INDEXED
    await updateIndexStatus(hash, "INDEXED");
    console.log(`[Inline Indexing] Completed indexing for hash: ${hash}`);
  } catch (error) {
    console.error(`[Inline Indexing Error] Failed for ${s3Key}:`, error.message);
    try {
      await updateIndexStatus(hash, "FAILED");
    } catch (dbErr) {
      console.error("[Inline Indexing Error] Failed to update status to FAILED in DB:", dbErr.message);
    }
  }
}

/**
 * Save notebook file metadata in the 'notebook-files' table
 * @param {Object} item - Metadata item (hash, filename, folder, uploadedBy, uploadedAt, s3Key)
 * @returns {Promise<Object>} - The saved item
 */
async function saveFileMetadata(item) {
  const itemWithStatus = {
    indexStatus: "PENDING",
    ...item
  };
  const command = new PutCommand({
    TableName: "notebook-files",
    Item: itemWithStatus,
  });
  await dynamo.send(command);

  // Trigger inline indexing in the background asynchronously
  setImmediate(() => {
    triggerInlineIndexing(item.s3Key, item.hash);
  });

  return itemWithStatus;
}

/**
 * Retrieve all metadata entries from 'notebook-files' table
 * @returns {Promise<Object[]>} - Array of metadata objects
 */
async function getAllFiles() {
  const command = new ScanCommand({
    TableName: "notebook-files",
  });
  const response = await dynamo.send(command);
  return response.Items || [];
}

async function updateIndexStatus(hash, status) {
  // Fetch existing item to preserve other fields
  const existing = await getFileByHash(hash);
  
  const updatedItem = {
    ...existing,
    hash, // Ensure hash partition key is present
    indexStatus: status,
  };

  const command = new PutCommand({
    TableName: "notebook-files",
    Item: updatedItem,
  });
  return dynamo.send(command);
}

module.exports = {
  getUser,
  createUser,
  getFileByHash,
  saveFileMetadata,
  getAllFiles,
  updateIndexStatus,
};
