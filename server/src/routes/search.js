import express from 'express'
const router = express.Router()
import * as searchController from '../controller/search'
import { verifyToken } from '../middleware/verifyToken';

router.post('/getRandomUser', verifyToken, searchController.getRandomUsers);
router.post('/searchUser', verifyToken, searchController.searchUser);
router.post('/searchPost', verifyToken, searchController.searchPost)

export default router
