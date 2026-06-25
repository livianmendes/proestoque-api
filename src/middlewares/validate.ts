import { NextFunction, Request, Response } from "express";
import { ZodError, ZodSchema } from "zod";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const detalhes = error.issues.map((issue) => ({
          campo: issue.path.join("."),
          mensagem: issue.message,
        }));

        res.status(422).json({ erro: "Dados invalidos", detalhes });
        return;
      }

      next(error);
    }
  };
}
