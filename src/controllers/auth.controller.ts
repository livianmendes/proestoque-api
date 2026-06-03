import bcrypt from "bcrypt";
import { NextFunction, Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import { config } from "../config";
import { AppError } from "../middlewares/errorHandler";
import { prisma } from "../prisma/client";
import { LoginInput, RefreshInput, RegistroInput } from "../schemas/auth.schema";

export type JwtPayload = {
  sub: string;
  nome: string;
  email: string;
};

type UsuarioToken = {
  id: string;
  nome: string;
  email: string;
};

function gerarToken(usuario: UsuarioToken): string {
  const payload: JwtPayload = {
    sub: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as SignOptions);
}

function gerarRefreshToken(usuario: UsuarioToken): string {
  return jwt.sign(
    {
      sub: usuario.id,
      type: "refresh",
    },
    config.jwtSecret,
    { expiresIn: config.jwtRefreshExpiresIn } as SignOptions
  );
}

export class AuthController {
  async registrar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { nome, email, senha } = req.body as RegistroInput;

      const usuarioExistente = await prisma.usuario.findUnique({
        where: { email },
      });

      if (usuarioExistente) {
        throw new AppError("E-mail ja cadastrado", 409);
      }

      const senhaHash = await bcrypt.hash(senha, 10);

      const usuario = await prisma.usuario.create({
        data: { nome, email, senha: senhaHash },
        select: { id: true, nome: true, email: true, criadoEm: true },
      });

      const token = gerarToken(usuario);
      const refreshToken = gerarRefreshToken(usuario);

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { refreshToken },
      });

      res.status(201).json({ usuario, token, refreshToken });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, senha } = req.body as LoginInput;

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

      const token = gerarToken(usuario);
      const refreshToken = gerarRefreshToken(usuario);
      const { senha: _senha, refreshToken: _refreshToken, ...usuarioSemSenha } = usuario;

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { refreshToken },
      });

      res.json({ usuario: usuarioSemSenha, token, refreshToken });
    } catch (error) {
      next(error);
    }
  }

  async perfil(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const usuarioId = req.usuario?.sub;

      if (!usuarioId) {
        throw new AppError("Token invalido", 401);
      }

      const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: { id: true, nome: true, email: true, criadoEm: true },
      });

      if (!usuario) {
        throw new AppError("Usuario nao encontrado", 404);
      }

      res.json(usuario);
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body as RefreshInput;

      const payload = jwt.verify(refreshToken, config.jwtSecret) as jwt.JwtPayload;

      if (payload.type !== "refresh" || !payload.sub) {
        throw new AppError("Refresh token invalido", 401);
      }

      const usuario = await prisma.usuario.findUnique({
        where: { id: String(payload.sub) },
      });

      if (!usuario || usuario.refreshToken !== refreshToken) {
        throw new AppError("Refresh token invalido", 401);
      }

      const token = gerarToken(usuario);
      const novoRefreshToken = gerarRefreshToken(usuario);
      const { senha: _senha, refreshToken: _refreshToken, ...usuarioSemSenha } = usuario;

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { refreshToken: novoRefreshToken },
      });

      res.json({ usuario: usuarioSemSenha, token, refreshToken: novoRefreshToken });
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
