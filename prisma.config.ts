import { defineConfig } from "prisma/config";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const config = defineConfig({ schema: "./prisma/schema.prisma" });

export default process.env.DATABASE_URL
  ? { ...config, datasource: { url: process.env.DATABASE_URL } }
  : config;
