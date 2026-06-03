import { Router } from "express";
import { ProdutoController } from "../controllers/produto.controller";
import { autenticar } from "../middlewares/auth";

const router = Router();
const controller = new ProdutoController();

router.use(autenticar);

router.get("/", controller.listar.bind(controller));
router.post("/", controller.criar.bind(controller));
router.get("/:id/movimentacoes", controller.listarMovimentacoes.bind(controller));
router.post("/:id/movimentacao", controller.movimentar.bind(controller));
router.get("/:id", controller.buscarPorId.bind(controller));
router.put("/:id", controller.atualizar.bind(controller));
router.delete("/:id", controller.deletar.bind(controller));

export { router as produtoRouter };
