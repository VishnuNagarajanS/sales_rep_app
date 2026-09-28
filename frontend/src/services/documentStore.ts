import { DocumentItem } from '../types';

let inMemoryDocs: DocumentItem[] = [];

export const documentStore = {
  getDocuments(entityType?: string, entityId?: string): DocumentItem[] {
    return inMemoryDocs.filter(d => (!entityType || d.entityType === entityType) && (!entityId || d.entityId === entityId));
  },
  saveDocument(doc: DocumentItem): void {
    inMemoryDocs = inMemoryDocs.filter(d => d.id !== doc.id);
    inMemoryDocs.unshift(doc);
    window.dispatchEvent(new CustomEvent('nexus_docs_updated'));
  },
  deleteDocument(id: string): void {
    inMemoryDocs = inMemoryDocs.filter(d => d.id !== id);
    window.dispatchEvent(new CustomEvent('nexus_docs_updated'));
  },
};
