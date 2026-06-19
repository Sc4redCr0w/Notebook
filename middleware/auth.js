const jwt = require("jsonwebtoken");

/**
 * Express middleware to verify JWT authorization headers
 */
module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Authorization header missing or invalid format. Expected 'Bearer <token>'.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach userId info to request object
    req.user = {
      userId: decoded.userId,
    };
    
    next();
  } catch (error) {
    console.error("JWT verification failed:", error.message);
    return res.status(401).json({
      success: false,
      error: "Invalid or expired authorization token.",
    });
  }
};
