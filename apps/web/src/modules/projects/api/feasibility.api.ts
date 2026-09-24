import { createResourceApi } from "../../../lib/apiResource";
import { RESOURCE } from "../../../lib/queryKeys";
import type { FeasibilitySurveyRow } from "../types";

export const feasibilityApi = createResourceApi<FeasibilitySurveyRow>("/api/projects/feasibility", RESOURCE.feasibilitySurveys);
