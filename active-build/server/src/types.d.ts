declare global {
  namespace Express {
    interface Request {
      userId?: number;
      userRole?: 'user' | 'admin';
    }
  }
}

export {};
