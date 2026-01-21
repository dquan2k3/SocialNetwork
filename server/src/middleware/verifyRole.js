import jwt from "jsonwebtoken";

export const verifyRole = (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Missing token",
      code: "TOKEN_MISSING",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Lưu user info vào req để controller dùng
    console.log(decoded)
    if (!decoded.role || decoded.role !== "Admin") {
      return res.status(403).json({
        success: false,
        message: "Not Permission",
        code: "NOT_PERMISSION",
      });
    }
    next(); 
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token",
      code: "TOKEN_INVALID",
    });
  }
};