import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import type { JwtPayload } from "../controllers/auth.controller";
import { AppError } from "./errorHandler";

declare global {
  namespace Express {
    interface Request {
      usuario?: JwtPayload;
    }
  }
}

export function autenticar(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AppError("Token nao fornecido", 401);
    }

    const [tipo, token] = authHeader.split(" ");

    if (tipo !== "Bearer" || !token) {
      throw new AppError("Formato de token invalido. Use: Bearer <token>", 401);
    }

    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;

    if (payload.tipo !== "access") {
      throw new AppError("Token invalido", 401);
    }

    req.usuario = payload;
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "TokenExpiredError") {
        next(new AppError("Token expirado. Faca login novamente.", 401));
        return;
      }

      if (error.name === "JsonWebTokenError") {
        next(new AppError("Token invalido", 401));
        return;
      }
    }

    next(error);
  }
}
