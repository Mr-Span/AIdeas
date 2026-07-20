import { defaultDataRoot, getControlStore } from "@/server/storage/runtime";

import { EvidenceExportService } from "./evidence-export-service";

export function getEvidenceExportService(dataRoot = defaultDataRoot()) {
  return new EvidenceExportService(getControlStore(dataRoot), undefined, [
    process.cwd(),
    dataRoot,
    process.env.USERPROFILE ?? "",
  ].filter(Boolean));
}
