import { Elysia, t } from "elysia";
import { readFileSync } from "fs";
import { join } from "path";
import { FeaturesJson, FeaturesRawJson } from "../types";
import { apiKeyGuard2 } from "../middleware/auth";

const featuresPath = join(import.meta.dir, "../features.json");

const FeatureSchema = t.Object({
  label: t.String(),
  description: t.String(),
  enabled: t.Boolean(),
});

export const featuresRoutes = new Elysia({ prefix: "/api/features" })
  .use(apiKeyGuard2)
  .get(
    "/",
    () => {
      const raw = readFileSync(featuresPath, "utf-8");
      const jsonData: FeaturesRawJson = JSON.parse(raw);
      const returnData: FeaturesJson = {};
      for (const key in jsonData) {
        // Try to log the feature flag value from the .env
        const envKey = jsonData[key].key;
        const envValue = process.env[envKey];
        if (envValue !== undefined) {
          returnData[key] = { ...jsonData[key], enabled: envValue === "true" };
        }
      }
      return returnData as Record<
        string,
        { label: string; description: string; enabled: boolean }
      >;
    },
    {
      response: t.Record(t.String(), FeatureSchema),
      detail: { summary: "Get available features and their enabled state" },
    },
  );
