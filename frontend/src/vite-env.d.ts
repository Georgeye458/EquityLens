/// <reference types="vite/client" />

declare module 'react-pdf' {
  export { Document, Page, pdfjs } from 'react-pdf/dist/esm/entry.webpack5';
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
