import asyncio
import websockets
import json

async def run():
    uri = 'ws://127.0.0.1:8000/ws/interview'
    async with websockets.connect(uri) as ws:
        print('connected')
        await ws.send(json.dumps({'type':'start','voice':'male'}))
        # read welcome and tts_ready messages
        for _ in range(4):
            msg = await ws.recv()
            print('recv:', msg.encode('utf-8'))
        # send text 'hazirim'
        await ws.send(json.dumps({'type':'text','data':'hazırım'}))
        for _ in range(8):
            msg = await ws.recv()
            print('recv:', msg.encode('utf-8'))

if __name__ == '__main__':
    asyncio.run(run())
