"""SCX.ai API client using OpenAI SDK."""

from typing import List, Dict, Any, Optional, AsyncIterator
import logging

from openai import AsyncOpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import settings

logger = logging.getLogger(__name__)


class SCXClient:
    """Client for SCX.ai API (OpenAI-compatible)."""

    def __init__(self):
        """Initialize the SCX.ai client."""
        self.client = AsyncOpenAI(
            api_key=settings.scx_api_key,
            base_url=settings.scx_api_base_url,
        )
        self.default_model = settings.scx_model
        self.embedding_model = settings.scx_embedding_model

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=60),
    )
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        system_prompt: Optional[str] = None,
    ) -> str:
        """
        Generate a chat completion using SCX.ai.

        Args:
            messages: List of message dictionaries with 'role' and 'content'
            model: Model to use (defaults to llama-4)
            temperature: Sampling temperature
            max_tokens: Maximum tokens in response
            system_prompt: Optional system prompt to prepend

        Returns:
            Generated text response
        """
        model = model or self.default_model

        # Prepend system prompt if provided
        if system_prompt:
            messages = [{"role": "system", "content": system_prompt}] + messages

        try:
            response = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"SCX.ai chat completion error: {e}")
            raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=60),
    )
    async def create_embeddings(
        self,
        texts: List[str],
        model: Optional[str] = None,
    ) -> List[List[float]]:
        """
        Create embeddings for a list of texts.

        Args:
            texts: List of texts to embed
            model: Embedding model to use

        Returns:
            List of embedding vectors
        """
        model = model or self.embedding_model

        try:
            response = await self.client.embeddings.create(
                model=model,
                input=texts,
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            logger.error(f"SCX.ai embedding error: {e}")
            raise

    async def create_embedding(self, text: str) -> List[float]:
        """Create embedding for a single text."""
        embeddings = await self.create_embeddings([text])
        return embeddings[0]

    async def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        system_prompt: Optional[str] = None,
        max_retries: int = 3,
    ) -> AsyncIterator[str]:
        """
        Generate a streaming chat completion using SCX.ai with retry logic.

        Args:
            messages: List of message dictionaries with 'role' and 'content'
            model: Model to use (defaults to llama-4)
            temperature: Sampling temperature
            max_tokens: Maximum tokens in response
            system_prompt: Optional system prompt to prepend
            max_retries: Maximum number of retry attempts

        Yields:
            Text chunks as they are generated
        """
        import asyncio
        
        model = model or self.default_model

        # Prepend system prompt if provided
        if system_prompt:
            messages = [{"role": "system", "content": system_prompt}] + messages

        last_error = None
        for attempt in range(max_retries):
            try:
                stream = await self.client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=True,
                )
                
                chunk_count = 0
                async for chunk in stream:
                    # Guard against empty choices array
                    if chunk.choices and len(chunk.choices) > 0:
                        if chunk.choices[0].delta.content:
                            chunk_count += 1
                            yield chunk.choices[0].delta.content
                
                # If we got here successfully with content, we're done
                if chunk_count > 0:
                    return
                else:
                    # Empty response - treat as retriable error
                    logger.warning(f"SCX.ai stream returned no content (attempt {attempt + 1}/{max_retries})")
                    last_error = Exception("Empty response from LLM")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(2 ** attempt)  # Exponential backoff
                        continue
                        
            except Exception as e:
                last_error = e
                logger.error(f"SCX.ai streaming error (attempt {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff: 1s, 2s, 4s
                    continue
                raise
        
        # If we exhausted retries, raise the last error
        if last_error:
            raise last_error

    async def analyze_with_context(
        self,
        query: str,
        context_chunks: List[str],
        system_prompt: str,
        model: Optional[str] = None,
    ) -> str:
        """
        Analyze query with provided context (RAG pattern).

        Args:
            query: User's question
            context_chunks: Retrieved document chunks
            system_prompt: System instructions
            model: Model to use

        Returns:
            AI-generated response with context
        """
        # Build context string
        context = "\n\n---\n\n".join(context_chunks)

        messages = [
            {
                "role": "user",
                "content": f"Context from documents:\n\n{context}\n\n---\n\nQuestion: {query}",
            }
        ]

        return await self.chat_completion(
            messages=messages,
            model=model,
            system_prompt=system_prompt,
        )


# Singleton instance
scx_client = SCXClient()
