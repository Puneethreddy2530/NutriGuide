import sys
import asyncio
sys.path.append('backend')
from ollama_client import chat

async def test():
    try:
        res = await chat([{"role": "user", "content": "hi"}], system="test")
        print("SUCCESS:", res)
    except Exception as e:
        print("ERROR:", type(e), e)

asyncio.run(test())
