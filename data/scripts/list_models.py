"""Print the Gemini models this API key can use for text generation."""
from google import genai

from common import env

client = genai.Client(api_key=env("GEMINI_API_KEY"))
for m in client.models.list():
    if "generateContent" in (m.supported_actions or []) and "gemini" in m.name:
        print(m.name.removeprefix("models/"))