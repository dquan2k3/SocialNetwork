import express from 'express';
import * as conversationController from '../controller/conversation';
import { verifyToken } from '../middleware/verifyToken';
import multer from 'multer';

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// Các route cũ
router.get('/incomeUser/:userId', verifyToken, conversationController.getIncomeUser);
router.get('/incomeGroup/:conversationId', verifyToken, conversationController.getIncomeGroup);


router.post('/getConversationDetail', verifyToken, conversationController.getConversationDetail);
router.post('/loadMessage', verifyToken, conversationController.loadMessage);
router.get('/getMessageList', verifyToken, conversationController.getMessageList);
router.get('/friendList', verifyToken, conversationController.getFriendList);

router.get('/getGroupUser/:conversationId', verifyToken, conversationController.getGroupUser);

//mult
router.post('/createGroup', verifyToken, upload.single('avatar'), conversationController.createGroupConversation);

router.get('/getMessageList/:conversationId', verifyToken, conversationController.getMessageList);

router.post('/updateMessagePriority', verifyToken, conversationController.updateMessagePriority);
router.post('/updateGroupMessagePriority', verifyToken, conversationController.updateGroupMessagePriority);
router.get('/getNotificationPriorities', verifyToken, conversationController.getNotificationPriorities);

router.post('/disbandGroupConversation', verifyToken, conversationController.disbandGroupConversation);
router.post('/leaveGroupConversation', verifyToken, conversationController.leaveGroupConversation);

router.get('/getOnlineUser', verifyToken, conversationController.getOnlineUser);

router.post('/selfChat', verifyToken, conversationController.selfChat);
router.get('/getSelfChat', verifyToken, conversationController.getSelfChats);
router.post('/summaryGroupConversation', verifyToken, conversationController.summaryGroupConversation);

router.get('/loadInfoGroupConversation', verifyToken, conversationController.loadInfoGroupConversation);
router.post('/applyJoinGroupConversation', verifyToken, conversationController.applyJoinGroupConversation);
router.post('/cancelApplyJoinGroupConversation', verifyToken, conversationController.cancelApplyJoinGroupConversation);

router.get('/loadGroupManager', verifyToken, conversationController.loadGroupManager);
router.post('/changeNeedApproval', verifyToken, conversationController.changeNeedApproval);
router.post('/declineUser', verifyToken, conversationController.declineUser);
router.post('/kickUser', verifyToken, conversationController.kickUser);
router.post('/approveUser', verifyToken, conversationController.approveUser);
router.post('/transferOwner', verifyToken, conversationController.transferOwner);









export default router;
