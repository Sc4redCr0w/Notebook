const dynamoService = require("../services/dynamoService");
const s3Service = require("../services/s3Service");

/**
 * Get all uploaded files list
 */
async function getFiles(req, res) {
  try {
    try {
      const files = await dynamoService.getAllFiles();
      
      // Map files to output the requested format
      const formattedFiles = files.map((file) => ({
        filename: file.filename,
        folder: file.folder,
        uploadedBy: file.uploadedBy,
        uploadedAt: file.uploadedAt,
        s3Key: file.s3Key,
      }));

      return res.json(formattedFiles);
    } catch (dbError) {
      // If access is denied for scan on DynamoDB, fall back to listing objects via S3
      if (dbError.name === "AccessDeniedException" || dbError.code === "AccessDeniedException" || dbError.message.includes("is not authorized to perform")) {
        console.warn("DynamoDB Scan permission denied. Falling back to S3 object listing.");
        const fallbackFiles = await s3Service.listAllFiles("public/");
        return res.json(fallbackFiles);
      }
      throw dbError; // Rethrow other errors
    }
  } catch (error) {
    console.error("Error retrieving files list:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch files list",
    });
  }
}

module.exports = {
  getFiles,
};
