import os
import modal

app = modal.App("mdp-qwen-service")

# Define the container environment
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "vllm==0.7.3",
        "transformers==4.48.2",
        "huggingface_hub",
        "accelerate",
    )
    .env({"HF_XET_HIGH_PERFORMANCE": "1"})
)

MODEL_NAME = "Qwen/Qwen2.5-7B-Instruct-AWQ"


@app.cls(
    gpu="T4",
    image=image,
    timeout=600,
)
class Model:
    @modal.enter()
    def load_model(self):
        from vllm import LLMEngine, EngineArgs

        print("Loading vLLM model engine...")
        engine_args = EngineArgs(
            model=MODEL_NAME,
            quantization="awq",
            tensor_parallel_size=1,
            max_model_len=1024,
            gpu_memory_utilization=0.9,
        )
        self.engine = LLMEngine.from_engine_args(engine_args)

        from transformers import AutoTokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        print("Model loaded.")

    @modal.fastapi_endpoint(method="POST")
    def generate(self, data: dict):
        prompt = data.get("prompt", "")
        max_tokens = data.get("max_tokens", 512)
        temperature = data.get("temperature", 0.1)

        if not prompt:
            return {"error": "Prompt cannot be empty"}

        from vllm import SamplingParams
        import uuid

        sampling_params = SamplingParams(
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=0.95,
        )

        request_id = str(uuid.uuid4())
        self.engine.add_request(request_id, prompt, sampling_params)

        final_output = None
        while self.engine.has_unfinished_requests():
            for output in self.engine.step():
                if output.request_id == request_id:
                    final_output = output  # keep updating until finished

        if final_output is None or not final_output.outputs:
            return {"error": "No output generated"}

        text = final_output.outputs[0].text.strip()
        text = text.replace("```json", "").replace("```", "").strip()

        return {"response": text}