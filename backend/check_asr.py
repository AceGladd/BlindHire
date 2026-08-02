import asyncio
from api.asr_service import ASRService

async def main():
    try:
        s = ASRService()
        print('ASRService ok, model=', s.model)
    except Exception as e:
        print('ASRService init failed:', repr(e))

if __name__ == '__main__':
    asyncio.run(main())
