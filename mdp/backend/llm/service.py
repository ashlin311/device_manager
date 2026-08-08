import json
import httpx

from config import get_settings

settings = get_settings()


async def parse_natural_command(prompt: str, device_list: list[dict]) -> dict:
    """
    Send a natural language prompt to the LLM (Llama 3.1:32b on Modal)
    and parse the response into a structured command.
    """
    system_prompt = f"""You are a device management assistant. Return ONLY a valid JSON object, no explanation, no markdown, no backticks.

Available devices:
{json.dumps(device_list, indent=2)}

Admin instruction: "{prompt}"

Return format:
{{
  "action": "restart" | "lock" | "rename" | "notify",
  "targets": ["device-id-1", "device-id-2"],
  "payload": {{}}
}}

Rules:
- targets must be a list of device UUIDs from the available devices list
- payload is only needed for "rename" (include new_name) and "notify" (include message)
- if the instruction is ambiguous or no devices match, return {{"error": "reason"}}"""

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

            raw = response.text.strip()
            # Clean up potential markdown formatting from LLM
            raw = raw.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(raw)
            return parsed

    except httpx.HTTPError as e:
        return {"error": f"LLM service error: {str(e)}"}
    except json.JSONDecodeError:
        return {"error": f"Failed to parse LLM response: {raw}"}
    except Exception as e:
        return {"error": f"Unexpected error: {str(e)}"}
