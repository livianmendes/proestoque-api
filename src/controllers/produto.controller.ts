import { NextFunction, Request, Response } from "express";
import { AppError } from "../middlewares/errorHandler";
import { prisma } from "../prisma/client";

type TipoMovimentacao = "entrada" | "saida";

function normalizarTipo(tipo: unknown): TipoMovimentacao | null {
  const valor = String(tipo ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  if (valor === "entrada") return "entrada";
  if (valor === "saida") return "saida";
  return null;
}

function numeroValido(valor: unknown, nomeCampo: string): number {
  const numero = Number(valor);

  if (Number.isNaN(numero)) {
    throw new AppError(`Campo invalido: ${nomeCampo}`);
  }

  return numero;
}

export class ProdutoController {
  async listar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { busca, categoriaId, apenasAlerta } = req.query;

      const produtos = await prisma.produto.findMany({
        where: {
          ...(busca && { nome: { contains: String(busca) } }),
          ...(categoriaId && { categoriaId: String(categoriaId) }),
        },
        include: { categoria: true },
        orderBy: { nome: "asc" },
      });

      const resposta =
        apenasAlerta === "true"
          ? produtos.filter((produto) => produto.quantidade < produto.quantidadeMinima)
          : produtos;

      res.json(resposta);
    } catch (error) {
      next(error);
    }
  }

  async buscarPorId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const produto = await prisma.produto.findUnique({
        where: { id },
        include: { categoria: true, movimentacoes: { orderBy: { criadoEm: "desc" } } },
      });

      if (!produto) {
        throw new AppError("Produto nao encontrado", 404);
      }

      res.json(produto);
    } catch (error) {
      next(error);
    }
  }

  async criar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        nome,
        categoriaId,
        quantidade,
        quantidadeMinima,
        preco,
        unidade,
        observacao,
        foto,
      } = req.body;

      if (!nome || !categoriaId || preco === undefined) {
        throw new AppError("Campos obrigatorios: nome, categoriaId, preco");
      }

      const categoriaExiste = await prisma.categoria.findUnique({
        where: { id: String(categoriaId) },
      });

      if (!categoriaExiste) {
        throw new AppError("Categoria nao encontrada", 404);
      }

      const produto = await prisma.produto.create({
        data: {
          nome: String(nome).trim(),
          categoriaId: String(categoriaId),
          quantidade: numeroValido(quantidade ?? 0, "quantidade"),
          quantidadeMinima: numeroValido(quantidadeMinima ?? 0, "quantidadeMinima"),
          preco: numeroValido(preco, "preco"),
          unidade: String(unidade ?? "un"),
          observacao: observacao ? String(observacao) : null,
          foto: foto ? String(foto) : null,
        },
        include: { categoria: true },
      });

      res.status(201).json(produto);
    } catch (error) {
      next(error);
    }
  }

  async atualizar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const {
        nome,
        categoriaId,
        quantidade,
        quantidadeMinima,
        preco,
        unidade,
        observacao,
        foto,
      } = req.body;

      const produtoExiste = await prisma.produto.findUnique({ where: { id } });

      if (!produtoExiste) {
        throw new AppError("Produto nao encontrado", 404);
      }

      if (categoriaId) {
        const categoriaExiste = await prisma.categoria.findUnique({
          where: { id: String(categoriaId) },
        });

        if (!categoriaExiste) {
          throw new AppError("Categoria nao encontrada", 404);
        }
      }

      const produto = await prisma.produto.update({
        where: { id },
        data: {
          ...(nome !== undefined && { nome: String(nome).trim() }),
          ...(categoriaId !== undefined && { categoriaId: String(categoriaId) }),
          ...(quantidade !== undefined && {
            quantidade: numeroValido(quantidade, "quantidade"),
          }),
          ...(quantidadeMinima !== undefined && {
            quantidadeMinima: numeroValido(quantidadeMinima, "quantidadeMinima"),
          }),
          ...(preco !== undefined && { preco: numeroValido(preco, "preco") }),
          ...(unidade !== undefined && { unidade: String(unidade) }),
          ...(observacao !== undefined && { observacao: observacao ? String(observacao) : null }),
          ...(foto !== undefined && { foto: foto ? String(foto) : null }),
          ultimaMovimentacao: new Date(),
        },
        include: { categoria: true },
      });

      res.json(produto);
    } catch (error) {
      next(error);
    }
  }

  async deletar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const produtoExiste = await prisma.produto.findUnique({ where: { id } });

      if (!produtoExiste) {
        throw new AppError("Produto nao encontrado", 404);
      }

      await prisma.produto.delete({ where: { id } });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async movimentar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const tipo = normalizarTipo(req.body.tipo);
      const quantidade = Number(req.body.quantidade);
      const observacao = req.body.observacao ? String(req.body.observacao) : null;

      if (!tipo) {
        throw new AppError("Tipo deve ser entrada ou saida");
      }

      if (!Number.isInteger(quantidade) || quantidade <= 0) {
        throw new AppError("Quantidade deve ser um numero inteiro maior que zero");
      }

      const produtoExiste = await prisma.produto.findUnique({ where: { id } });

      if (!produtoExiste) {
        throw new AppError("Produto nao encontrado", 404);
      }

      if (tipo === "saida" && produtoExiste.quantidade < quantidade) {
        throw new AppError("Estoque insuficiente");
      }

      const resultado = await prisma.$transaction(async (tx) => {
        const movimentacao = await tx.movimentacao.create({
          data: {
            tipo,
            quantidade,
            observacao,
            produtoId: id,
          },
        });

        const produto = await tx.produto.update({
          where: { id },
          data: {
            quantidade:
              tipo === "entrada"
                ? { increment: quantidade }
                : { decrement: quantidade },
            ultimaMovimentacao: new Date(),
          },
          include: { categoria: true },
        });

        return { movimentacao, produto };
      });

      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  async listarMovimentacoes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const produtoExiste = await prisma.produto.findUnique({ where: { id } });

      if (!produtoExiste) {
        throw new AppError("Produto nao encontrado", 404);
      }

      const movimentacoes = await prisma.movimentacao.findMany({
        where: { produtoId: id },
        orderBy: { criadoEm: "desc" },
      });

      res.json(movimentacoes);
    } catch (error) {
      next(error);
    }
  }
}
