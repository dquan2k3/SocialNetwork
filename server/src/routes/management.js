import express from 'express'
const router = express.Router()
import * as managementController from '../controller/management'
import { verifyToken } from '../middleware/verifyToken';
import { verifyRole } from '../middleware/verifyRole';

router.get('/loadDashboard', verifyRole, verifyToken, managementController.loadDashboard);
router.get('/getRecentDashboard', verifyRole, verifyToken, managementController.getRecentDashboard);
router.get('/loadUser', verifyRole, verifyToken, managementController.loadUser);
router.get('/loadReportPost', verifyRole, verifyToken, managementController.loadReportPost);
router.get('/searchReportPost', verifyRole, verifyToken, managementController.searchReportPost);
router.post('/banUserAndRemovePost', verifyRole, verifyToken, managementController.banUserAndRemovePost);
router.post('/banUserDueToMessage', verifyRole, verifyToken, managementController.banUserDueToMessage);
router.post('/banUser', verifyRole, verifyToken, managementController.banUser);
router.get('/loadReportComment', verifyRole, verifyToken, managementController.loadReportComment);

router.post('/removePostReport', verifyRole, verifyToken, managementController.removePostReport);
router.post('/removeCommentReport', verifyRole, verifyToken, managementController.removeCommentReport);
router.post('/banUserAndRemoveComment', verifyRole, verifyToken, managementController.banUserAndRemoveComment);
router.get('/loadUserReport', verifyRole, verifyToken, managementController.loadUserReports);
router.post('/banUserDueToProfile', verifyRole, verifyToken, managementController.banUserDueToProfile);

router.post('/banUserWithReason', verifyRole, verifyToken, managementController.banUserWithReason);
router.get('/loadReportMessage', verifyRole, verifyToken, managementController.loadReportMessage);
router.delete('/deleteReport', verifyRole, verifyToken, managementController.deleteReport);
router.get('/loadReportedMessage', verifyRole, verifyToken, managementController.loadReportedMessage);

router.post('/removeRoomChat', verifyRole, verifyToken, managementController.removeRoomChat);

//router.delete('/deleteReport', verifyRole, verifyToken, managementController.deleteReport);

export default router
