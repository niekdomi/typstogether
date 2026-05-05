import { createAuthClient } from "better-auth/solid";

import { baseUrl } from "./api";

export const authClient = createAuthClient({ baseURL: baseUrl });
