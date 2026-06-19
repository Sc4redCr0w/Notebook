require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");

const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");

const {
  DynamoDBClient,
} = require("@aws-sdk/client-dynamodb");

const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");

const app = express();

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
});

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ID,
      secretAccessKey: process.env.AWS_SECRET_KEY,
    },
  })
);

app.get("/folders", async (req, res) => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.AWS_BUCKET_NAME,
      Prefix: "public/",
      Delimiter: "/",
    });

    const data = await s3.send(command);

    const folders =
      data.CommonPrefixes?.map((folder) =>
        folder.Prefix.replace("public/", "").replace("/", "")
      ) || [];

    res.json(folders);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch folders",
    });
  }
});

app.post(
  "/upload",
  upload.single("pdf"),
  async (req, res) => {
    try {
      const file = req.file;
      const folder = req.body.folder;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded",
        });
      }

      const hash = crypto
        .createHash("sha256")
        .update(file.buffer)
        .digest("hex");

      const existing = await dynamo.send(
        new GetCommand({
          TableName: "notebook-files",
          Key: {
            hash,
          },
        })
      );

      if (existing.Item) {
        return res.status(409).json({
          success: false,
          error: "Duplicate PDF already exists",
          existingFile: existing.Item.filename,
          hash,
        });
      }

      const key =
        `public/${folder}/${Date.now()}-${file.originalname}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
      );

      await dynamo.send(
        new PutCommand({
          TableName: "notebook-files",
          Item: {
            hash,
            filename: file.originalname,
            s3Key: key,
            uploadedAt: new Date().toISOString(),
          },
        })
      );

      res.json({
        success: true,
        message: "Upload successful",
        hash,
        path: key,
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        success: false,
        error: error.message,
      });

    }
  }
);

app.get("/", (req, res) => {
  res.send("Notebook Backend Running");
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});