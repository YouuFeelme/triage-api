import { Router } from 'express';
import { getMe, listUsers, updateUserRole } from '../controllers/users.controller';
import { authenticate, requireRole } from '../middlewares/auth';

export const usersRouter = Router();

// Every /users route needs a valid access token.
usersRouter.use(authenticate);

usersRouter.get('/me', getMe);
usersRouter.get('/', requireRole('admin'), listUsers);
usersRouter.patch('/:userId/role', requireRole('admin'), updateUserRole);
