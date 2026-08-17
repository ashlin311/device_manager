import json
import re
import httpx

from config import get_settings

settings = get_settings()


def _extract_first_json(text: str) -> str | None:
    """
    Scan `text` and return the substring covering the first complete JSON object
    (starting at the first '{' and ending at its matching '}').  Returns None if
    no valid JSON object is found.  This tolerates extra text or duplicate JSON
    blobs that some LLMs append after the real answer.
    """
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    in_string = False
    escape = False
    for i, ch in enumerate(text[start:], start=start):
        if escape:
            escape = False
            continue
        if ch == "\\" and in_string:
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


async def parse_natural_command(prompt: str, device_list: list[dict]) -> dict:
    """
    Send a natural language prompt to the LLM (Qwen/Qwen2.5-7B-Instruct-AWQ on Modal)
    and parse the response into a structured command.
    """
    system_prompt = f"""You are a device management assistant.

Output ONE JSON object only. No explanation, no markdown, no backticks, no repetition.

Available devices:
{json.dumps(device_list, indent=2)}

Admin instruction: "{prompt}"

Required JSON structure:
{{"action": "restart" | "lock" | "rename" | "notify", "targets": ["<uuid>"], "payload": {{}}}}

Rules:
- targets must be a list of device UUIDs from the available devices list above
- payload is only needed for "rename" (include new_name) and "notify" (include message)
- if the instruction is ambiguous or no devices match, return {{"error": "reason"}}
- do NOT include any text before or after the JSON object"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                settings.MODAL_ENDPOINT_URL,
                json={
                    "prompt": system_prompt,
                    "max_tokens": 512,
                    "temperature": 0.1,
                },
            )
            response.raise_for_status()

            data = response.json()

            if "error" in data:
                return {"error":data["error"]}

            raw = data.get("response","").strip()

            if not raw:
                return {"error":"LLM returned empty response"}

            # Strip markdown fences
            raw = raw.replace("```json", "").replace("```", "").strip()
            print("[LLM RAW RESPONSE]")
            print(raw)

            # Extract the first complete JSON object (handles model echoing extra text)
            json_str = _extract_first_json(raw)
            if json_str is None:
                return {"error": f"Failed to parse LLM response: {raw}"}
            parsed = json.loads(json_str)
            return parsed

    except httpx.HTTPError as e:
        return {"error": f"LLM service error: {str(e)}"}
    except json.JSONDecodeError as e:
        return {"error": f"Failed to parse LLM response: {raw} — {e}"}
    except Exception as e:
        return {"error": f"Unexpected error: {str(e)}"}
