// biome-ignore lint/style/noRestrictedImports: react-pdf requires the exact worker URL via ?url import
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { pdfjs } from 'react-pdf'

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker
