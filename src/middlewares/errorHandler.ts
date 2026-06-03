import { NextFunction, Request, Response } from "express";

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ erro: err.message });
    return;
  }

  if (err.name === "PrismaClientKnownRequestError") {
    res.status(409).json({ erro: "Conflito de dados no banco" });
    return;
  }

  console.error("Erro inesperado:", err);
  res.status(500).json({
    erro: process.env.NODE_ENV === "development" ? err.message : "Erro interno do servidor",
  });
}
