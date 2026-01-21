import express from 'express'
const router = express.Router()
import * as reportController from '../controller/report'
import { verifyToken } from '../middleware/verifyToken';

router.post('/report', verifyToken, reportController.createReport);
router.post('/reportMessage', verifyToken, reportController.reportMessage);


export default router
