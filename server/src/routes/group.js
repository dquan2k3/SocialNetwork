import express from 'express';
import * as groupController from '../controller/group';
import { verifyToken } from '../middleware/verifyToken';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.get('/test', verifyToken, groupController.test);
router.post('/createGroup', verifyToken, groupController.createGroup);
router.get('/getMyGroups', verifyToken, groupController.getMyGroups);
router.post(
  '/updateCover',
  verifyToken,
  upload.single('cover'), // "cover" là tên field chứa ảnh
  groupController.updateGroupCover
);
router.post('/updateSetting', verifyToken, groupController.updateGroupSetting);
router.get('/getSetting', verifyToken, groupController.getGroupSetting);
router.get('/searchGroup', verifyToken, groupController.searchGroup);
router.post('/joinGroup', verifyToken, groupController.joinGroup);
router.post('/cancelJoinGroup', verifyToken, groupController.cancelJoinGroup);
router.post('/leaveGroup', verifyToken, groupController.leaveGroup);
router.get('/loadMember', verifyToken, groupController.loadMember);
router.post('/acceptMember', verifyToken, groupController.acceptMember);
router.post('/rejectMember', verifyToken, groupController.rejectMember);
router.post('/banMember', verifyToken, groupController.banMember);
router.get('/groupPosts', verifyToken, groupController.getGroupPosts);
router.get('/getGroupMedia', verifyToken, groupController.getGroupMedia);
router.post('/transferGroupOwner', verifyToken, groupController.transferGroupOwner);




// Thêm API uploadGroupPost cho group
router.post(
  '/uploadGroupPost',
  verifyToken,
  upload.array('files'),
  groupController.uploadGroupPost
);

export default router;
