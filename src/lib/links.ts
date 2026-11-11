// Addresses outside the app. Change REPO if the repository moves.
const REPO = "Masterplayer556/Game-Bibliothek";

export const REPO_URL = `https://github.com/${REPO}`;
export const guideUrl = (file: string) => `${REPO_URL}/blob/main/docs/${file}`;
export const workflowUrl = (file: string) => `${REPO_URL}/actions/workflows/${file}`;
