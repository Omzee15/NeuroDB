from google import genai
import time

# REPLACE THIS with your NEW API key from the new account
api_key = "AIzaSyBuhXB5uV1KD0QW8TeKtzdjwylE0MMYjkk"

try:
    client = genai.Client(api_key=api_key)
    
    print("Testing API key...")
    print("=" * 60)
    
    # Make a minimal request
    response = client.models.generate_content(
        model="gemini-2.0-flash",  # Back to experimental
        contents="Hi"
    )
    
    print("✅ API Key is VALID and WORKING!")
    print("\nResponse:", response.text)
    print("\n" + "=" * 60)
    print("\nTo check detailed quota information:")
    print("1. Visit: https://aistudio.google.com/apikey")
    print("2. Or visit: https://ai.dev/usage?tab=rate-limit")
    print("\nTypical Free Tier Limits:")
    print("- Requests per minute (RPM): 15")
    print("- Tokens per minute (TPM): 1,000,000")
    print("- Requests per day (RPD): 1,500")
    
except Exception as e:
    print("❌ Error:", str(e))
    if "429" in str(e):
        print("\n⚠️  RATE LIMIT EXCEEDED")
        print("You've hit the per-minute quota limit.")
        print("Wait 1-2 minutes and try again.")
    elif "403" in str(e) or "401" in str(e):
        print("\n⚠️  INVALID API KEY")
        print("The API key may be invalid or doesn't have access.")
    elif "400" in str(e):
        print("\n⚠️  BAD REQUEST")
        print("There may be an issue with the request format.")
