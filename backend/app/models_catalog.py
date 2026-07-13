"""Central catalog of SCX.ai models and their token limits.

Single source of truth for model IDs, context windows and output-token
limits. Values were verified live against ``GET https://api.scx.ai/v1/models``
(``context_length`` and ``max_output_length`` fields) and by probing
``/chat/completions`` for each model.

Helpers here let the rest of the app account for both the *output* token cap
(each model caps how many tokens it will generate) and the *input* budget
(document text must fit inside the context window minus the reserved output).
"""

from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass(frozen=True)
class ModelSpec:
    """Metadata + limits for a single SCX chat model."""

    id: str
    label: str
    context_length: int      # total context window (input + output), in tokens
    max_output_tokens: int   # hard cap on generated tokens (max_output_length)
    reasoning: bool = False
    vision: bool = False


# --- Live SCX chat models (verified 2026-07) -------------------------------
# Ordered best/most-capable first for display purposes.
CHAT_MODELS: List[ModelSpec] = [
    ModelSpec("gpt-oss-120b", "GPT-OSS 120B (131K ctx, 131K out)", 131072, 131072, reasoning=True),
    ModelSpec("MAGPiE", "MAGPiE — AU Sovereign (131K ctx, 131K out)", 131072, 131072, reasoning=True),
    ModelSpec("MiniMax-M2.7", "MiniMax M2.7 (192K ctx, 4K out)", 192000, 4096, reasoning=True),
    ModelSpec("DeepSeek-V3.1", "DeepSeek V3.1 (131K ctx, 7K out)", 131072, 7168, reasoning=True),
    ModelSpec("gemma-4-31B-it", "Gemma 4 31B — Vision (131K ctx, 8K out)", 131072, 8192, reasoning=True, vision=True),
    ModelSpec("Llama-4-Maverick-17B-128E-Instruct", "Llama 4 Maverick — Vision (131K ctx, 4K out)", 131072, 4096, vision=True),
    ModelSpec("Meta-Llama-3.3-70B-Instruct", "Llama 3.3 70B (131K ctx, 3K out)", 131072, 3072),
    ModelSpec("coder", "SCX Coder (196K ctx, 4K out)", 196608, 4096, reasoning=True),
    ModelSpec("Qwen3-32B", "Qwen3 32B (33K ctx, 4K out)", 32768, 4096, reasoning=True),
]

_MODELS_BY_ID: Dict[str, ModelSpec] = {m.id: m for m in CHAT_MODELS}

# Default chat model. The previous default (MiniMax-M2.5) was removed from the
# SCX tier. gpt-oss-120b is chosen because it comfortably supports the app's
# large POI-JSON / report outputs (131K output cap) alongside a 131K context.
DEFAULT_CHAT_MODEL = "gpt-oss-120b"

# Embedding model (verified working; 4096 dims, 33K context).
EMBEDDING_MODEL = "E5-Mistral-7B-Instruct"

# --- Token accounting knobs ------------------------------------------------
# Conservative characters-per-token estimate for English financial prose.
CHARS_PER_TOKEN = 3.5
# Headroom left for the system prompt, chat template and formatting overhead.
INPUT_SAFETY_MARGIN_TOKENS = 3000
# Never shrink the input budget below this many tokens.
MIN_INPUT_TOKENS = 2000
# Context window assumed for models not present in the catalog.
FALLBACK_CONTEXT_TOKENS = 131072
# Output cap assumed (for input budgeting) for unknown models.
FALLBACK_OUTPUT_TOKENS = 8192


def get_model_spec(model_id: Optional[str]) -> Optional[ModelSpec]:
    """Return the spec for ``model_id`` or ``None`` if it is not catalogued."""
    if not model_id:
        return None
    return _MODELS_BY_ID.get(model_id)


def effective_max_output_tokens(
    model_id: Optional[str], requested: Optional[int]
) -> Optional[int]:
    """Clamp a requested ``max_tokens`` to what the model actually supports.

    - Known model: returns ``min(requested, max_output_tokens)``. If nothing was
      requested, returns the model's full output cap.
    - Unknown model: returns the request unchanged (no clamping) so custom /
      newly added models are not artificially throttled.
    """
    spec = get_model_spec(model_id)
    if spec is None:
        return requested
    if requested is None:
        return spec.max_output_tokens
    return min(requested, spec.max_output_tokens)


def max_input_chars(
    model_id: Optional[str], requested_output_tokens: Optional[int]
) -> int:
    """Max characters of input text that fit given the model's context window.

    Reserves room for the (clamped) output plus a safety margin, then converts
    the remaining token budget to characters.
    """
    spec = get_model_spec(model_id)
    context = spec.context_length if spec else FALLBACK_CONTEXT_TOKENS

    reserved_output = effective_max_output_tokens(model_id, requested_output_tokens)
    if reserved_output is None:
        reserved_output = FALLBACK_OUTPUT_TOKENS

    budget_tokens = context - reserved_output - INPUT_SAFETY_MARGIN_TOKENS
    budget_tokens = max(budget_tokens, MIN_INPUT_TOKENS)
    return int(budget_tokens * CHARS_PER_TOKEN)
