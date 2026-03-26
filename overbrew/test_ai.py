import asyncio
from ai import anthropic_structured_reply
import sys
import json

async def main():
    messages = [{"role": "user", "content": "Which of my recent brews seems like it'd make the closest thing to a mildly bitter coffee"}]
    additional_context = "User's Recent Brews:\n- Morning Brew (Temp: 85°C, Flow: 3.5 ml/s)\n- Afternoon Kick (Temp: 96°C, Flow: 1.2 ml/s)\n- Evening Decaf (Temp: 90°C, Flow: 2.5 ml/s)"
    result = await anthropic_structured_reply(messages, additional_context=additional_context)
    print(json.dumps(result, indent=2))

if __name__ == '__main__':
    asyncio.run(main())
