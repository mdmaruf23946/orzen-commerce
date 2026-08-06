import { z } from "zod";

export const orderInput = z.object({ orderId: z.string().uuid() });