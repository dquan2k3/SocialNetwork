import express from 'express';
const router = express.Router();
import * as notifyController from '../controller/notificationApi';
import { verifyToken } from '../middleware/verifyToken';


router.get('/getNotifyList', verifyToken, notifyController.getNotifyList);

router.get('/getMyAction', verifyToken, notifyController.getMyAction);

export default router;
