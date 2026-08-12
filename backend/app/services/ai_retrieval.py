import abc
import uuid
import math
import time
import heapq
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.document import DocumentChunk
from app.config.settings import settings

logger = logging.getLogger("app.services.ai_retrieval")
_pgvector_available: Optional[bool] = None


class BaseEmbeddingService(abc.ABC):
    """
    Abstract interface for generating text embeddings.
    Ready to be plugged into OpenAI, Gemini, or local HuggingFace embedding APIs.
    """

    @abc.abstractmethod
    async def get_embedding(self, text: str) -> List[float]:
        """Generate a vector embedding for a single text chunk."""
        pass

    @abc.abstractmethod
    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate vector embeddings for a list of text chunks."""
        pass


class MockEmbeddingService(BaseEmbeddingService):
    """
    Placeholder embedding service generating standard 1536-dimensional mock embeddings.
    Embeddings are deterministic based on string hash to allow mock similarity testing.
    """

    def __init__(self, dimensions: int = 1536):
        self.dimensions = dimensions

    def _generate_vector(self, text: str) -> List[float]:
        # Hash text to generate a deterministic float vector
        h = hash(text)
        vector = []
        for i in range(self.dimensions):
            # Deterministic pseudo-random generation based on index and hash
            val = math.sin(h + i)
            vector.append(val)
        
        # Normalize vector to unit length
        norm = math.sqrt(sum(x * x for x in vector))
        if norm > 0:
            vector = [x / norm for x in vector]
        return vector

    async def get_embedding(self, text: str) -> List[float]:
        return self._generate_vector(text)

    async def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        return [self._generate_vector(t) for t in texts]


class BaseVectorStorageService(abc.ABC):
    """
    Abstract interface for indexing and querying embeddings.
    Ready to be plugged into Qdrant, pgvector, or pinecone.
    """

    @abc.abstractmethod
    async def index_chunks(
        self,
        db: AsyncSession,
        document_name: str,
        chunks: List[str],
        embeddings: List[List[float]],
        metadata: Optional[List[dict]] = None
    ) -> None:
        """Store document chunks and their associated embeddings in the database."""
        pass

    @abc.abstractmethod
    async def query_similar_chunks(
        self,
        db: AsyncSession,
        query_embedding: List[float],
        limit: int = 5,
        document_names: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Retrieve most similar chunks using vector similarity."""
        pass


class PostgreSqlVectorStore(BaseVectorStorageService):
    """
    PostgreSQL vector storage service storing float embeddings in standard database arrays.
    Keeps PostgreSQL as the source of truth and performs cosine similarity queries.
    Ready for immediate pgvector migration (swapping similarity algorithm to <=> cosine operator).
    """

    async def index_chunks(
        self,
        db: AsyncSession,
        document_name: str,
        chunks: List[str],
        embeddings: List[List[float]],
        metadata: Optional[List[dict]] = None
    ) -> None:
        db_chunks = []
        for idx, (chunk, emb) in enumerate(zip(chunks, embeddings)):
            meta = metadata[idx] if metadata and idx < len(metadata) else {}
            db_chunks.append(DocumentChunk(
                document_name=document_name,
                content=chunk,
                chunk_index=idx,
                embedding=emb,
                metadata_json=meta
            ))
        db.add_all(db_chunks)
        await db.commit()

    async def query_similar_chunks(
        self,
        db: AsyncSession,
        query_embedding: List[float],
        limit: int = 5,
        document_names: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        global _pgvector_available
        start_time = time.perf_counter()
        
        # Check pgvector if enabled in settings
        is_pgvector_used = False
        if settings.ENABLE_PGVECTOR:
            if _pgvector_available is None:
                try:
                    res = await db.execute(text("SELECT extname FROM pg_extension WHERE extname = 'vector';"))
                    _pgvector_available = res.scalar() is not None
                except Exception:
                    _pgvector_available = False
            is_pgvector_used = _pgvector_available

        if is_pgvector_used:
            try:
                # Convert query_embedding list to pgvector string format: '[0.1, 0.2, ...]'
                q_emb_str = "[" + ",".join(map(str, query_embedding)) + "]"
                
                # Execute PgVector similarity query
                # <=> operator is Cosine Distance. similarity = 1 - distance
                query_str = """
                    SELECT id, document_name, content, chunk_index, metadata_json,
                           (1 - (embedding::vector <=> CAST(:q_emb AS vector))) AS similarity
                    FROM document_chunks
                    WHERE embedding IS NOT NULL
                """
                params = {"q_emb": q_emb_str}
                if document_names is not None:
                    query_str += " AND document_name = ANY(CAST(:doc_names AS varchar[]))"
                    params["doc_names"] = document_names
                    
                # To get most relevant, we order by distance ASC
                query_str += " ORDER BY embedding::vector <=> CAST(:q_emb AS vector) ASC LIMIT :limit"
                params["limit"] = limit
                
                res = await db.execute(text(query_str), params)
                rows = res.fetchall()
                
                # Count total matching chunks scanned for metrics
                count_stmt = select(func.count(DocumentChunk.id)).where(DocumentChunk.embedding != None)
                if document_names is not None:
                    count_stmt = count_stmt.where(DocumentChunk.document_name.in_(document_names))
                count_res = await db.execute(count_stmt)
                scanned_count = count_res.scalar() or 0
                
                duration_ms = (time.perf_counter() - start_time) * 1000
                strategy = "PostgreSQL pgvector"
                returned_count = len(rows)
                
                logger.info(
                    f"\nRAG Retrieval\n"
                    f"Strategy: {strategy}\n"
                    f"Scanned: {scanned_count} chunks\n"
                    f"Returned: {returned_count} chunks\n"
                    f"Time: {int(duration_ms)} ms"
                )
                
                return [
                    {
                        "id": str(row[0]),
                        "document_name": row[1],
                        "content": row[2],
                        "chunk_index": row[3],
                        "similarity": float(row[5]) if row[5] is not None else 0.0,
                        "metadata": row[4]
                    }
                    for row in rows
                ]
            except Exception as e:
                logger.error(f"pgvector query failed: {e}. Falling back to Python Batch retrieval.")

        # ── Python Batch / Heap-based Top-K Fallback ──────────────────────────
        q_magnitude = math.sqrt(sum(q * q for q in query_embedding))
        if q_magnitude == 0:
            return []
            
        batch_size = settings.RAG_BATCH_SIZE
        offset = 0
        scanned_count = 0
        top_k_heap = [] # list of tuples: (similarity, item_id, item_dict)
        
        while True:
            stmt = select(DocumentChunk).where(DocumentChunk.embedding != None)
            if document_names is not None:
                stmt = stmt.where(DocumentChunk.document_name.in_(document_names))
            
            stmt = stmt.offset(offset).limit(batch_size)
            res = await db.execute(stmt)
            batch_chunks = res.scalars().all()
            
            if not batch_chunks:
                break
                
            for chunk in batch_chunks:
                scanned_count += 1
                if not chunk.embedding:
                    continue
                    
                # Dot product
                dot_product = sum(q * e for q, e in zip(query_embedding, chunk.embedding))
                # Magnitude
                e_magnitude = math.sqrt(sum(e * e for e in chunk.embedding))
                
                if e_magnitude > 0:
                    similarity = dot_product / (q_magnitude * e_magnitude)
                else:
                    similarity = 0.0
                    
                item = {
                    "id": str(chunk.id),
                    "document_name": chunk.document_name,
                    "content": chunk.content,
                    "chunk_index": chunk.chunk_index,
                    "similarity": similarity,
                    "metadata": chunk.metadata_json
                }
                
                # Maintain min-heap of size 'limit'
                # Note: we use item["id"] as secondary sort key to prevent comparison of dicts
                if len(top_k_heap) < limit:
                    heapq.heappush(top_k_heap, (similarity, item["id"], item))
                else:
                    if similarity > top_k_heap[0][0]:
                        heapq.heappushpop(top_k_heap, (similarity, item["id"], item))
                        
            if len(batch_chunks) < batch_size:
                break
            offset += batch_size
            
        # Extract items from heap and sort descending
        sorted_top_k = sorted(top_k_heap, key=lambda x: x[0], reverse=True)
        results = [item for _, _, item in sorted_top_k]
        
        duration_ms = (time.perf_counter() - start_time) * 1000
        strategy = "Python Batch"
        returned_count = len(results)
        
        logger.info(
            f"\nRAG Retrieval\n"
            f"Strategy: {strategy}\n"
            f"Scanned: {scanned_count} chunks\n"
            f"Returned: {returned_count} chunks\n"
            f"Time: {int(duration_ms)} ms"
        )
        
        return results


class AIRetrievalService:
    """
    Coordinating service for RAG document chunking, indexing, and semantic retrieval.
    """

    def __init__(
        self,
        embedding_service: BaseEmbeddingService = MockEmbeddingService(),
        vector_store: BaseVectorStorageService = PostgreSqlVectorStore()
    ):
        self.embedding_service = embedding_service
        self.vector_store = vector_store

    async def index_document(
        self,
        db: AsyncSession,
        document_name: str,
        content: str
    ) -> None:
        """Parse, chunk, embed, and store document in vector space."""
        # Simple character-based sliding window chunking
        chunk_size = 1000
        overlap = 200
        chunks = []
        
        start = 0
        while start < len(content):
            end = min(start + chunk_size, len(content))
            chunks.append(content[start:end])
            if end >= len(content):
                break
            start += chunk_size - overlap
            
        if not chunks:
            return

        # Generate embeddings
        embeddings = await self.embedding_service.get_embeddings(chunks)
        
        # Prepare metadata
        metadata = [{"chunk_length": len(chunk)} for chunk in chunks]
        
        # Index in vector storage
        await self.vector_store.index_chunks(db, document_name, chunks, embeddings, metadata)

    async def retrieve_relevant_chunks(
        self,
        db: AsyncSession,
        query: str,
        limit: int = 5,
        document_names: Optional[List[str]] = None
    ) -> List[str]:
        """Generate embedding for query and retrieve most similar chunks from database."""
        if not query or not query.strip():
            return []
            
        query_emb = await self.embedding_service.get_embedding(query)
        results = await self.vector_store.query_similar_chunks(db, query_emb, limit, document_names)
        return [res["content"] for res in results]


class RAGPromptBuilder:
    """
    Formulates enriched prompts for AI generator by compiling base prompts with retrieved chunks.
    """

    @staticmethod
    def build_prompt(base_prompt: str, context_chunks: List[str]) -> str:
        if not context_chunks:
            return base_prompt
            
        context_str = "\n---\n".join(context_chunks)
        return f"""[CONTEXT INFORMATION]
You MUST generate questions based ONLY on the following context chunks. Do NOT use any external knowledge, other topics, or default concepts. If the context does not contain enough information to generate the requested number of questions, do not generate unrelated questions.

{context_str}

[USER REQUEST]
{base_prompt}
"""
