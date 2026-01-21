import express from 'express';
import * as profileController from '../controller/profile';
import { verifyToken } from '../middleware/verifyToken';

const router = express.Router();

router.post('/changeUsername', verifyToken, profileController.changeUsername);
router.post('/changeName', verifyToken, profileController.changeName);
router.post('/changeLiving', verifyToken, profileController.changeLiving);
router.post('/changeHometown', verifyToken, profileController.changeHometown);
router.post('/changeBirthDay', verifyToken, profileController.changeBirthDay);
router.post('/changeSchool', verifyToken, profileController.changeSchool);
router.post('/getInfo', verifyToken, profileController.getInfo);
router.post('/getProfile', verifyToken, profileController.getProfile);
router.post('/getMyProfile', verifyToken, profileController.getMyProfile);



// -------- Event Routes --------
router.post('/addEvent', verifyToken, profileController.addEvent);
router.post('/updateEvent', verifyToken, profileController.updateEvent);
router.post('/deleteEvent', verifyToken, profileController.deleteEvent);
router.post('/getEvent', verifyToken, profileController.getEvent);

// -------- Contact Routes --------
router.post('/changeEmailContact', verifyToken, profileController.changeEmailContact);
router.post('/changePhoneContact', verifyToken, profileController.changePhoneContact);
router.post('/changeWebsiteContact', verifyToken, profileController.changeWebsiteContact);
router.post('/getContact', verifyToken, profileController.getContact);

// --------- Add getUserProfile route (api/profile.api.ts 137-141) --------------
router.post('/getUserProfile', verifyToken, profileController.getUserProfile); // No verifyToken, public profile

export default router;
