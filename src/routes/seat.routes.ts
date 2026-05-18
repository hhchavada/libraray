import { Router } from 'express';
import { seatController } from '../controllers/seat.controller';
import { protect } from '../middlewares/auth.middleware';

const router = Router();

router.use(protect);

router.get('/:libraryId/all', seatController.getAllSeats);
router.get('/:libraryId/available', seatController.getAvailableSeats);
router.get('/:libraryId/by-shift', seatController.getSeatsByShift);
router.post('/lock/:seatId', seatController.lockSeat);
router.post('/release/:seatId', seatController.releaseSeat);

export default router;
