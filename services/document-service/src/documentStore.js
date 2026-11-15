import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '..', 'storage', 'documents-meta.json');

class DocumentStore {
  constructor() {
    this.documents = [];
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        this.documents = JSON.parse(raw);
      } else {
        this.documents = [];
        this.save();
      }
    } catch (err) {
      console.error('[DocumentStore] Error loading metadata:', err.message);
      this.documents = [];
    }
  }

  save() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.documents, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DocumentStore] Error saving metadata:', err.message);
    }
  }

  recordDocument(meta) {
    const existingIndex = this.documents.findIndex(d => d.requestId === meta.requestId);
    if (existingIndex >= 0) {
      this.documents[existingIndex] = { ...this.documents[existingIndex], ...meta };
    } else {
      this.documents.unshift(meta);
    }
    this.save();
    return meta;
  }

  getByRequestId(requestId) {
    return this.documents.find(d => d.requestId === requestId);
  }

  getByDocumentId(docId) {
    return this.documents.find(d => d.documentId === docId);
  }

  getAll() {
    return this.documents;
  }
}

export const documentStore = new DocumentStore();

