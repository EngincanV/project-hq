/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Default content repository for github mode, as "owner/repo". */
  readonly VITE_HQ_REPO?: string;
  /** Default branch for github mode (defaults to "main"). */
  readonly VITE_HQ_BRANCH?: string;
}
