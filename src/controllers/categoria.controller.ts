import { NextFunction, Request, Response } from "express";
import { AppError } from "../middlewares/errorHandler";
import { prisma } from "../prisma/client";

export class CategoriaController {
  async listar(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categorias = await prisma.categoria.findMany({
        orderBy: { nome: "asc" },
        include: {
          _count: { select: { produtos: true } },
        },
      });

      res.json(categorias);
    } catch (error) {
      next(error);
    }
  }

  async buscarPorId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const categoria = await prisma.categoria.findUnique({
        where: { id },
        include: {
          produtos: { orderBy: { nome: "asc" } },
        },
      });

      if (!categoria) {
        throw new AppError("Categoria nao encontrada", 404);
      }

      res.json(categoria);
    } catch (error) {
      next(error);
    }
  }
}
