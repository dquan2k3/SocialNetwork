import express from 'express'
const router = express.Router()
import * as postController from '../controller/post'
import multer from 'multer'
import { verifyToken } from '../middleware/verifyToken';

const upload = multer({ storage: multer.memoryStorage() })

router.post(
  '/uploadPost',
  verifyToken,
  upload.array('files'), // nhận nhiều file từ field 'files'
  postController.uploadPost
)

router.get('/getProfilePosts', verifyToken, postController.getProfilePosts)
router.get('/homePosts', verifyToken, postController.getAllPosts)
router.get('/singlePost', verifyToken, postController.getSinglePost)

router.post('/getImage', verifyToken, postController.getImage)
router.post('/getVideo', verifyToken, postController.getVideo)
router.post('/getMedia', verifyToken, postController.getMedia)


router.post('/reactPost', verifyToken, postController.reactPost)
router.post('/commentPost', verifyToken, postController.commentPost)
router.delete('/deleteComment', verifyToken, postController.deleteComment)

router.get('/loadComment', verifyToken, postController.loadComment)
router.get('/loadCountReact', verifyToken, postController.loadCountReact)
router.post('/sharePost', verifyToken, postController.sharePost)

router.post('/searchPost', verifyToken, postController.searchPost)

router.post('/reportPost', verifyToken, postController.reportPost)
router.post('/reportComment', verifyToken, postController.reportComment)
router.delete('/deletePost', verifyToken, postController.deletePost)

export default router