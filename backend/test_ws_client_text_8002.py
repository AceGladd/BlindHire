import asyncio
import websockets
import json

async def run():
    uri = 'ws://127.0.0.1:8002/ws/interview'
    async with websockets.connect(uri) as ws:
        print('connected')
        await ws.send(json.dumps({'type':'start','voice':'male'}))
        # read welcome and tts_ready messages (up to 8)
        for _ in range(8):
            msg = await ws.recv()
            print('recv:', msg)
        # send text 'hazirim'
        await ws.send(json.dumps({'type':'text','data':'hazırım'}))
        for _ in range(12):
            msg = await ws.recv()
            print('recv:', msg)

if __name__ == '__main__':
    asyncio.run(run())
