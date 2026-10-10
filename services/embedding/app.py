"""Text-only EmbeddingGemma 2, using the official Transformers implementation.

POST /embed requires model=MODEL, revision=REVISION, texts: string[],
task: "document" | "query", and optional titles: string[].
Returns ordered, finite, L2-normalized 768-dimensional embeddings. Every token
is processed: long inputs use non-overlapping context windows, repeating the
prompt/title, then a body-token-weighted mean and final L2 normalization.

Model/prompt/pooling specification:
https://huggingface.co/google/embeddinggemma-2/tree/914f7f89142e33e77833254d9c9b90c3cef7303b
CPU float32; no remote code, AutoProcessor, vision or audio encoders. The Hub
publishes one combined safetensors file, so the official loader still downloads
that file, but disabled encoders are not instantiated or loaded into tensors.
"""

import asyncio
from contextlib import asynccontextmanager
import logging
from threading import Lock
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, model_validator
import torch
from transformers import AutoConfig, AutoModel, AutoTokenizer

MODEL = "google/embeddinggemma-2"
REVISION = "914f7f89142e33e77833254d9c9b90c3cef7303b"
DIMENSIONS = 768
CONTEXT_TOKENS = 8192
SEARCH_QUERY_PROMPT = "task: search result | query: "
logger = logging.getLogger("uvicorn.error")


class EmbedRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    model: str
    revision: str
    texts: list[str]
    task: Literal["document", "query"] = "document"
    titles: list[str] | None = None

    @model_validator(mode="after")
    def validate_contract(self):
        if self.model != MODEL or self.revision != REVISION:
            raise ValueError("model and revision must match the exact pinned EmbeddingGemma 2 checkpoint")
        if self.titles is not None:
            if self.task != "document":
                raise ValueError("titles are only supported for documents")
            if len(self.titles) != len(self.texts):
                raise ValueError("titles must have exactly one entry per text")
        return self


class EmbedResponse(BaseModel):
    model: str
    revision: str
    dimensions: int
    embeddings: list[list[float]]


class EmbeddingEngine:
    def __init__(self):
        self.revision = REVISION
        self.lock = Lock()
        # One document may reserve the next inference turn; queries never queue.
        self.document_lock = Lock()
        self.tokenizer = AutoTokenizer.from_pretrained(
            MODEL, revision=self.revision, trust_remote_code=False, use_fast=True,
        )
        if not self.tokenizer.is_fast:
            raise RuntimeError("Offset-aware fast tokenizer is required for lossless chunking")
        config = AutoConfig.from_pretrained(
            MODEL, revision=self.revision, trust_remote_code=False,
            vision_config=None, audio_config=None,
        )
        if config.model_type != "embedding_gemma2" or config.text_config.embedding_dim != DIMENSIONS:
            raise RuntimeError("The selected revision is not the required 768d EmbeddingGemma 2 model")
        self.model = AutoModel.from_pretrained(
            MODEL, revision=self.revision, config=config, trust_remote_code=False,
            dtype=torch.float32, attn_implementation="sdpa",
        ).to("cpu").eval()
        if self.model.vision_tower is not None or self.model.audio_tower is not None:
            raise RuntimeError("The official loader did not disable unused modality encoders")
        # Readiness requires successful real inference, not merely a completed download.
        self.embed(["Embedding service readiness"], "query", None)

    @staticmethod
    def normalize(vector: torch.Tensor) -> torch.Tensor:
        if vector.shape != (DIMENSIONS,) or not torch.isfinite(vector).all().item():
            raise RuntimeError("Model returned an invalid embedding")
        norm = torch.linalg.vector_norm(vector)
        if not torch.isfinite(norm).item() or norm.item() <= 0:
            raise RuntimeError("Model returned an unnormalizable embedding")
        return vector / norm

    def embed_one(self, text: str, task: str, title: str | None) -> list[float]:
        prefix = SEARCH_QUERY_PROMPT if task == "query" else f"title: {title or 'none'} | text: "
        # Tokenize the complete formatted input once. Offsets isolate the prefix
        # without decode/re-encode losses at Unicode or subword window boundaries.
        encoded = self.tokenizer(
            prefix + text, add_special_tokens=True, truncation=False,
            return_offsets_mapping=True, return_special_tokens_mask=True, return_attention_mask=False,
        )
        # Fast-tokenizer build_inputs_with_special_tokens does not run its Rust
        # postprocessor. Preserve the actual inserted boundary tokens instead.
        mask = encoded["special_tokens_mask"]
        first = next(i for i, special in enumerate(mask) if not special)
        last = max(i for i, special in enumerate(mask) if not special) + 1
        leading_ids = encoded["input_ids"][:first]
        trailing_ids = encoded["input_ids"][last:]
        token_ids = encoded["input_ids"][first:last]
        offsets = encoded["offset_mapping"][first:last]
        split = next(
            (i for i, (_, end) in enumerate(offsets) if end > len(prefix)),
            len(token_ids),
        )
        prefix_ids, body_ids = token_ids[:split], token_ids[split:]
        # A token may straddle the prefix/body character boundary. The first
        # window retains that original token; later windows repeat the complete
        # independently tokenized prefix, never a partial title/task delimiter.
        repeated_prefix_ids = self.tokenizer(prefix, add_special_tokens=False)["input_ids"]
        prefix_size = max(len(prefix_ids), len(repeated_prefix_ids))
        budget = CONTEXT_TOKENS - len(leading_ids) - len(trailing_ids) - prefix_size
        if budget <= 0:
            raise HTTPException(status_code=422, detail="Document title/prompt leaves no body-token context")
        total = torch.zeros(DIMENSIONS, dtype=torch.float32)
        total_weight = 0
        # The empty-body case still embeds the actual task prefix, not a fake zero vector.
        for start in range(0, max(1, len(body_ids)), budget):
            body_chunk = body_ids[start:start + budget]
            window_prefix = prefix_ids if start == 0 else repeated_prefix_ids
            ids = leading_ids + window_prefix + body_chunk + trailing_ids
            if len(ids) > CONTEXT_TOKENS:
                raise RuntimeError("Tokenizer special-token accounting exceeded the context window")
            input_ids = torch.tensor([ids], dtype=torch.long)
            attention_mask = torch.ones_like(input_ids)
            outputs = self.model(input_ids=input_ids, attention_mask=attention_mask)
            # Official 1_Pooling/config.json: mean, include_prompt=true.
            # EmbeddingGemma2Model projects every token from 512 to 768 before pooling.
            vector = self.normalize(outputs.last_hidden_state[0].float().mean(dim=0))
            weight = max(1, len(body_chunk))
            total.add_(vector, alpha=weight)
            total_weight += weight
        return self.normalize(total / total_weight).tolist()

    def embed(self, texts: list[str], task: str, titles: list[str] | None) -> list[list[float]]:
        document = task == "document"
        if document and not self.document_lock.acquire(blocking=False):
            raise HTTPException(status_code=503, detail="Document inference is busy", headers={"Retry-After": "1"})
        try:
            if not document and self.document_lock.locked():
                raise HTTPException(status_code=503, detail="Document maintenance has priority", headers={"Retry-After": "1"})
            acquired = self.lock.acquire(timeout=30) if document else self.lock.acquire(blocking=False)
            if not acquired:
                raise HTTPException(status_code=503, detail="Inference is busy", headers={"Retry-After": "1"})
            try:
                with torch.inference_mode():
                    return [
                        self.embed_one(text, task, titles[index] if titles is not None else None)
                        for index, text in enumerate(texts)
                    ]
            finally:
                # Release only after actual CPU work ends, even if the HTTP client leaves.
                self.lock.release()
        finally:
            if document:
                self.document_lock.release()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Uvicorn does not serve requests until this startup (download + warmup)
    # completes. Startup exceptions retain their traceback and terminate startup.
    app.state.engine = await asyncio.to_thread(EmbeddingEngine)
    logger.info("Embedding ready: %s@%s (CPU float32, text-only)", MODEL, app.state.engine.revision)
    yield
    app.state.engine = None


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health():
    engine = getattr(app.state, "engine", None)
    if engine is None:
        raise HTTPException(status_code=503, detail="Model is not ready")
    return {"status": "ready", "model": MODEL, "revision": engine.revision, "dimensions": DIMENSIONS}


@app.post("/embed", response_model=EmbedResponse)
def embed(request: EmbedRequest):
    engine = getattr(app.state, "engine", None)
    if engine is None:
        raise HTTPException(status_code=503, detail="Model is not ready")
    # Do not turn dependency, inference, nonfinite or normalization errors into vectors.
    vectors = engine.embed(request.texts, request.task, request.titles)
    return EmbedResponse(model=MODEL, revision=engine.revision, dimensions=DIMENSIONS, embeddings=vectors)
