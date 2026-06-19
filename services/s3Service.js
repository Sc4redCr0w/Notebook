const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

/**
 * Upload a file buffer to the configured S3 bucket
 * @param {string} key - S3 object key (path)
 * @param {Buffer} buffer - File buffer to upload
 * @param {string} mimetype - Content type of the file
 * @returns {Promise<Object>} - S3 PutObject response
 */
async function uploadFile(key, buffer, mimetype) {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
  });
  return s3Client.send(command);
}

/**
 * List prefixes (folders) under a path in the S3 bucket
 * @param {string} prefix - The parent prefix folder (default "public/")
 * @returns {Promise<string[]>} - Array of folder names
 */
async function listFolders(prefix = "public/") {
  const command = new ListObjectsV2Command({
    Bucket: process.env.AWS_BUCKET_NAME,
    Prefix: prefix,
    Delimiter: "/",
  });

  const data = await s3Client.send(command);
  
  // Extract and clean folder names
  const folders = data.CommonPrefixes?.map((folder) =>
    folder.Prefix.replace(prefix, "").replace("/", "")
  ) || [];

  return folders;
}

/**
 * List all objects under a prefix from S3, parsed into file metadata
 * @param {string} prefix
 * @returns {Promise<Object[]>}
 */
async function listAllFiles(prefix = "public/") {
  const command = new ListObjectsV2Command({
    Bucket: process.env.AWS_BUCKET_NAME,
    Prefix: prefix,
  });

  const data = await s3Client.send(command);
  
  // Filter out any directory placeholder objects (ending with '/')
  const items = (data.Contents || [])
    .filter((obj) => !obj.Key.endsWith("/"))
    .map((obj) => {
      const key = obj.Key;
      const parts = key.split("/");
      let folder = "unknown";
      let filename = key;
      let uploadedAt = obj.LastModified ? obj.LastModified.toISOString() : new Date().toISOString();

      if (parts.length >= 3) {
        folder = parts[1];
        const filePart = parts[2];
        const hyphenIdx = filePart.indexOf("-");
        if (hyphenIdx !== -1) {
          const timestampStr = filePart.substring(0, hyphenIdx);
          const parsedTime = Number(timestampStr);
          if (!isNaN(parsedTime)) {
            uploadedAt = new Date(parsedTime).toISOString();
          }
          filename = filePart.substring(hyphenIdx + 1);
        } else {
          filename = filePart;
        }
      }

      return {
        filename,
        folder,
        uploadedBy: "unknown", // Fallback value when scanning is not permitted
        uploadedAt,
        s3Key: key,
      };
    });

  return items;
}

/**
 * Downloads a file from the S3 bucket as a binary buffer
 * @param {string} key - S3 object key
 * @returns {Promise<Buffer>} - File buffer
 */
async function downloadFile(key) {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);

  // Accumulate response body readable stream into a single Buffer
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

module.exports = {
  s3Client,
  uploadFile,
  listFolders,
  listAllFiles,
  downloadFile,
};

