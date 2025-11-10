from google import genai
import os

# Option 1: Use environment variable (recommended)
# Make sure to set GEMINI_API_KEY environment variable first
# export GEMINI_API_KEY="your-api-key-here"

# Option 2: Pass API key directly (for testing)
api_key = "AIzaSyAwL3t5BWKYaNCzGv5D5SbuaQTsCBmvVzg"  # Replace with your actual API key

client = genai.Client(api_key=api_key)

response = client.models.generate_content(
    model="gemini-2.0-flash-exp", contents="Explain how AI works in a few words"
)
print(response.text)
