const embeddingService = require("./embeddingService");
const chromaService = require("./chromaService");
const geminiService = require("./geminiService");

/**
 * Orchestrates the RAG process: embeddings -> Chroma query -> context generation -> source matching
 * @param {string} question - Question asked by user
 * @param {string} userId - Current user's ID
 * @param {string} scope - Search scope ("all" or "mine")
 * @returns {Promise<Object>} - Output matching RAG format (answer, sources)
 */
async function getRAGAnswer(question, userId, scope = "all") {
  if (!question) {
    throw new Error("Question is required for search");
  }

  // 1. Generate query embedding vector
  const embedding = await embeddingService.generateEmbedding(question);

  // 2. Build metadata filter for the vector search scope
  const filter = {};
  if (scope === "mine") {
    filter.uploadedBy = userId;
  }

  // 3. Search top 5 chunks in ChromaDB
  const results = await chromaService.queryCollection(embedding, 5, filter);

  const chunks = (results.documents && results.documents[0]) || [];
  const metadatas = (results.metadatas && results.metadatas[0]) || [];

  // 4. Generate answer using context excerpts
  const answer = await geminiService.generateAnswer(question, chunks);

  // 5. Gather deduplicated source list from matching chunk metadata
  const sourcesMap = new Map();
  metadatas.forEach((meta) => {
    if (meta && meta.filename) {
      const key = `${meta.filename}::${meta.uploadedBy}`;
      sourcesMap.set(key, {
        filename: meta.filename,
        uploadedBy: meta.uploadedBy,
      });
    }
  });

  const sources = Array.from(sourcesMap.values());

  return {
    answer,
    sources,
  };
}

module.exports = {
  getRAGAnswer,
};
