import jwt from "jsonwebtoken";
import { accountModel } from "../model/auth";
const redis = require('../config/redis')

export const verifyToken = async (req, res, next) => {
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
    if (!decoded?.id) {
      return res.status(403).json({
        success: false,
        message: "Token missing user id",
        code: "TOKEN_INVALID",
      });
    }
    // Check tokenVersion in Redis first
    let tokenVersion;
    try {
      tokenVersion = await redis.get(`tokenVersion:${decoded.id}`);
      if (tokenVersion !== null) {
        console.log(`[verifyToken] Redis found tokenVersion for userId=${decoded.id}: ${tokenVersion}`);
        if (tokenVersion != decoded.tokenVersion) {
          return res.status(403).json({
            success: false,
            message: "Token version mismatch",
            code: "TOKEN_INVALIDATED",
          });
        }
        req.user = decoded;
        return next();
      } else {
        console.log(`[verifyToken] Redis tokenVersion not found for userId=${decoded.id}. Will query DB.`);
      }
    } catch (errRedis) {
      console.error(`[verifyToken] Redis error for userId=${decoded.id}:`, errRedis);
      // If Redis fails, fallback to DB
    }

    // If not found in redis, query DB
    const userInDb = await accountModel.findById(decoded.id).select("tokenVersion");
    if (!userInDb) {
      return res.status(403).json({
        success: false,
        message: "User not found for token",
        code: "TOKEN_INVALID",
      });
    }
    if (userInDb.tokenVersion != decoded.tokenVersion) {
      return res.status(403).json({
        success: false,
        message: "Token version mismatch",
        code: "TOKEN_INVALIDATED",
      });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token",
      code: "TOKEN_INVALID",
    });
  }
};