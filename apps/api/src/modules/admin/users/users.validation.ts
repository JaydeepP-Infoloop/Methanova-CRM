import { Role } from "@methanova/shared-types";
import { z } from "zod";

const roleEnum = z.nativeEnum(Role);

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().toLowerCase(),
  role: roleEnum,
  password: z.string().min(8).max(200),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().toLowerCase().optional(),
  role: roleEnum.optional(),
  password: z.string().min(8).max(200).optional(),
});
