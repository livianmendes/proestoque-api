import { Router } from "express";
import { categoriaRouter } from "./categoria.routes";
import { produtoRouter } from "./produto.routes";

const router = Router();

router.use("/produtos", produtoRouter);
router.use("/categorias", categoriaRouter);

export { router };
