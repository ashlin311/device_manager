import os
import modal

# Create a Modal App (formerly Stub)
app = modal.App("mdp-qwen-service")

# Define the container environment
image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install(
        "vllm==0.5.4",
        "huggingface_hub",
        "hf-transfer",
    )
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

MODEL_NAME = "Qwen/Qwen2.5-7B-Instruct-AWQ"

@app.cls(
    gpu="T4", # T4 is available on Modal's free tier without requiring a payment method
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
            gpu_memory_utilization=0.9
        )
        self.engine = LLMEngine.from_engine_args(engine_args)
        
        # Load tokenizers
        from transformers import AutoTokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

    @modal.fastapi_endpoint(method="POST")
    def generate(self, data: dict):
        """
        Receives requests matching format: {"prompt": "...", "max_tokens": 512, "temperature": 0.1}
        """
        prompt = data.get("prompt", "")
        max_tokens = data.get("max_tokens", 512)
        temperature = data.get("temperature", 0.1)

        if not prompt:
            return {"error": "Prompt cannot be empty"}

        from vllm import SamplingParams
        sampling_params = SamplingParams(
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=0.95,
        )

        import uuid
        request_id = str(uuid.uuid4())
        
        # vLLM engine run sync
        self.engine.add_request(request_id, prompt, sampling_params)
        
        final_output = None
        while self.engine.has_unfinished_requests():
            request_outputs = self.engine.step()
            for request_output in request_outputs:
                if request_output.request_id == request_id:
                    final_output = request_output

        text = final_output.outputs[0].text
        return text
