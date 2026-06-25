# ProEstoque API

Backend do ProEstoque desenvolvido nas Aulas 9 e 10 de Desenvolvimento de Aplicacoes Moveis.

## Tecnologias

- Node.js
- Express
- TypeScript
- Prisma ORM
- SQLite
- JWT
- bcrypt
- Zod

## Como rodar

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

A API sobe em:

```text
http://localhost:3333
```

## Railway / producao

Para publicar conforme a Aula 12:

```bash
npm run build
npm run db:deploy
npm start
```

No Railway, configure:

```text
Build Command: npm install && npm run build
Start Command: npm run start:railway
```

Variaveis obrigatorias:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
JWT_SECRET="uma-chave-longa-e-segura"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="30d"
NODE_ENV="production"
```

Se trocar o banco para PostgreSQL no Railway, ajuste o provider do `schema.prisma` para `postgresql`, gere uma migration nova e rode o seed das categorias no shell da Railway.

## Variaveis de ambiente

Crie um arquivo `.env` com base em `.env.example`:

```env
PORT=3333
DATABASE_URL="file:./dev.db"
NODE_ENV="development"
JWT_SECRET="troque-por-uma-chave-longa-e-segura"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="30d"
```

## Endpoints principais

### Autenticacao

- `POST /api/auth/registro`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`

### Produtos

As rotas de produtos exigem token JWT no header `Authorization`.

- `GET /api/produtos`
- `GET /api/produtos/:id`
- `POST /api/produtos`
- `PUT /api/produtos/:id`
- `DELETE /api/produtos/:id`

### Categorias

As rotas de categorias exigem token JWT no header `Authorization`.

- `GET /api/categorias`
- `GET /api/categorias/:id`

## Testes feitos

- Registro de usuario com hash de senha
- Login com JWT
- Rota `/auth/me` protegida
- Refresh token
- Bloqueio de rotas privadas sem token
- CRUD de produtos
- Listagem de categorias do seed
- Tratamento de erros com `AppError`
