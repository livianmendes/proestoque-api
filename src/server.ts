import "dotenv/config";
import { app } from "./app";
import { config } from "./config";
import { prisma } from "./prisma/client";

async function iniciar() {
  try {
    await prisma.$connect();
    console.log("Banco de dados conectado");

    app.listen(config.port, () => {
      console.log(`ProEstoque API rodando em http://localhost:${config.port}`);
      console.log("Prisma Studio: npm run db:studio");
    });
  } catch (error) {
    console.error("Erro ao conectar ao banco:", error);
    process.exit(1);
  }
}

iniciar();
