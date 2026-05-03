import express from 'express';
import * as authController from '../controller/auth'
import { verifyToken } from '../middleware/verifyToken'

const router = express.Router();

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/logout', authController.logout);
router.post('/checklogin', verifyToken, authController.checklogin);
router.post('/changepassword', authController.changePassword);


export default router;