import { Router } from 'express';
import { login, logout, refresh, register } from '../controllers/auth.controller';
import { loginRateLimiter } from '../middlewares/rate-limit';

// Public routes: no access token needed (refresh and logout carry the refresh token in the body).
export const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', loginRateLimiter, login);
authRouter.post('/refresh', refresh);
authRouter.post('/logout', logout);
