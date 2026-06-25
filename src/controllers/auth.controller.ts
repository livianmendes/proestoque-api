import bcrypt from "bcrypt";
import { NextFunction, Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import { StringValue } from "ms";
import { config } from "../config";
import { AppError } from "../middlewares/errorHandler";
import { prisma } from "../prisma/client";

export type JwtPayload = {
  sub: string;
  nome: string;
  email: string;
  tipo: "access" | "refresh";
};

type UsuarioToken = {
  id: string;
  nome: string;
  email: string;
};

const usuarioSelect = {
  id: true,
  nome: true,
  email: true,
  criadoEm: true,
} as const;

function assinarToken(
  usuario: UsuarioToken,
  tipo: JwtPayload["tipo"],
  expiresIn: string
) {
  const payload: JwtPayload = {
    sub: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    tipo,
  };

  const options: SignOptions = { expiresIn: expiresIn as StringValue };

  return jwt.sign(payload, config.jwtSecret, options);
}

function gerarTokens(usuario: UsuarioToken) {
  return {
    token: assinarToken(usuario, "access", config.jwtExpiresIn),
    refreshToken: assinarToken(usuario, "refresh", config.jwtRefreshExpiresIn),
  };
}

export class AuthController {
  async registrar(req: Request, res: Response, next: NextFunction) {
    try {
      const { nome, email, senha } = req.body;

      const usuarioExistente = await prisma.usuario.findUnique({
        where: { email },
      });

      if (usuarioExistente) {
        throw new AppError("E-mail ja cadastrado", 409);
      }

      const senhaHash = await bcrypt.hash(senha, 10);

      const usuario = await prisma.usuario.create({
        data: { nome, email, senha: senhaHash },
        select: usuarioSelect,
      });

      const tokens = gerarTokens(usuario);

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { refreshToken: tokens.refreshToken },
      });

      res.status(201).json({
        usuario,
        ...tokens,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, senha } = req.body;

      const usuario = await prisma.usuario.findUnique({
        where: { email },
      });

      if (!usuario) {
        throw new AppError("E-mail ou senha invalidos", 401);
      }

      const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

      if (!senhaCorreta) {
        throw new AppError("E-mail ou senha invalidos", 401);
      }

      const usuarioSemSenha = {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        criadoEm: usuario.criadoEm,
      };
      const tokens = gerarTokens(usuarioSemSenha);

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { refreshToken: tokens.refreshToken },
      });

      res.json({
        usuario: usuarioSemSenha,
        ...tokens,
      });
    } catch (error) {
      next(error);
    }
  }

  async perfil(req: Request, res: Response, next: NextFunction) {
    try {
      const usuario = await prisma.usuario.findUnique({
        where: { id: req.usuario?.sub },
        select: usuarioSelect,
      });

      if (!usuario) {
        throw new AppError("Usuario nao encontrado", 404);
      }

      res.json(usuario);
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;

      const payload = jwt.verify(refreshToken, config.jwtSecret) as JwtPayload;

      if (payload.tipo !== "refresh") {
        throw new AppError("Refresh token invalido", 401);
      }

      const usuario = await prisma.usuario.findUnique({
        where: { id: payload.sub },
      });

      if (!usuario || usuario.refreshToken !== refreshToken) {
        throw new AppError("Refresh token invalido", 401);
      }

      const usuarioSemSenha = {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        criadoEm: usuario.criadoEm,
      };
      const tokens = gerarTokens(usuarioSemSenha);

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { refreshToken: tokens.refreshToken },
      });

      res.json({
        usuario: usuarioSemSenha,
        ...tokens,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "JsonWebTokenError") {
        next(new AppError("Refresh token invalido", 401));
        return;
      }

      if (error instanceof Error && error.name === "TokenExpiredError") {
        next(new AppError("Refresh token expirado", 401));
        return;
      }

      next(error);
    }
  }
}
