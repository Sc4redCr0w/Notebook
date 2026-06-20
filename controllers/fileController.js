const dynamoService = require("../services/dynamoService");
const s3Service = require("../services/s3Service");

/**
 * Get all uploaded files list
 */
async function getFiles(req, res) {
  try {
    try {
      const files = await dynamoService.getAllFiles();
      
      // Filter out files that are private and not owned by the current user
      const allowedFiles = files.filter((file) => {
        const isFilePublic = file.isPublic !== false; // Default to public for legacy files
        const isOwner = file.uploadedBy === req.user.userId;
        return isFilePublic || isOwner;
      });

      // Map files to output the requested format
      const formattedFiles = allowedFiles.map((file) => ({
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
        const publicFiles = await s3Service.listAllFiles("public/");
        let privateFiles = [];
        try {
          privateFiles = await s3Service.listAllFiles(`private/${req.user.userId}/`);
        } catch (s3Error) {
          console.warn(`S3 listing failed for private/${req.user.userId}/:`, s3Error.message);
        }
        return res.json([...publicFiles, ...privateFiles]);
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
