import express from 'express'
const router = express.Router()
import * as bioController from '../controller/bio'
import multer from 'multer'
import { verifyToken } from '../middleware/verifyToken'

const upload = multer({ storage: multer.memoryStorage() })

router.post(
  '/changeBio',
  upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
  ]),
  verifyToken,
  bioController.changeBio
)

router.post('/getBio', verifyToken, bioController.getBio);
router.post('/getBioFriendAvatar', verifyToken,  bioController.getBioFriendAvatar);
router.post('/getcoverhome', verifyToken, bioController.getCoverHome);


export default router