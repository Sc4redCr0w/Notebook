const { ChromaClient } = require("chromadb");

const chromaUrl = process.env.CHROMA_URL || "http://localhost:8000";
const client = new ChromaClient({ path: chromaUrl });

/**
 * Helper to fetch or initialize the vector collection
 */
async function getCollection() {
  try {
    return await client.getOrCreateCollection({
      name: "notebook-files",
    });
  } catch (error) {
    console.error("Error obtaining Chroma collection:", error.message);
    throw error;
  }
}

/**
 * Add an array of chunks and their corresponding embeddings into ChromaDB
 * @param {string} hash - SHA256 file hash
 * @param {string} filename - Plain file name
 * @param {string} uploadedBy - Uploader userId
 * @param {string} folder - Target subject folder
 * @param {string[]} chunks - Text chunks
 * @param {number[][]} embeddings - Floating-point embedding vectors
 */
async function addChunksToCollection(hash, filename, uploadedBy, folder, chunks, embeddings) {
  if (!chunks || chunks.length === 0) return;
  
  try {
    const collection = await getCollection();
    
    // Generate unique ID for each chunk based on hash and index
    const ids = chunks.map((_, index) => `${hash}_${index}`);
    
    const metadatas = chunks.map((_, index) => ({
      hash,
      filename,
      uploadedBy,
      folder,
      chunkIndex: index,
    }));

    await collection.add({
      ids,
      embeddings,
      metadatas,
      documents: chunks,
    });
    
    console.log(`Successfully indexed ${chunks.length} chunks into Chroma for file: ${filename}`);
  } catch (error) {
    console.error("Failed to add chunks to ChromaDB:", error.message);
    throw error;
  }
}

/**
 * Queries the collection for semantically matching document chunks
 * @param {number[]} queryEmbedding - The embedding vector of the search query
 * @param {number} limit - Maximum results to retrieve (default 5)
 * @param {Object} filter - Metadata filters (e.g. { uploadedBy: "userId" })
 * @returns {Promise<Object>} - ChromaDB query output
 */
async function queryCollection(queryEmbedding, limit = 5, filter = {}) {
  try {
    const collection = await getCollection();
    
    const queryParams = {
      queryEmbeddings: [queryEmbedding],
      nResults: limit,
    };

    // Apply where metadata filter if defined
    if (filter && Object.keys(filter).length > 0) {
      queryParams.where = filter;
    }

    const results = await collection.query(queryParams);
    return results;
  } catch (error) {
    console.error("ChromaDB query failed:", error.message);
    throw error;
  }
}

module.exports = {
  client,
  getCollection,
  addChunksToCollection,
  queryCollection,
};
