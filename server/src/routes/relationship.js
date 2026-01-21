import express from 'express'
const router = express.Router()
import * as relationshipsController from '../controller/relationship'
import { verifyToken } from '../middleware/verifyToken';

router.post('/sendFriendRequest', verifyToken, relationshipsController.sendFriendRequest);
router.get('/getRelationship', verifyToken, relationshipsController.getRelationship);
router.post('/cancelRelationship', verifyToken, relationshipsController.cancelRelationship);
router.post('/acceptFriendRequest', verifyToken, relationshipsController.acceptFriendRequest);
router.post('/rejectFriendRequest', verifyToken, relationshipsController.rejectFriendRequest);
router.post('/blockUser', verifyToken, relationshipsController.blockUser);


router.get('/getFriend', verifyToken, relationshipsController.getFriend);
router.get('/getUserFriend', verifyToken, relationshipsController.getUserFriend);



export default router