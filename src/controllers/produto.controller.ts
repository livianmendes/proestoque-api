import { NextFunction, Request, Response } from "express";
import { AppError } from "../middlewares/errorHandler";
import { prisma } from "../prisma/client";

const includeCategoria = { categoria: true } as const;

function normalizarTipoMovimentacao(tipo: unknown) {
  const valor = String(tipo ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (valor !== "entrada" && valor !== "saida") {
    throw new AppError("Tipo deve ser entrada ou saida");
  }

  return valor;
}

function validarQuantidadePositiva(quantidade: unknown) {
  const valor = Number(quantidade);

  if (!Number.isInteger(valor) || valor <= 0) {
    throw new AppError("Quantidade deve ser um numero inteiro maior que zero");
  }

  return valor;
}

export class ProdutoController {
  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const { busca, categoriaId, apenasAlerta } = req.query;

      const produtos = await prisma.produto.findMany({
        where: {
          ...(busca && {
            nome: { contains: String(busca) },
          }),
          ...(categoriaId && { categoriaId: String(categoriaId) }),
          ...(apenasAlerta === "true" && {
            quantidade: { lt: prisma.produto.fields.quantidadeMinima },
          }),
        },
        include: includeCategoria,
        orderBy: { nome: "asc" },
      });

      res.json(produtos);
    } catch (error) {
      next(error);
    }
  }

  async buscarPorId(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);

      const produto = await prisma.produto.findUnique({
        where: { id },
        include: includeCategoria,
      });

      if (!produto) {
        throw new AppError("Produto nao encontrado", 404);
      }

      res.json(produto);
    } catch (error) {
      next(error);
    }
  }

  async criar(req: Request, res: Response, next: NextFunction) {
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
          quantidade: Number(quantidade ?? 0),
          quantidadeMinima: Number(quantidadeMinima ?? 0),
          preco: Number(preco),
          unidade: String(unidade ?? "un"),
          observacao: observacao ? String(observacao) : null,
          foto: foto ? String(foto) : null,
        },
        include: includeCategoria,
      });

      res.status(201).json(produto);
    } catch (error) {
      next(error);
    }
  }

  async atualizar(req: Request, res: Response, next: NextFunction) {
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
          ...(quantidade !== undefined && { quantidade: Number(quantidade) }),
          ...(quantidadeMinima !== undefined && {
            quantidadeMinima: Number(quantidadeMinima),
          }),
          ...(preco !== undefined && { preco: Number(preco) }),
          ...(unidade !== undefined && { unidade: String(unidade) }),
          ...(observacao !== undefined && {
            observacao: observacao ? String(observacao) : null,
          }),
          ...(foto !== undefined && { foto: foto ? String(foto) : null }),
          ultimaMovimentacao: new Date(),
        },
        include: includeCategoria,
      });

      res.json(produto);
    } catch (error) {
      next(error);
    }
  }

  async deletar(req: Request, res: Response, next: NextFunction) {
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

  async registrarMovimentacao(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const { tipo, quantidade, observacao } = req.body;

      const tipoNormalizado = normalizarTipoMovimentacao(tipo);
      const quantidadeMovimentada = validarQuantidadePositiva(quantidade);

      const resultado = await prisma.$transaction(async (tx) => {
        const produto = await tx.produto.findUnique({ where: { id } });

        if (!produto) {
          throw new AppError("Produto nao encontrado", 404);
        }

        const delta =
          tipoNormalizado === "entrada" ? quantidadeMovimentada : -quantidadeMovimentada;
        const novaQuantidade = produto.quantidade + delta;

        if (novaQuantidade < 0) {
          throw new AppError("Quantidade insuficiente em estoque");
        }

        const movimentacao = await tx.movimentacao.create({
          data: {
            produtoId: id,
            tipo: tipoNormalizado,
            quantidade: quantidadeMovimentada,
            observacao: observacao ? String(observacao) : null,
          },
        });

        const produtoAtualizado = await tx.produto.update({
          where: { id },
          data: {
            quantidade: novaQuantidade,
            ultimaMovimentacao: new Date(),
          },
          include: includeCategoria,
        });

        return { movimentacao, produto: produtoAtualizado };
      });

      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  async listarMovimentacoes(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);

      const produto = await prisma.produto.findUnique({ where: { id } });

      if (!produto) {
        throw new AppError("Produto nao encontrado", 404);
      }

      const movimentacoes = await prisma.movimentacao.findMany({
        where: { produtoId: id },
        orderBy: { data: "desc" },
      });

      res.json(movimentacoes);
    } catch (error) {
      next(error);
    }
  }
}
