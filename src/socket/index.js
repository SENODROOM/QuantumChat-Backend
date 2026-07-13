import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export function attachSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Missing auth token'));

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.id);
      if (!user) return next(new Error('User not found'));

      socket.userId = user._id.toString();
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(socket.userId);

    socket.on('disconnect', () => {
      socket.leave(socket.userId);
    });
  });
}
